"""Music Basics API: topic tiers and progressive exercises made for the child."""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import basics, memory
from ..db import get_db
from ..models import Attempt, Child, CustomExercise
from ..schemas import Strict
from ..security import client_ip, owned_child, rate_limiter
from ..teacher.service import get_teacher

router = APIRouter(prefix="/api", tags=["basics"])


class ExerciseIn(Strict):
    force: bool = Field(default=False, description="make a new one even if an unfinished exercise exists")


def _completed_ids(db: Session, child_id: str) -> set[str]:
    rows = db.scalars(select(Attempt.spec).where(Attempt.child_id == child_id, Attempt.activity_type == "play_song",
                                                 Attempt.outcome == "success"))
    return {s.get("song_id") for s in rows if s and s.get("full_song")}


def _exercise_rows(db: Session, child: Child) -> list[CustomExercise]:
    return list(db.scalars(select(CustomExercise).where(CustomExercise.child_id == child.id).order_by(CustomExercise.created_at)))


def _public(row: CustomExercise, done: set[str], name: str) -> dict:
    sid = f"x_{row.id}"
    return {"song_id": sid, "title": row.title, "topic": row.topic, "tier": row.tier, "source": row.source,
            # the name is filled in locally; it is never sent to the AI
            "intro": row.intro.replace("{name}", name) if row.intro else None,
            "notes": len(row.notes), "completed": sid in done}


@router.get("/children/{child_id}/basics")
def basics_status(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    done = _completed_ids(db, child.id)
    teacher = get_teacher()
    return {
        "tiers": basics.tiers_for(db, child),
        "exercises": [_public(r, done, child.name) for r in _exercise_rows(db, child)],
        "brain": teacher.status()["provider"] if (teacher.ai_available and child.cloud_ai_allowed) else "offline",
    }


@router.post("/children/{child_id}/basics/{topic}/exercise", status_code=201)
def new_exercise(topic: str, request: Request, body: ExerciseIn | None = None, child: Child = Depends(owned_child),
                 db: Session = Depends(get_db)) -> dict:
    """The next exercise for this child, a small step harder. Reuses an unfinished one unless `force`."""
    if topic not in basics.EXERCISE_TOPICS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No exercises for this topic")
    rate_limiter.check(f"exercise:{child.id}:{client_ip(request)}", 6)
    done = _completed_ids(db, child.id)
    rows = _exercise_rows(db, child)
    unfinished = [r for r in rows if r.topic == topic and f"x_{r.id}" not in done]
    if unfinished and not (body and body.force):
        return {**_public(unfinished[0], done, child.name), "reused": True}
    row = make_exercise(db, child, topic, rows)
    return {**_public(row, done, child.name), "reused": False}


def make_exercise(db: Session, child: Child, topic: str, rows: list[CustomExercise]) -> CustomExercise:
    """A new exercise one small step harder (AI brain when allowed, the offline generator otherwise)."""
    info = basics.tiers_for(db, child)[topic]
    tier = info["tier"]
    titles = [r.title for r in rows]
    mem = memory.brief(db, child) if get_teacher().uses_ai(child) else None
    db.commit()  # no write lock while the (possibly slow) AI brain thinks
    ex, source = None, "offline"
    data = get_teacher().make_exercise(child, topic, tier, info["mastery"], titles, mem)
    if data:
        try:
            ex = basics.validate(data.get("swars"), None, data.get("beats"), int(data.get("phrase_length") or 8), tier,
                                 str(data.get("title") or ""), data.get("intro"))
            source = "claude"
        except (ValueError, TypeError):
            ex = None  # off-range or malformed: fall back to the offline generator
    if ex is None:
        ex = basics.offline_exercise(tier, random.Random(), len(rows) + 1)
    row = basics.save(db, child, topic, tier, ex, source)
    db.commit()
    return row


_auto_running: set[str] = set()


def auto_next_exercises(child_id: str) -> None:
    """Never run out: when every exercise of a topic is finished, make the next one (in the background)."""
    import threading

    if child_id in _auto_running:
        return
    _auto_running.add(child_id)

    def work() -> None:
        try:
            from ..db import session_factory

            with session_factory()() as db:
                child = db.get(Child, child_id)
                if child is None:
                    return
                done = _completed_ids(db, child.id)
                rows = _exercise_rows(db, child)
                for topic in basics.EXERCISE_TOPICS:
                    if not [r for r in rows if r.topic == topic and f"x_{r.id}" not in done]:
                        row = make_exercise(db, child, topic, rows)
                        memory._event(db, child.id, "auto_exercise", f"Melo made the next {topic} exercise: {row.title} (level {row.tier})",
                                      memory.nid_child(child.id))
                        db.commit()
                        rows.append(row)
        except Exception:  # a bonus, never disturbs the child
            import logging

            logging.getLogger("melo.basics").exception("auto exercise failed")
        finally:
            _auto_running.discard(child_id)

    threading.Thread(target=work, name="melo-auto-exercise", daemon=True).start()
