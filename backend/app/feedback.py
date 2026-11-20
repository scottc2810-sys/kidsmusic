"""Specific feedback: say what exactly was right, or what to listen for, instead of a generic line.

A good teacher does not only say "well done" or "try again". After a success they name what the
child did ("you found Ga on the very first try"); after a miss they show the answer and say what
to listen for. These lines are built instantly from the scoring detail (no AI round-trip).
"""
from __future__ import annotations

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from .languages import note_name
from .models import Attempt, Child, LessonSession
from .scoring import ScoreResult
from .teacher import phrases


def specifics(attempt: Attempt, result: ScoreResult, lang: str, rng: random.Random) -> list[str]:
    t, spec, o, d = attempt.activity_type, attempt.spec or {}, result.outcome, result.detail
    say = lambda key, **fmt: phrases.line(key, lang, rng, **fmt)  # noqa: E731
    out: list[str] = []
    if o == "miss":
        # show and tell the answer; the same item then comes back once with more help (engine "retry")
        if t in ("high_low", "loud_soft", "fast_slow"):
            out.append(say(f"teach.{t}.{spec.get('question')}", n=int(spec.get("answer", 0)) + 1))
        elif t == "same_different":
            out.append(say("teach.same_different.same" if spec.get("answer") == 0 else "teach.same_different.different"))
        elif t == "instrument_guess":
            out.append(say("teach.instrument_guess"))
        elif t == "rhythm_tap" and d.get("expected"):
            out.append(say("detail.rhythm_some", matched=d.get("matched", 0), expected=d["expected"]))
    elif o in ("success", "partial"):
        if t == "find_note" and d.get("found_on_try"):
            out.append(say("detail.find_first" if d["found_on_try"] == 1 else "detail.find_later", note=note_name(spec["target"], lang)))
        elif t == "rhythm_tap" and d.get("expected"):
            out.append(say("detail.rhythm_all") if d.get("matched") == d["expected"] and not d.get("extra")
                       else say("detail.rhythm_some", matched=d.get("matched", 0), expected=d["expected"]))
        elif t in ("echo_melody", "play_song") and o == "success" and d.get("distance") == 0:
            out.append(say("detail.notes_all"))
        elif o == "success" and rng.random() < 0.3:
            out.append(say("detail.name", name="{name}"))  # the name is filled in locally by the caller
    return [x for x in out if x]


def recall(db: Session, child: Child, current_session_id: str | None = None) -> dict:
    """Facts from earlier lessons for the greeting ("Last time you earned 6 stars!")."""
    last = db.scalars(select(LessonSession).where(
        LessonSession.child_id == child.id, LessonSession.ended_at.is_not(None), LessonSession.activities_done > 0,
        LessonSession.id != (current_session_id or "")).order_by(LessonSession.started_at.desc()).limit(1)).first()
    out: dict = {}
    if last is not None:
        out["stars"] = last.stars
    songs: dict[str, bool] = {}
    for spec, outcome in db.execute(select(Attempt.spec, Attempt.outcome).where(
            Attempt.child_id == child.id, Attempt.activity_type == "play_song", Attempt.outcome.in_(["success", "partial"]))
            .order_by(Attempt.created_at.desc()).limit(40)):
        title = (spec or {}).get("title")
        if title and title not in songs:
            songs[title] = bool((spec or {}).get("full_song") and outcome == "success")
    learning = [t for t, done in songs.items() if not done]
    if learning:
        out["song"] = learning[0]
    # what was hard last time: a teacher remembers and comes back to it gently
    if last is not None:
        rows = db.execute(select(Attempt.skill, Attempt.outcome).where(Attempt.session_id == last.id, Attempt.outcome.is_not(None))).all()
        tried: dict[str, list[int]] = {}
        for skill, outcome in rows:
            tried.setdefault(skill, [0, 0])
            tried[skill][0] += 1
            tried[skill][1] += outcome == "miss"
        hard = [(m / n, s) for s, (n, m) in tried.items() if n >= 2 and m / n >= 0.5]
        if hard:
            out["hard_skill"] = max(hard)[1]
    return out


SKILL_WORDS = {
    "pitch": {"en": "high and low", "hi": "ऊँचा और नीचा सुर", "hinglish": "high aur low"},
    "dynamics": {"en": "loud and soft", "hi": "ज़ोर से और धीरे", "hinglish": "loud aur soft"},
    "timbre": {"en": "instrument sounds", "hi": "बाजों की आवाज़", "hinglish": "instruments ki awaaz"},
    "rhythm": {"en": "the rhythm", "hi": "ताल", "hinglish": "rhythm"},
    "melody": {"en": "playing tunes", "hi": "धुन बजाना", "hinglish": "tune bajana"},
    "creativity": {"en": "making up music", "hi": "अपना संगीत बनाना", "hinglish": "apna music banana"},
}


def recall_line(facts: dict, lang: str, rng: random.Random) -> str:
    if facts.get("hard_skill") in SKILL_WORDS:
        words = SKILL_WORDS[facts["hard_skill"]]
        return phrases.line("recall.skill", lang, rng, skill=words.get(lang, words["en"]))
    if facts.get("song") and rng.random() < 0.5:
        return phrases.line("recall.song", lang, rng, song=facts["song"])
    if facts.get("stars"):
        return phrases.line("recall.stars", lang, rng, stars=facts["stars"])
    return ""
