from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import path as learning
from ..curriculum import LEVELS
from .. import licence
from ..config import get_settings
from ..db import get_db
from ..engine import as_utc, skill_states, skills_snapshot
from ..models import Attempt, Child, ConsentEvent, LangAttempt, LangItemState, LangSkillState, LessonSession, Parent, Recording, SkillState
from ..schemas import ChildCreate, ChildOut, ChildUpdate, ConsentUpdate
from ..security import current_parent, owned_child
from ..storage import get_store

router = APIRouter(prefix="/api/children", tags=["children"])

MAX_CHILDREN = 8


def _log_consent(db: Session, child: Child, kind: str, granted: bool) -> None:
    db.add(ConsentEvent(child_id=child.id, kind=kind, granted=granted))


@router.get("", response_model=list[ChildOut])
def list_children(parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> list[Child]:
    return list(db.scalars(select(Child).where(Child.parent_id == parent.id).order_by(Child.created_at)))


@router.post("", response_model=ChildOut, status_code=201)
def create_child(body: ChildCreate, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> Child:
    count = db.scalar(select(func.count()).select_from(Child).where(Child.parent_id == parent.id)) or 0
    if count >= MAX_CHILDREN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Up to {MAX_CHILDREN} child profiles per account")
    free_max = licence.limit(get_settings(), "children")
    licence.require(get_settings(), free_max is None or count < free_max)
    child = Child(parent_id=parent.id, **body.model_dump())
    if child.mode == "real" and not child.consent_microphone:
        child.mode = "screen"
    db.add(child)
    db.flush()
    for kind in ("camera", "microphone", "recording"):
        _log_consent(db, child, kind, getattr(child, f"consent_{kind}"))
    skill_states(db, child)
    db.commit()
    return child


@router.get("/{child_id}", response_model=ChildOut)
def get_child(child: Child = Depends(owned_child)) -> Child:
    return child


@router.patch("/{child_id}", response_model=ChildOut)
def update_child(body: ChildUpdate, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Child:
    data = body.model_dump(exclude_unset=True)
    clear = data.pop("clear_reminder", False)
    for k, v in data.items():
        if v is not None:
            setattr(child, k, v)
    if "current_level" in data and data["current_level"]:
        # the parent says the child already knows the earlier material: start the new level a little up
        for st in skill_states(db, child).values():
            st.streak = st.fail_streak = 0
    if clear:
        child.reminder_time = None
        child.reminder_days = []
    if child.mode == "real" and not child.consent_microphone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Real instrument mode needs microphone permission first")
    db.commit()
    return child


@router.put("/{child_id}/consent", response_model=ChildOut)
def update_consent(body: ConsentUpdate, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Child:
    for kind in ("camera", "microphone", "recording"):
        val = getattr(body, kind)
        if val is not None and val != getattr(child, f"consent_{kind}"):
            setattr(child, f"consent_{kind}", val)
            _log_consent(db, child, kind, val)
    if not child.consent_microphone and child.mode == "real":
        child.mode = "screen"  # never keep a mic-dependent mode without permission
    db.commit()
    return child


@router.get("/{child_id}/consent-history")
def consent_history(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(ConsentEvent).where(ConsentEvent.child_id == child.id).order_by(ConsentEvent.at.desc()).limit(100))
    return [{"kind": r.kind, "granted": r.granted, "at": as_utc(r.at).isoformat()} for r in rows]


@router.get("/{child_id}/progress")
def progress(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    states = skill_states(db, child)
    db.commit()
    sessions = list(db.scalars(select(LessonSession).where(LessonSession.child_id == child.id).order_by(LessonSession.started_at.desc()).limit(30)))
    by_type = db.execute(
        select(Attempt.activity_type, Attempt.outcome, func.count()).where(Attempt.child_id == child.id, Attempt.outcome.is_not(None))
        .group_by(Attempt.activity_type, Attempt.outcome)
    ).all()
    activity_stats: dict[str, dict[str, int]] = {}
    for t, o, c in by_type:
        activity_stats.setdefault(t, {})[o] = c
    songs = db.scalars(
        select(Attempt.spec).where(Attempt.child_id == child.id, Attempt.activity_type == "play_song", Attempt.outcome == "success")
    ).all()
    learned = sorted({s.get("title") for s in songs if s and s.get("full_song")} - {None})
    total_minutes = sum(
        ((as_utc(s.ended_at) - as_utc(s.started_at)).total_seconds() / 60) for s in sessions if s.ended_at
    )
    return {
        "level": child.current_level,
        "level_name": LEVELS[child.current_level]["name"],
        "core_skills": list(LEVELS[child.current_level]["core_skills"]),
        "skills": skills_snapshot(states),
        "activity_stats": activity_stats,
        "songs_learned": learned,
        "recent_minutes": round(total_minutes, 1),
        "sessions": [
            {"id": s.id, "started_at": as_utc(s.started_at).isoformat(), "ended_at": as_utc(s.ended_at).isoformat() if s.ended_at else None,
             "mode": s.mode, "level": s.level, "activities": s.activities_done, "successes": s.successes, "stars": s.stars,
             "end_reason": s.end_reason, "focus": (s.plan or {}).get("focus_skill"), "summary": s.summary}
            for s in sessions
        ],
    }


@router.get("/{child_id}/path")
def child_path(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """The chapters of the learning path and which one is next for this child."""
    out = learning.learning_path(db, child)
    db.commit()
    return out


@router.delete("/{child_id}/progress", status_code=204)
def reset_progress(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Response:
    db.execute(delete(LessonSession).where(LessonSession.child_id == child.id))
    db.execute(delete(Attempt).where(Attempt.child_id == child.id))
    db.execute(delete(SkillState).where(SkillState.child_id == child.id))
    for table in (LangAttempt, LangItemState, LangSkillState):
        db.execute(delete(table).where(table.child_id == child.id))
    child.current_level = 1
    db.commit()
    return Response(status_code=204)


@router.delete("/{child_id}", status_code=204)
def delete_child(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Response:
    names = list(db.scalars(select(Recording.storage_name).where(Recording.child_id == child.id)))
    db.delete(child)
    db.commit()
    store = get_store()
    for n in names:
        store.delete(n)
    return Response(status_code=204)
