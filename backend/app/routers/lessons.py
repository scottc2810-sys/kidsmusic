from __future__ import annotations

import random
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import assessment, engine, feedback, memory
from ..curriculum import ACTIVITIES, LEVELS, SONGS, THEMES_FOR_BASICS, TOPICS, public_spec
from ..db import get_db
from ..models import Attempt, Child, LessonSession, Parent
from ..schemas import AnswerIn, SignalIn, StartSessionIn
from ..scoring import InvalidResponse, score_attempt
from ..security import current_parent, owned_child
from ..teacher.service import get_teacher

router = APIRouter(prefix="/api", tags=["lessons"])

EVENT_ORDER = ("level_up", "harder", "easier", "break_offer", "game_switch", "check_mic")


def _say(session: LessonSession, key: str, lang: str, rng: random.Random, **fmt: object) -> str:
    """A line for this lesson: from the personal pack Claude wrote for it when there is one, else the phrase bank."""
    return get_teacher().say_in_session(session.plan or {}, key, lang, rng, **fmt)


def _rng(session: LessonSession, salt: int) -> random.Random:
    return random.Random(session.seed * 31 + salt)


def owned_session(session_id: str, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> LessonSession:
    s = db.get(LessonSession, session_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    child = db.get(Child, s.child_id)
    if child is None or child.parent_id != parent.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    return s


def _summary(db: Session, session: LessonSession) -> dict:
    attempts = [a for a in session.attempts if a.outcome in ("success", "partial", "miss")]
    skills = sorted({a.skill for a in attempts})
    best = [a.activity_type for a in attempts if a.outcome == "success"]
    return {
        "activities": len(attempts),
        "successes": sum(a.outcome == "success" for a in attempts),
        "stars": session.stars,
        "skills_practiced": skills,
        "favourite": max(set(best), key=best.count) if best else None,
        "uncertain_observations": sum(a.outcome == "uncertain" for a in session.attempts),
    }


def _end(db: Session, child: Child, session: LessonSession, reason: str) -> dict:
    if session.ended_at is None:
        session.ended_at = datetime.now(timezone.utc)
        session.end_reason = reason
        for a in session.attempts:
            if a.outcome is None:
                a.outcome = "skipped"
                a.score = 0.0
        session.summary = _summary(db, session)
        memory.record_session_end(db, child, session)
        assessment.update_after_activity(db, child)  # the spider charts are saved before the session closes
        db.commit()
        assessment.request_ai_assessment(child.id, f"music session ended ({reason})")
    key = "tired" if reason in ("tired", "stop") else "wrap_up"
    message = get_teacher().say(key, child.language, _rng(session, 999), stars=session.stars)
    return {"done": True, "reason": session.end_reason, "message": message, "stars": session.stars, "summary": session.summary}


@router.get("/catalog")
def catalog() -> dict:
    return {
        "levels": {k: {"name": v["name"], "core_skills": list(v["core_skills"])} for k, v in LEVELS.items()},
        "activities": {k: {"skill": a.skill, "min_level": a.min_level, "modes": list(a.modes), "is_game": a.is_game} for k, a in ACTIVITIES.items()},
        "songs": {k: {"title": s["title"], "ease": s["ease"], "notes": s["notes"]} for k, s in SONGS.items()},
    }


@router.post("/children/{child_id}/sessions", status_code=201)
def start_session(body: StartSessionIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    mode = body.mode or child.mode
    if mode == "real" and not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Real instrument mode needs a parent to allow the microphone first")
    # close any lesson left open (e.g. tab closed)
    for s in db.scalars(select(LessonSession).where(LessonSession.child_id == child.id, LessonSession.ended_at.is_(None))):
        _end(db, child, s, "abandoned")
    ears = bool(body.ears and child.consent_microphone) or mode == "real"
    session = LessonSession(child_id=child.id, level=child.current_level, mode=mode, seed=secrets.randbelow(2**31))
    from .. import parent_chat

    chosen = parent_chat.tactics(db, child)
    if assessment.felt_hard_twice(db, child) or "gentle" in chosen:
        session.pending_override = "easy"  # the child said "that was hard" twice, or the parent asked for gentle: start gently
    elif "more_games" in chosen:
        session.pending_override = "game"  # the parent asked for more play: start with a game
    db.add(session)
    states = engine.skill_states(db, child)
    snapshot = engine.skills_snapshot(states)
    recent = [
        {"type": a.activity_type, "outcome": a.outcome, "difficulty": a.difficulty}
        for a in db.scalars(select(Attempt).where(Attempt.child_id == child.id, Attempt.outcome.is_not(None))
                            .order_by(Attempt.created_at.desc()).limit(12))
    ][::-1]
    # Commit before the (possibly slow) AI call so no SQLite write lock is held across the network.
    db.commit()
    if body.topic:
        # Music Basics practice: instant, focused plan (no AI round-trip before the child can start).
        rng = _rng(session, 1)
        teacher = get_teacher()
        plan = {"topic": body.topic, "focus_skill": TOPICS[body.topic]["skill"], "theme": rng.choice(THEMES_FOR_BASICS),
                "source": "basics", "greeting": teacher.say(f"basics.{body.topic}", child.language, rng, name="{name}")}
        plan["theme_line"] = ""
    else:
        allowed = engine.allowed_focus_skills(child, mode)
        override = memory.focus_override(db, child)  # parent / Claude Code chosen focus wins when valid
        if body.focus in allowed:
            allowed = [body.focus]  # the child picked this step on their learning path
        elif override in allowed:
            allowed = [override]
        recall = feedback.recall(db, child, session.id)
        needs = assessment.needs(db, child, "music")
        mem = memory.brief(db, child) if get_teacher().uses_ai(child) else None  # the brain knows the child in every new session
        plan = get_teacher().plan_session(child, snapshot, allowed, recent, _rng(session, 1), recall=recall, memory=mem, session_id=session.id, needs=needs)
    plan["ears"] = ears
    session.plan = plan
    db.commit()
    if not body.topic:
        get_teacher().prepare_phrase_pack(child, session.id, snapshot, recent, mem)  # background; lesson never waits
    return {
        "ears": ears,
        "session_id": session.id, "mode": mode, "level": session.level, "level_name": LEVELS[session.level]["name"],
        "minutes": child.session_minutes, "greeting": plan["greeting"].replace("{name}", child.name), "theme_line": plan["theme_line"],
        "plan": {"focus_skill": plan.get("focus_skill"), "theme": plan.get("theme"), "source": plan.get("source"), "topic": plan.get("topic")},
    }


@router.post("/sessions/{session_id}/next")
def next_activity(session: LessonSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    child = db.get(Child, session.child_id)
    assert child is not None
    if session.ended_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This lesson has ended")
    if engine.time_up(child, session):
        result = _end(db, child, session, "complete")
        db.commit()
        return result
    for a in session.attempts:  # abandoned previous activity
        if a.outcome is None:
            a.outcome, a.score = "skipped", 0.0
    act, difficulty, spec, events = engine.choose_next(db, child, session)
    attempt = Attempt(session_id=session.id, child_id=child.id, activity_type=act.type, skill=act.skill,
                      level=child.current_level, difficulty=difficulty, spec=spec)
    db.add(attempt)
    db.commit()
    rng = _rng(session, len(session.attempts) + 7)
    teacher = get_teacher()
    intro_key = f"intro.{act.type}"
    if act.type in ("high_low", "loud_soft", "fast_slow"):
        intro_key += f".{spec['question']}"
    lines = [teacher.say("game_switch", child.language, rng)] if "game_switch" in events else []
    if "retry" in events:
        lines.append(_say(session, "retry", child.language, rng))
    elif "stretch" in events:
        lines.append(_say(session, "stretch", child.language, rng))
    if "retry" not in events or not ACTIVITIES[act.type].uses_note_input:
        lines.append(teacher.say(intro_key, child.language, rng, song=spec.get("title", "")))
    return {
        "retry": "retry" in events, "stretch": "stretch" in events,
        "done": False, "attempt_id": attempt.id, "type": act.type, "skill": act.skill, "difficulty": difficulty,
        "level": child.current_level, "spec": public_spec(act.type, spec), "say": " ".join(lines).replace("{name}", child.name),
        "new_activity": "new_activity" in events, "input": "notes" if act.uses_note_input else ("taps" if act.type == "rhythm_tap" else "choice"),
    }


@router.post("/sessions/{session_id}/attempts/{attempt_id}/answer")
def answer(attempt_id: str, body: AnswerIn, session: LessonSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    child = db.get(Child, session.child_id)
    assert child is not None
    attempt = db.get(Attempt, attempt_id)
    if attempt is None or attempt.session_id != session.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    if attempt.outcome is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This activity was already answered")
    if session.ended_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This lesson has ended")
    if body.response.get("source") == "mic" and not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Microphone input is not allowed for this child")
    try:
        result = score_attempt(attempt.activity_type, attempt.spec, body.response)
    except InvalidResponse as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid response: {exc}") from None
    attempt.response = body.response
    attempt.outcome = result.outcome
    attempt.score = result.score
    attempt.answered_at = datetime.now(timezone.utc)
    upd = engine.apply_outcome(db, child, session, attempt, result)
    db.flush()
    memory.record_attempt(db, child, session, attempt, upd.events)
    assessment.update_after_activity(db, child)  # progress tracker: measured after every single activity
    db.commit()
    if assessment.ai_due(db, child):  # every 12 answers the AI teacher reviews, so nothing is lost if the session or the brain stops
        assessment.request_ai_assessment(child.id, "regular review during a music lesson")

    teacher = get_teacher()
    rng = _rng(session, len(session.attempts) * 13)
    lang = child.language
    parts = [_say(session, result.outcome, lang, rng)]
    parts += feedback.specifics(attempt, result, lang, rng)  # what exactly was right, or what to listen for
    if result.outcome == "miss" and upd.hint:
        parts.append(teacher.say(f"hint.{upd.hint}", lang, rng))
    elif result.outcome in ("success", "partial") and upd.hint in ("faster", "slower"):
        parts.append(teacher.say(f"hint.{upd.hint}", lang, rng))
    events = [e for e in EVENT_ORDER if e in upd.events]
    for e in events:
        parts.append(teacher.say(e, lang, rng, level=LEVELS[child.current_level]["name"]))
    reveal: dict = {}
    if attempt.activity_type in ("high_low", "loud_soft", "instrument_guess", "same_different", "fast_slow"):
        reveal["correct"] = attempt.spec["answer"]
    if attempt.activity_type == "free_play":
        reveal["melody"] = result.detail.get("melody", [])
    return {
        "outcome": result.outcome, "score": result.score, "say": " ".join(p for p in parts if p).replace("{name}", child.name), "events": events,
        "stars_earned": upd.stars_earned, "stars": session.stars, "level": child.current_level,
        "reveal": reveal, "time_up": engine.time_up(child, session),
    }


@router.post("/sessions/{session_id}/signal")
def signal(body: SignalIn, session: LessonSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    child = db.get(Child, session.child_id)
    assert child is not None
    if session.ended_at is not None:
        return {"done": True, "message": "", "stars": session.stars, "summary": session.summary, "reason": session.end_reason}
    reason = engine.apply_signal(session, body.signal)
    if reason:
        result = _end(db, child, session, reason)
        db.commit()
        return result
    db.commit()
    key = "break_offer" if body.signal == "frustrated" else "game_switch"
    return {"done": False, "say": get_teacher().say(key, child.language)}


@router.post("/sessions/{session_id}/end")
def end_session(session: LessonSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    child = db.get(Child, session.child_id)
    assert child is not None
    result = _end(db, child, session, "complete" if engine.time_up(child, session) else "stop")
    db.commit()
    return result
