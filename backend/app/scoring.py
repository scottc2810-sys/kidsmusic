"""Server-authoritative scoring of activity responses.

Outcomes:
  success | partial | miss  -> a real musical judgement
  uncertain                 -> we could not observe reliably (noisy mic, low pitch confidence)
  skipped                   -> no response (timeout / child walked away)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

Outcome = Literal["success", "partial", "miss", "uncertain", "skipped"]

MIC_CONFIDENCE_MIN = 0.6
SUCCESS_AT = 0.85
PARTIAL_AT = 0.5


class NoteEvent(BaseModel):
    midi: int = Field(ge=21, le=108)
    t: float = Field(ge=0, le=600_000)  # ms since activity start
    conf: float = Field(default=1.0, ge=0, le=1)
    camera_agrees: bool | None = None


class CameraSummary(BaseModel):
    """What the camera saw of the hands while the child played (fractions of frames, 0-1)."""
    frames: int = Field(default=0, ge=0, le=100_000)
    seen: float = Field(default=0.0, ge=0, le=1)  # at least one hand in view
    flat: float = Field(default=0.0, ge=0, le=1)  # fingers stretched flat instead of curved
    one_finger: float = Field(default=0.0, ge=0, le=1)  # poking with a single finger


class NotesResponse(BaseModel):
    notes: list[NoteEvent] = Field(default_factory=list, max_length=400)
    source: Literal["screen", "mic"] = "screen"
    timed_out: bool = False
    camera: CameraSummary | None = None
    keep_beat: bool = False  # the child was asked to play in time with the beat


class ChoiceResponse(BaseModel):
    choice: int | None = Field(default=None, ge=0, le=10)
    timed_out: bool = False


class TapsResponse(BaseModel):
    taps: list[float] = Field(default_factory=list, max_length=64)
    timed_out: bool = False
    source: Literal["screen", "mic"] = "screen"


@dataclass
class ScoreResult:
    outcome: Outcome
    score: float
    detail: dict = field(default_factory=dict)


class InvalidResponse(ValueError):
    pass


def _grade(score: float) -> Outcome:
    if score >= SUCCESS_AT:
        return "success"
    if score >= PARTIAL_AT:
        return "partial"
    return "miss"


def semi_global_distance(target: list[int], played: list[int]) -> tuple[int, int]:
    """Edit distance of `target` against the best-matching substring of `played`.

    Leading/trailing exploratory notes are free (young children often warm up first).
    Returns (distance, end_index_in_played).
    """
    n, m = len(target), len(played)
    if n == 0:
        return 0, 0
    prev = [0] * (m + 1)  # free start anywhere in `played`
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        for j in range(1, m + 1):
            cost = 0 if target[i - 1] == played[j - 1] else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    best_j = min(range(m + 1), key=lambda j: prev[j])
    return prev[best_j], best_j


def _reliable_notes(resp: NotesResponse) -> tuple[list[NoteEvent], int]:
    """Split notes into reliable ones and a count of unreliable ones.

    Camera agreement can rescue a medium-confidence mic note; disagreement demotes it.
    """
    if resp.source == "screen":
        return list(resp.notes), 0
    reliable, unsure = [], 0
    for n in resp.notes:
        conf = n.conf
        if n.camera_agrees is True:
            conf = min(1.0, conf + 0.2)
        elif n.camera_agrees is False:
            conf -= 0.2
        if conf >= MIC_CONFIDENCE_MIN:
            reliable.append(n)
        else:
            unsure += 1
    return reliable, unsure


def _key(midi: int, mic: bool) -> int:
    # Microphones / small keyboards are often an octave off: compare pitch class for mic input.
    return midi % 12 if mic else midi


def score_sequence(target: list[int], resp: NotesResponse) -> ScoreResult:
    if resp.timed_out and not resp.notes:
        return ScoreResult("skipped", 0.0)
    reliable, unsure = _reliable_notes(resp)
    mic = resp.source == "mic"
    if not reliable:
        return ScoreResult("uncertain" if unsure else "skipped", 0.0, {"unsure_notes": unsure})
    played = [_key(n.midi, mic) for n in reliable]
    tgt = [_key(x, mic) for x in target]
    dist, _ = semi_global_distance(tgt, played)
    score = max(0.0, 1.0 - dist / len(tgt))
    outcome = _grade(score)
    # A mostly-unreliable observation should not be judged as a mistake.
    if mic and outcome != "success" and unsure >= len(reliable):
        outcome = "uncertain"
    return ScoreResult(outcome, round(score, 3), {"distance": dist, "played": played[:64], "unsure_notes": unsure,
                                                  "events": [{"midi": n.midi, "t": n.t, "conf": n.conf} for n in reliable[:64]]})


def score_find_note(spec: dict, resp: NotesResponse) -> ScoreResult:
    if resp.timed_out and not resp.notes:
        return ScoreResult("skipped", 0.0)
    reliable, unsure = _reliable_notes(resp)
    mic = resp.source == "mic"
    if not reliable:
        return ScoreResult("uncertain" if unsure else "skipped", 0.0, {"unsure_notes": unsure})
    tries = [_key(n.midi, mic) for n in reliable[: spec["tries"]]]
    target = _key(spec["target"], mic)
    if target in tries:
        idx = tries.index(target)
        score = 1.0 if idx == 0 else (0.75 if idx == 1 else 0.6)
        return ScoreResult("success" if idx == 0 else "partial", score, {"found_on_try": idx + 1})
    if mic and unsure >= len(reliable):
        return ScoreResult("uncertain", 0.0, {"unsure_notes": unsure})
    # Direction-aware feedback ("a little higher!") is more useful than "wrong".
    last = reliable[min(len(reliable), spec["tries"]) - 1].midi
    direction = "higher" if spec["target"] > last else "lower"
    return ScoreResult("miss", 0.0, {"hint": direction})


def score_choice(spec: dict, resp: ChoiceResponse) -> ScoreResult:
    if resp.choice is None:
        return ScoreResult("skipped", 0.0)
    ok = resp.choice == spec["answer"]
    return ScoreResult("success" if ok else "miss", 1.0 if ok else 0.0, {"correct": spec["answer"]})


def score_rhythm(spec: dict, resp: TapsResponse) -> ScoreResult:
    taps = sorted(resp.taps)
    if not taps:
        return ScoreResult("skipped", 0.0)
    beat_ms = 60_000 / spec["bpm"]
    expected = [p * beat_ms for p in spec["pattern"]]
    n = len(expected)
    if len(taps) == 1:
        return ScoreResult("miss", round(1 / n * 0.5, 3), {"matched": 1, "expected": n})
    rel = [t - taps[0] for t in taps]
    # Allow children to speed up / slow down overall: normalise by total span (bounded).
    span_exp = expected[-1] - expected[0]
    span_tap = rel[-1]
    scale = 1.0
    if span_exp > 0 and span_tap > 0:
        scale = max(0.7, min(1.4, span_tap / span_exp))
    exp_scaled = [(e - expected[0]) * scale for e in expected]
    tol = spec["tolerance_ms"] * max(1.0, scale)
    used: set[int] = set()
    matched = 0
    errors: list[float] = []
    for e in exp_scaled:
        best, best_d = None, None
        for i, t in enumerate(rel):
            if i in used:
                continue
            d = abs(t - e)
            if d <= tol and (best_d is None or d < best_d):
                best, best_d = i, d
        if best is not None:
            used.add(best)
            matched += 1
            errors.append(best_d or 0.0)
    extra = len(taps) - matched
    score = matched / n - 0.25 * max(0, extra) / n
    score = max(0.0, min(1.0, score))
    tempo_note = "faster" if scale < 0.85 else ("slower" if scale > 1.18 else "steady")
    return ScoreResult(
        _grade(score),
        round(score, 3),
        {"matched": matched, "expected": n, "extra": extra, "tempo": tempo_note,
         "mean_error_ms": round(sum(errors) / len(errors), 1) if errors else None},
    )


def score_free_play(resp: NotesResponse) -> ScoreResult:
    # Exploration is rewarded, never judged.
    reliable, unsure = _reliable_notes(resp)
    if not reliable:
        return ScoreResult("uncertain" if unsure else "skipped", 0.0)
    distinct = len({n.midi for n in reliable})
    score = min(1.0, 0.4 + 0.12 * distinct)
    outcome: Outcome = "success" if len(reliable) >= 4 else "partial"
    return ScoreResult(outcome, round(score, 3), {"melody": [n.midi for n in reliable[:32]], "distinct": distinct})


def score_attempt(activity_type: str, spec: dict, raw: dict) -> ScoreResult:
    try:
        if activity_type in ("high_low", "loud_soft", "instrument_guess", "same_different", "fast_slow"):
            return score_choice(spec, ChoiceResponse.model_validate(raw))
        if activity_type == "rhythm_tap":
            return score_rhythm(spec, TapsResponse.model_validate(raw))
        if activity_type == "find_note":
            return score_find_note(spec, NotesResponse.model_validate(raw))
        if activity_type in ("echo_melody", "play_song"):
            return score_sequence(spec["notes"], NotesResponse.model_validate(raw))
        if activity_type == "free_play":
            return score_free_play(NotesResponse.model_validate(raw))
    except ValidationError as exc:
        raise InvalidResponse(str(exc.errors()[:3])) from None
    raise InvalidResponse(f"Unknown activity type {activity_type}")
