"""What a teacher notices while the child plays, beyond right and wrong notes.

Input: the notes the child should play (with beat lengths and tempo) and the notes Melo
actually heard (screen keys or the microphone on a real instrument), each with a time stamp,
plus optional camera observations of the hands. Output: at most one coaching tip (the most
useful one) and, when one spot caused the trouble, a short "spot practice" drill around it.

Everything here is deterministic and unit-tested; the wording lives in teacher/phrases.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from statistics import median

HESITATION_RATIO = 2.2  # a gap this many times longer than the child's own pace is a hesitation
HESITATION_MIN_MS = 900
RUSH_RATIO = 0.6
UNEVEN_CV = 0.45
SHORT_HOLD = 0.55  # a long note released before 55% of its length was cut short


@dataclass
class Tip:
    key: str  # phrase key: coach.<key>
    index: int | None = None  # note index inside the phrase the tip is about
    params: dict = field(default_factory=dict)


@dataclass
class Coaching:
    tip: Tip | None = None
    drill: dict | None = None  # {"start": i, "end": j} (inclusive note indices to practise on their own)
    stats: dict = field(default_factory=dict)


def align(target: list[int], played: list[int]) -> list[int | None]:
    """For each target note, the index of the played note matched to it (None = not played).

    Edit-distance alignment with a free start, so warm-up notes before the phrase are ignored.
    Pitch classes are compared, so a real keyboard an octave away still lines up.
    """
    n, m = len(target), len(played)
    if not n or not m:
        return [None] * n
    eq = lambda i, j: (target[i] - played[j]) % 12 == 0  # noqa: E731
    cost = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cost[i][0] = i
        for j in range(1, m + 1):
            cost[i][j] = min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, cost[i - 1][j - 1] + (0 if eq(i - 1, j - 1) else 1))
    j = min(range(m + 1), key=lambda k: cost[n][k])
    out: list[int | None] = [None] * n
    i = n
    while i > 0 and j > 0:
        if cost[i][j] == cost[i - 1][j - 1] + (0 if eq(i - 1, j - 1) else 1):
            out[i - 1] = j - 1 if eq(i - 1, j - 1) else None
            i, j = i - 1, j - 1
        elif cost[i][j] == cost[i - 1][j] + 1:
            i -= 1
        else:
            j -= 1
    return out


def observe(target: list[int], beats: list[float] | None, bpm: float, events: list[dict], *, mic: bool = False,
            keep_beat: bool = False, camera: dict | None = None, passed: bool = True) -> Coaching:
    """`events`: [{"midi", "t" (ms), "conf"}]. `keep_beat`: the child was asked to play in time."""
    out = Coaching()
    n = len(target)
    if n < 2 or len(events) < 2:
        return _camera_only(out, camera)
    beats = list(beats or [1.0] * n)
    played = [int(e["midi"]) for e in events]
    match = align(target, played)
    beat_ms = 60_000 / max(30.0, bpm)

    # timing between consecutive matched notes, as a ratio to the written length
    ratios: list[tuple[int, float, float]] = []  # (index of the later note, ratio, gap ms)
    for i in range(1, n):
        a, b = match[i - 1], match[i]
        if a is None or b is None or b <= a:
            continue
        gap = float(events[b]["t"]) - float(events[a]["t"])
        want = beats[i - 1] * beat_ms
        if gap > 0 and want > 0:
            ratios.append((i, gap / want, gap))
    first_wrong = next((i for i, x in enumerate(match) if x is None), None)
    out.stats = {"matched": sum(x is not None for x in match), "notes": n}
    if len(ratios) >= 2:
        pace = median(r for _, r, _ in ratios)
        mean = sum(r for _, r, _ in ratios) / len(ratios)
        cv = (sum((r - mean) ** 2 for _, r, _ in ratios) / len(ratios)) ** 0.5 / mean if mean else 0.0
        out.stats.update(pace=round(pace, 2), evenness=round(max(0.0, 1 - cv), 2))
    else:
        pace, cv = 1.0, 0.0

    # 1. a wrong or missing note: practise the notes around it
    if first_wrong is not None and not passed:
        out.drill = {"start": max(0, first_wrong - 1), "end": min(n - 1, first_wrong + 1)}

    # 2. one long stop in an otherwise flowing phrase: the child was searching for that key
    if ratios:
        i, r, gap = max(ratios, key=lambda x: x[1])
        if len(ratios) >= 3 and r >= HESITATION_RATIO * pace and gap >= HESITATION_MIN_MS:
            out.tip = Tip("hesitation", i)
            out.drill = out.drill or {"start": i - 1, "end": i}
            return out

    # 3. a long note cut short (the child did not count it)
    for i, r, _gap in ratios:
        if beats[i - 1] >= 2 and r < SHORT_HOLD * max(pace, 0.6):
            out.tip = Tip("hold_long", i - 1, {"beats": int(round(beats[i - 1]))})
            return out

    # 4. overall pace and evenness
    if len(ratios) >= 3:
        if keep_beat and pace < RUSH_RATIO:
            out.tip = Tip("rushing")
        elif keep_beat and pace > 1.6:
            out.tip = Tip("dragging")
        elif cv > UNEVEN_CV:
            out.tip = Tip("uneven")
        elif passed and cv < 0.2 and 0.75 <= pace <= 1.35:
            out.tip = Tip("steady")  # specific praise: the beat really was even

    # 5. the microphone could barely hear the instrument (more useful to say than general praise)
    if (out.tip is None or out.tip.key == "steady") and mic:
        weak = sum(float(e.get("conf", 1.0)) < 0.7 for e in events)
        if weak >= max(2, len(events) // 2):
            out.tip = Tip("louder")
    return _camera_only(out, camera)


def _camera_only(out: Coaching, camera: dict | None) -> Coaching:
    """Hand posture seen by the camera (only when the parent turned the camera on)."""
    if (out.tip is not None and out.tip.key != "steady") or not camera or float(camera.get("frames", 0)) < 15:
        return out  # one idea at a time; a correction to the hands replaces general praise
    if float(camera.get("seen", 1.0)) < 0.3:
        out.tip = Tip("cam_hands")
    elif float(camera.get("flat", 0.0)) > 0.6:
        out.tip = Tip("cam_curve")
    elif float(camera.get("one_finger", 0.0)) > 0.8:
        out.tip = Tip("cam_fingers")
    return out
