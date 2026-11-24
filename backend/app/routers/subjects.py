"""Maths and science (school classes 1-5) and the teacher personas per subject.

The exercises themselves are made on the device (instant, offline); the server keeps what matters across
devices: the child's class, each topic's difficulty (it climbs after a strong round and steps back after a
weak one, like a teacher), stars, and the persona and voice the parent chose for each subject's teacher.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import memory
from ..db import get_db
from ..models import ChallengeSet, Child, ChildPrefs, SubjectProgress, SubjectRound
from ..schemas import Strict
from ..security import owned_child

router = APIRouter(prefix="/api", tags=["subjects"])
SUBJECTS = ("maths", "science", "vedas", "finance")
TEACHER_SUBJECTS = ("maths", "science", "music", "languages", "vedas", "finance")
PERSONAS = ("melo", "professor_pi", "captain_science", "dadi", "coach_zoom", "maestro", "guruji", "money_mitra")
CHALLENGE_SIZE = 8


def grade_for_age(age: int) -> int:
    """School class from age (class 1 at about 6); 0 = pre-school (counting, shapes, colours)."""
    return max(0, min(5, age - 5))


def _prefs(db: Session, child: Child) -> ChildPrefs:
    p = db.get(ChildPrefs, child.id)
    if p is None:
        p = ChildPrefs(child_id=child.id, data={})
        db.add(p)
    return p


def public_prefs(child: Child, p: ChildPrefs | None) -> dict:
    d = dict((p.data if p else None) or {})
    grade = d.get("grade")
    return {"grade": grade if isinstance(grade, int) else grade_for_age(child.age), "grade_auto": not isinstance(grade, int),
            "teachers": d.get("teachers") or {}}


class TeacherIn(Strict):
    persona: str = "melo"
    voice: str | None = Field(default=None, max_length=200)  # a device voice name; ignored where it is not installed
    rate: float = Field(default=1.0, ge=0.6, le=1.4)
    pitch: float = Field(default=1.0, ge=0.6, le=1.5)

    @field_validator("persona")
    @classmethod
    def _p(cls, v: str) -> str:
        if v not in PERSONAS:
            raise ValueError("unknown persona")
        return v


class PrefsIn(Strict):
    grade: int | None = Field(default=None, ge=0, le=5)  # None = from the child's age
    teachers: dict[str, TeacherIn] = Field(default_factory=dict)

    @field_validator("teachers")
    @classmethod
    def _t(cls, v: dict) -> dict:
        if any(k not in TEACHER_SUBJECTS for k in v):
            raise ValueError("unknown subject")
        return v


@router.get("/children/{child_id}/prefs")
def get_prefs(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    return public_prefs(child, db.get(ChildPrefs, child.id))


@router.put("/children/{child_id}/prefs")
def save_prefs(body: PrefsIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    p = _prefs(db, child)
    p.data = {"grade": body.grade, "teachers": {k: v.model_dump() for k, v in body.teachers.items()}}
    db.commit()
    return public_prefs(child, p)


def _row(r: SubjectProgress) -> dict:
    return {"difficulty": r.difficulty, "rounds": r.rounds, "attempts": r.attempts, "correct": r.correct, "stars": r.stars}


@router.get("/children/{child_id}/subjects/{subject}")
def progress(subject: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    if subject not in SUBJECTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown subject")
    rows = db.scalars(select(SubjectProgress).where(SubjectProgress.child_id == child.id, SubjectProgress.subject == subject))
    return {"prefs": public_prefs(child, db.get(ChildPrefs, child.id)), "topics": {r.topic: _row(r) for r in rows}}


class RoundIn(Strict):
    correct: int = Field(ge=0, le=50)
    total: int = Field(ge=1, le=50)
    difficulty: int = Field(ge=1, le=50)  # 6+ = a level beyond the built-in ones (AI challenge set)
    strand: str = Field(default="", max_length=20)
    apply_correct: int = Field(default=0, ge=0, le=50)  # real-life application questions answered right
    apply_total: int = Field(default=0, ge=0, le=50)
    title: str = Field(default="", max_length=80)  # what the topic is, for the AI teacher writing harder questions
    examples: list[str] = Field(default_factory=list, max_length=3)
    # answered right after Melo taught that very fact ("learn first"): shows learning, not yet memory
    taught: int = Field(default=0, ge=0, le=50)
    # a revision round (questions met before, slips first): shows what is remembered, never moves the level
    revision: bool = False


@router.post("/children/{child_id}/subjects/{subject}/{topic}/round")
def record_round(subject: str, topic: str, body: RoundIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """One round of a topic: difficulty goes up after 80 % or more, down below 50 %, stays otherwise.
    A round where most answers came right after Melo taught them never moves the level up or counts as mastery:
    the child has seen it once, the next round checks it is remembered."""
    if subject not in SUBJECTS or not topic.replace("_", "").isalnum() or len(topic) > 40:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown topic")
    correct = min(body.correct, body.total)
    r = db.scalar(select(SubjectProgress).where(SubjectProgress.child_id == child.id, SubjectProgress.subject == subject,
                                                SubjectProgress.topic == topic))
    if r is None:
        r = SubjectProgress(child_id=child.id, subject=subject, topic=topic, difficulty=body.difficulty, rounds=0, attempts=0, correct=0, stars=0)
        db.add(r)
    share = correct / body.total
    before = r.difficulty
    played = min(body.difficulty, 5)
    recalled = min(body.taught, body.total) * 2 <= body.total and not body.revision  # at least half answered from memory
    if body.revision:
        r.difficulty = before  # revising old questions keeps the level where it was
    else:
        r.difficulty = min(5, played + 1) if share >= 0.8 and recalled else played if share >= 0.8 else max(1, played - 1) if share < 0.5 else played
    db.add(SubjectRound(child_id=child.id, subject=subject, topic=topic, strand=body.strand[:20], difficulty=body.difficulty,
                        correct=correct, total=body.total, apply_correct=min(body.apply_correct, body.apply_total), apply_total=body.apply_total))
    r.rounds += 1
    r.attempts += body.total
    r.correct += correct
    earned = 3 if share >= 0.9 else 2 if share >= 0.7 else 1 if share >= 0.4 else 0
    r.stars += earned
    memory._event(db, child.id, "subject_round",
                  f"{subject.title()} · {topic.replace('_', ' ')}{' (revision)' if body.revision else ''}: {correct}/{body.total} right at level {before}"
                  + (f", now level {r.difficulty}" if r.difficulty != before else ""), memory.nid_child(child.id))
    # a concept completed: the AI teacher reviews now; at the top level the never-ending pool grows a level
    mastered_now = share >= 0.8 and recalled and body.difficulty >= 4
    next_level = None
    if share >= 0.8 and recalled and body.difficulty >= 5:
        next_level = max(6, body.difficulty + 1)
        have = db.scalar(select(ChallengeSet.id).where(ChallengeSet.child_id == child.id, ChallengeSet.subject == subject,
                                                       ChallengeSet.topic == topic, ChallengeSet.level == next_level))
        if have:
            next_level = None
    db.commit()
    from .. import assessment

    if mastered_now:
        assessment.request_ai_assessment(child.id, f"{subject}: mastered '{body.title or topic}' at level {body.difficulty}", force=True)
    started = bool(next_level) and grow_challenges(child.id, subject, topic, next_level, body.title or topic.replace("_", " "), body.examples)
    return {**_row(r), "earned": earned, "level_change": r.difficulty - before, "mastered": mastered_now, "challenge_started": started}


# --- the never-ending pool: harder questions written by the AI brain, level after level ---------------------
_growing: set[tuple[str, str, str]] = set()
_ARITH = __import__("re").compile(r"^\s*(\d+)\s*([+\-−×x*÷/])\s*(\d+)\s*=\s*\?\s*$")


def _check_item(row: dict) -> dict | None:
    """Keep only safe, well-formed questions whose answer is one of the choices (and is right, for plain sums)."""
    from ..teacher.safety import clean_child_text

    prompt = clean_child_text(str(row.get("prompt") or ""))
    why = clean_child_text(str(row.get("why") or ""))
    choices = [str(c).strip()[:80] for c in (row.get("choices") or []) if str(c).strip()]
    answer = str(row.get("answer") or "").strip()[:80]
    if not prompt or not why or len(prompt) > 300 or not 2 <= len(set(choices)) == len(choices) <= 4 or answer not in choices:
        return None
    m = _ARITH.match(prompt)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        val = {"+": a + b, "-": a - b, "−": a - b, "×": a * b, "x": a * b, "*": a * b}.get(op)
        if op in "÷/":
            val = a / b if b else None
        if val is None or str(val).rstrip("0").rstrip(".") != answer.replace(",", ""):
            return None
    steps = [clean_child_text(str(x))[:220] for x in (row.get("steps") or [])][:6]
    return {"prompt": prompt, "choices": choices, "answer": answer, "why": why[:400], "steps": [x for x in steps if x], "apply": bool(row.get("apply"))}


def grow_challenges(child_id: str, subject: str, topic: str, level: int, title: str, examples: list[str]) -> bool:
    """Ask the AI brain (in the background) for a set of harder questions on this topic. Needs the AI brain."""
    import threading

    key = (child_id, subject, topic)
    if key in _growing:
        return False
    _growing.add(key)

    def work() -> None:
        try:
            from ..db import session_factory
            from ..teacher.service import _obj, _STR, get_teacher

            with session_factory()() as db:
                child = db.get(Child, child_id)
                if child is None:
                    return
                teacher = get_teacher()
                ai = teacher._ai_for(child)
                if not ai:
                    return
                grade = public_prefs(child, db.get(ChildPrefs, child.id))["grade"]
                prev = [i["prompt"] for c in db.scalars(select(ChallengeSet).where(ChallengeSet.child_id == child.id, ChallengeSet.subject == subject,
                                                                                    ChallengeSet.topic == topic)) for i in c.items][-20:]
                db.commit()
                prompt = (f"A {child.age}-year-old (school class {grade}) has mastered every built-in level of the {subject} topic "
                          f"'{title}'. Examples of the hardest questions they now answer correctly: {examples}. "
                          f"Write {CHALLENGE_SIZE} NEW questions one clear step harder (challenge level {level}), still on this topic, "
                          f"age-appropriate, kind and accurate. At least 3 must apply the idea to a real-life situation the child could meet "
                          f"(at home, school, a shop, nature, with friends) and have apply=true. Each: prompt, 2-4 short choices, the "
                          f"answer (exactly one of the choices), why (the reason in simple words), and 2-5 steps showing how to work it out. "
                          f"Do not repeat these earlier ones: {prev}.")
                row = _obj({"prompt": _STR, "choices": {"type": "array", "items": _STR}, "answer": _STR, "why": _STR,
                            "steps": {"type": "array", "items": _STR}, "apply": {"type": "boolean"}})
                data = teacher._ask(ai, prompt, _obj({"items": {"type": "array", "items": row}}), 3500)
                items = [x for x in (_check_item(r) for r in ((data or {}).get("items") or [])[:CHALLENGE_SIZE * 2] if isinstance(r, dict)) if x]
                if len(items) >= 3:
                    db.add(ChallengeSet(child_id=child.id, subject=subject, topic=topic, level=level, items=items[:CHALLENGE_SIZE]))
                    memory._event(db, child.id, "challenge", f"{subject}: Melo wrote level {level} of '{title}' ({len(items[:CHALLENGE_SIZE])} questions)",
                                  memory.nid_child(child.id))
                    db.commit()
        except Exception:  # a bonus: never disturbs the child
            import logging

            logging.getLogger("melo.subjects").exception("challenge generation failed")
        finally:
            _growing.discard(key)

    threading.Thread(target=work, name="melo-challenges", daemon=True).start()
    return True


@router.get("/children/{child_id}/subjects/{subject}/{topic}/challenges")
def challenges(subject: str, topic: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """The child's challenge levels for a topic (beyond the built-in 5), newest last."""
    if subject not in SUBJECTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown subject")
    sets = db.scalars(select(ChallengeSet).where(ChallengeSet.child_id == child.id, ChallengeSet.subject == subject, ChallengeSet.topic == topic)
                      .order_by(ChallengeSet.level))
    return {"levels": [{"level": c.level, "items": c.items} for c in sets], "growing": (child.id, subject, topic) in _growing}
