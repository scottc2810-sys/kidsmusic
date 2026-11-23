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
from ..models import Child, ChildPrefs, SubjectProgress
from ..schemas import Strict
from ..security import owned_child

router = APIRouter(prefix="/api", tags=["subjects"])
SUBJECTS = ("maths", "science")
TEACHER_SUBJECTS = ("maths", "science", "music", "languages")
PERSONAS = ("melo", "professor_pi", "captain_science", "dadi", "coach_zoom", "maestro")


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
    difficulty: int = Field(ge=1, le=5)


@router.post("/children/{child_id}/subjects/{subject}/{topic}/round")
def record_round(subject: str, topic: str, body: RoundIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """One round of a topic: difficulty goes up after 80 % or more, down below 50 %, stays otherwise."""
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
    r.difficulty = min(5, before + 1) if share >= 0.8 else max(1, before - 1) if share < 0.5 else before
    r.rounds += 1
    r.attempts += body.total
    r.correct += correct
    earned = 3 if share >= 0.9 else 2 if share >= 0.7 else 1 if share >= 0.4 else 0
    r.stars += earned
    memory._event(db, child.id, "subject_round",
                  f"{subject.title()} · {topic.replace('_', ' ')}: {correct}/{body.total} right at level {before}"
                  + (f", now level {r.difficulty}" if r.difficulty != before else ""), memory.nid_child(child.id))
    db.commit()
    return {**_row(r), "earned": earned, "level_change": r.difficulty - before}
