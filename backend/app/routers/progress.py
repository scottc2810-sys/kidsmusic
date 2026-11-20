"""Progress tracker API: spider charts per learning area, the parameter catalogue, assessments.

Parents (and teachers using the parent account) see everything; the child's star map uses the same data.
A teacher or parent assessment counts as the human-reviewed 20 % of an axis and can be withdrawn; an AI
assessment can be rejected when it is wrong. The child can say how a lesson felt (kept separate from scores).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from .. import assessment
from ..db import get_db
from ..models import Child
from ..schemas import Strict
from ..security import client_ip, owned_child, rate_limiter

router = APIRouter(prefix="/api", tags=["progress"])


class HumanAssessmentIn(Strict):
    area: str = Field(max_length=20)
    axis: str = Field(max_length=30)
    score: float | None = Field(default=None, ge=0, le=100)
    note: str = Field(default="", max_length=500)
    source: str = Field(default="parent", pattern="^(parent|teacher)$")


class StatusIn(Strict):
    status: str = Field(pattern="^(active|rejected)$")


class FeelingIn(Strict):
    feeling: str = Field(pattern="^(great|ok|hard)$")
    area: str = Field(default="overall", max_length=20)


FEELING_SCORE = {"great": 100.0, "ok": 60.0, "hard": 25.0}


@router.get("/children/{child_id}/tracker")
def tracker(lens: str | None = None, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """`lens`: listen | speak | read | write | vocabulary | conversation | music | habits: one spider for that skill across areas."""
    out = assessment.tracker(db, child)
    out["lenses"] = [{"id": k, "title": v[0]} for k, v in assessment.LENSES.items()]
    if lens:
        out["lens_view"] = assessment.lens_view(out, lens)
    db.commit()
    return out


class SummaryIn(Strict):
    lens: str | None = Field(default=None, max_length=20)


@router.post("/children/{child_id}/tracker/summary")
def summary(body: SummaryIn, request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """For parents and teachers: what the child understands, what is still developing and the next 2-4 activities.
    The AI teacher writes it when a brain is on for this child; otherwise it is built from the tracker (always works)."""
    rate_limiter.check(f"summary:{child.id}:{client_ip(request)}", 10)
    from .. import memory
    from ..teacher.service import get_teacher

    t = assessment.tracker(db, child)
    plan = assessment.teacher_plan(t, body.lens)
    teacher = get_teacher()
    if teacher.uses_ai(child):
        view = assessment.lens_view(t, body.lens) if body.lens else None
        compact = assessment._compact(t)
        if view:
            compact = {"lens": view["title"], "axes": [{"axis": x["label"], "score": x["final"], "n": x["n"]} for x in view["axes"]]}
        data = teacher.summarize_progress(child, compact, memory.brief(db, child), plan)
        if data:
            plan = {**plan, **data, "source": "ai"}
    db.commit()
    return plan


@router.get("/children/{child_id}/tracker/history")
def tracker_history(area: str = "music", days: int = 90, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[dict]:
    return assessment.history(db, child, area, max(7, min(days, 365)))


@router.post("/children/{child_id}/tracker/assess")
def assess_now(request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Parent asks the AI teacher for a review now (runs in the background; the page polls the tracker)."""
    rate_limiter.check(f"assess:{child.id}:{client_ip(request)}", 6)
    from ..teacher.service import get_teacher

    if not get_teacher().uses_ai(child):
        return {"started": False, "message": "Turn on the AI brain for this child (and choose a brain under 🧠 AI brain) to get the AI teacher's 20 %."}
    assessment.update_after_activity(db, child)
    db.commit()
    started = assessment.request_ai_assessment(child.id, "asked by the parent")
    return {"started": started, "message": "The AI teacher is reviewing; this takes from a few seconds to a minute." if started
            else "A review is already running."}


def _valid_axis(db: Session, child: Child, area: str, axis: str) -> None:
    if area == "overall":
        return
    t = assessment.tracker(db, child, with_catalogue=False)
    ar = next((a for a in t["areas"] if a["id"] == area), None)
    if ar is None or axis not in {x["id"] for x in ar["axes"]}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown area or axis")


@router.post("/children/{child_id}/assessments", status_code=201)
def add_assessment(body: HumanAssessmentIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """A teacher or parent observation: the human-reviewed 20 % of an axis (a score), or a note only."""
    _valid_axis(db, child, body.area, body.axis)
    if body.score is None and not body.note.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Give a score or a note")
    a = assessment.add_human(db, child, body.source, body.area, body.axis, body.score, body.note.strip())
    assessment.update_after_activity(db, child)
    db.commit()
    return assessment._assessment_dict(a)


@router.patch("/children/{child_id}/assessments/{assessment_id}")
def set_assessment_status(assessment_id: int, body: StatusIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Correct an inaccurate assessment: rejected ones stop counting (and can be restored)."""
    a = db.get(assessment.Assessment, assessment_id)
    if a is None or a.child_id != child.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    a.status = body.status
    meta = dict(a.meta or {})
    meta["human_review_status"] = "rejected by parent" if body.status == "rejected" else "reviewed"
    a.meta = meta
    assessment.update_after_activity(db, child)
    db.commit()
    return assessment._assessment_dict(a)


@router.post("/children/{child_id}/feeling", status_code=201)
def feeling(body: FeelingIn, request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """"How did that feel?" from the child: a confidence rating, kept apart from the measured scores.
    'hard' twice in a row makes the next lesson start easier (the engine's fatigue / frustration signal)."""
    rate_limiter.check(f"feeling:{child.id}:{client_ip(request)}", 20)
    a = assessment.Assessment(child_id=child.id, source="child", area=body.area, axis="feeling", score=FEELING_SCORE[body.feeling],
                              confidence=1.0, note=body.feeling, meta={"assessment_method": "child self-report", "input_modality": "interaction",
                                                                       "human_review_status": "child", "assessment_validity": "valid"})
    db.add(a)
    db.commit()
    return {"saved": True}
