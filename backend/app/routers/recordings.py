from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import memory
from ..audio.analysis import AudioError, analyze_recording, decode_wav
from ..config import get_settings
from ..curriculum import SONGS
from ..db import get_db, session_factory
from ..models import Child, Recording
from ..schemas import RecordingOut
from ..security import owned_child
from ..storage import get_store
from ..teacher.service import get_teacher

log = logging.getLogger("melo.recordings")
router = APIRouter(prefix="/api/children/{child_id}/recordings", tags=["recordings"])


def _owned_recording(recording_id: str, child: Child, db: Session) -> Recording:
    rec = db.get(Recording, recording_id)
    if rec is None or rec.child_id != child.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recording not found")
    return rec


def run_analysis(recording_id: str) -> None:
    """Background job: decrypt, analyse, write feedback. Uses its own DB session."""
    db = session_factory()()
    try:
        rec = db.get(Recording, recording_id)
        if rec is None:
            return
        child = db.get(Child, rec.child_id)
        if child is None:
            return
        try:
            data = get_store().load(rec.storage_name)
            analysis = analyze_recording(data, rec.song_hint, get_settings().max_recording_seconds)
        except (AudioError, FileNotFoundError) as exc:
            rec.status, rec.error = "failed", str(exc)[:200]
            db.commit()
            return
        song_id = (analysis.get("song_match") or {}).get("song_id")
        previous = None
        if song_id:
            for r in db.scalars(select(Recording).where(Recording.child_id == child.id, Recording.status == "analyzed",
                                                        Recording.id != rec.id).order_by(Recording.created_at.desc())):
                if (r.analysis.get("song_match") or {}).get("song_id") == song_id:
                    previous = r.analysis
                    break
        rec.analysis = analysis
        rec.status = "analyzed"
        db.commit()  # release the write lock before the AI call
        feedback = get_teacher().recording_feedback(child, analysis, previous)
        feedback["child_message"] = feedback.get("child_message", "").replace("{name}", child.name)
        if previous is not None:
            feedback["compared_with_previous"] = {
                "note_accuracy_before": previous.get("note_accuracy"), "note_accuracy_now": analysis.get("note_accuracy"),
                "rhythm_before": previous.get("rhythm_stability"), "rhythm_now": analysis.get("rhythm_stability"),
            }
        rec.feedback = feedback
        memory.record_recording(db, child, rec)
        db.commit()
    except Exception:  # never leave a recording stuck in "pending"
        log.exception("analysis failed for %s", recording_id)
        db.rollback()
        rec = db.get(Recording, recording_id)
        if rec is not None:
            rec.status, rec.error = "failed", "Unexpected analysis error"
            db.commit()
    finally:
        db.close()


@router.post("", response_model=RecordingOut, status_code=202)
def upload_recording(
    background: BackgroundTasks,
    child: Child = Depends(owned_child),
    file: UploadFile = File(...),
    title: str = Form(default="Practice", max_length=80),
    song_hint: str | None = Form(default=None, max_length=40),
    db: Session = Depends(get_db),
) -> Recording:
    s = get_settings()
    if not child.consent_recording:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recording is turned off for this child. A parent can enable it in settings.")
    limit = s.max_upload_mb * 1024 * 1024
    chunks, size = [], 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File is larger than {s.max_upload_mb} MB")
        chunks.append(chunk)
    data = b"".join(chunks)
    try:
        x, sr = decode_wav(data)
    except AudioError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from None
    duration = len(x) / sr
    if duration < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Recording is too short")
    if duration > s.max_recording_seconds + 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Recordings can be up to {s.max_recording_seconds // 60} minutes")
    del x
    name = get_store().save(data)
    rec = Recording(child_id=child.id, title=" ".join(title.split())[:80] or "Practice",
                    song_hint=song_hint if song_hint in SONGS else None, storage_name=name,
                    duration_seconds=round(duration, 1), sample_rate=sr, size_bytes=size, status="pending")
    db.add(rec)
    db.commit()
    background.add_task(run_analysis, rec.id)
    return rec


@router.get("", response_model=list[RecordingOut])
def list_recordings(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[Recording]:
    return list(db.scalars(select(Recording).where(Recording.child_id == child.id).order_by(Recording.created_at.desc()).limit(100)))


@router.get("/{recording_id}", response_model=RecordingOut)
def get_recording(recording_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Recording:
    return _owned_recording(recording_id, child, db)


@router.get("/{recording_id}/audio")
def recording_audio(recording_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Response:
    rec = _owned_recording(recording_id, child, db)
    try:
        data = get_store().load(rec.storage_name)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audio file is missing") from None
    return Response(data, media_type="audio/wav", headers={"Cache-Control": "no-store", "Content-Disposition": "inline"})


@router.post("/{recording_id}/reanalyze", response_model=RecordingOut, status_code=202)
def reanalyze(recording_id: str, background: BackgroundTasks, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Recording:
    rec = _owned_recording(recording_id, child, db)
    if rec.status == "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Analysis is already running")
    rec.status, rec.error = "pending", None
    db.commit()
    background.add_task(run_analysis, rec.id)
    return rec


@router.delete("/{recording_id}", status_code=204)
def delete_recording(recording_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Response:
    rec = _owned_recording(recording_id, child, db)
    name = rec.storage_name
    memory.forget_recording(db, rec.id)
    db.delete(rec)
    db.commit()
    get_store().delete(name)
    return Response(status_code=204)


@router.delete("", status_code=204)
def delete_all_recordings(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> Response:
    recs = list(db.scalars(select(Recording).where(Recording.child_id == child.id)))
    names = [r.storage_name for r in recs]
    for r in recs:
        memory.forget_recording(db, r.id)
        db.delete(r)
    db.commit()
    for n in names:
        get_store().delete(n)
    return Response(status_code=204)
