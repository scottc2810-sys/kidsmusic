"""The child's own instrument: the parent describes it (form, photos, product links), Melo reads them and
suggests details, lessons use it. Without a profile the standard on-screen piano lessons are used."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import instrument as ins
from ..config import get_settings
from ..db import get_db
from ..models import Child, InstrumentProfile
from ..schemas import Strict
from ..security import client_ip, owned_child, rate_limiter

router = APIRouter(prefix="/api", tags=["instrument"])


class ProfileIn(Strict):
    kind: str = "keyboard"
    name: str = Field(default="", max_length=80)
    keys: int | None = Field(default=None, ge=2, le=88)
    first_key: str = Field(default="C", pattern=r"^[A-G][#b]?$")
    labels: str = "none"
    features: dict = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list, max_length=ins.MAX_SOURCES)
    notes: str = Field(default="", max_length=4000)
    summary: str = Field(default="", max_length=300)
    tips: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in ins.KINDS:
            raise ValueError("unknown instrument kind")
        return v

    @field_validator("labels")
    @classmethod
    def _labels(cls, v: str) -> str:
        if v not in ins.LABELS:
            raise ValueError("unknown key labels")
        return v

    @field_validator("sources")
    @classmethod
    def _sources(cls, v: list[str]) -> list[str]:
        out = []
        for u in v:
            u = u.strip()
            if not u:
                continue
            if not u.lower().startswith(("http://", "https://")) or len(u) > 2000:
                raise ValueError("links must start with http:// or https://")
            out.append(u)
        return out

    @field_validator("features")
    @classmethod
    def _features(cls, v: dict) -> dict:
        allowed = {"mic", "record", "lights", "demo_songs", "teach_mode"}
        out = {k: v[k] for k in v if k in allowed}
        if "demo_songs" in out:
            out["demo_songs"] = [str(x)[:60] for x in (out["demo_songs"] or [])][:12]
        for k in ("mic", "record", "lights", "teach_mode"):
            if k in out:
                out[k] = bool(out[k])
        return out


def _profile(db: Session, child: Child) -> InstrumentProfile | None:
    return db.scalar(select(InstrumentProfile).where(InstrumentProfile.child_id == child.id))


@router.get("/instrument-kinds")
def kinds() -> dict:
    return {"kinds": [{"id": k, **{x: v[x] for x in ("label", "emoji", "layout", "keys", "first")}, "stand_in": bool(v.get("stand_in"))}
                      for k, v in ins.KINDS.items()], "labels": list(ins.LABELS)}


@router.get("/children/{child_id}/instrument")
def get_profile(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    return ins.public(_profile(db, child))


@router.put("/children/{child_id}/instrument")
def save_profile(body: ProfileIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    p = _profile(db, child)
    if p is None:
        p = InstrumentProfile(child_id=child.id, photos=[])
        db.add(p)
    old = {s["url"]: s for s in (p.sources or [])}
    p.kind, p.name, p.keys, p.first_key, p.labels = body.kind, body.name.strip(), body.keys, body.first_key, body.labels
    p.features, p.notes, p.summary, p.tips = body.features, body.notes, body.summary.strip(), [t.strip()[:240] for t in body.tips if t.strip()]
    p.sources = [old.get(u, {"url": u, "title": "", "found": None}) for u in body.sources]
    child.instrument = body.kind  # the AI teacher and reports mention the real instrument
    db.commit()
    db.refresh(p)
    return ins.public(p)


@router.delete("/children/{child_id}/instrument", status_code=204)
def reset_profile(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> None:
    """Back to the standard lessons (photos are deleted too)."""
    p = _profile(db, child)
    if p is not None:
        d = ins.photo_dir(get_settings().data_dir, child.id)
        for ph in p.photos or []:
            (d / ph["file"]).unlink(missing_ok=True)
        db.delete(p)
    child.instrument = "piano"
    db.commit()


@router.post("/children/{child_id}/instrument/photos", status_code=201)
async def add_photo(request: Request, file: UploadFile = File(...), child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    rate_limiter.check(f"inst-photo:{child.id}:{client_ip(request)}", 20)
    p = _profile(db, child)
    if p is None:
        p = InstrumentProfile(child_id=child.id, photos=[])
        db.add(p)
        db.flush()
    if len(p.photos or []) >= ins.MAX_PHOTOS:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Up to {ins.MAX_PHOTOS} photos; remove one first")
    data = await file.read(ins.MAX_PHOTO_BYTES + 1)
    if len(data) > ins.MAX_PHOTO_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Photo too large (up to 6 MB)")
    mime = ins.sniff_image(data)
    if mime is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Please choose a JPEG, PNG or WebP photo")
    pid = secrets.token_hex(8)
    d = ins.photo_dir(get_settings().data_dir, child.id)
    d.mkdir(parents=True, exist_ok=True)
    name = f"{pid}.{ins.EXT[mime]}"
    (d / name).write_bytes(data)
    p.photos = [*(p.photos or []), {"id": pid, "file": name, "mime": mime}]
    db.commit()
    db.refresh(p)
    return ins.public(p)


@router.get("/children/{child_id}/instrument/photos/{photo_id}")
def get_photo(photo_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> FileResponse:
    p = _profile(db, child)
    ph = next((x for x in (p.photos if p else []) or [] if x["id"] == photo_id), None)
    f = ins.photo_dir(get_settings().data_dir, child.id) / ph["file"] if ph else None
    if f is None or not f.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such photo")
    return FileResponse(f, media_type=ph["mime"], headers={"Cache-Control": "private, max-age=3600"})


@router.delete("/children/{child_id}/instrument/photos/{photo_id}")
def delete_photo(photo_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    p = _profile(db, child)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such photo")
    keep = [x for x in p.photos or [] if x["id"] != photo_id]
    for x in p.photos or []:
        if x["id"] == photo_id:
            (ins.photo_dir(get_settings().data_dir, child.id) / x["file"]).unlink(missing_ok=True)
    p.photos = keep
    db.commit()
    db.refresh(p)
    return ins.public(p)


@router.post("/children/{child_id}/instrument/analyze")
def analyze(request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Read the saved links, notes and photos and suggest the details. Nothing is changed until the parent saves."""
    rate_limiter.check(f"inst-analyze:{child.id}:{client_ip(request)}", 6)
    p = _profile(db, child)
    if p is None or not (p.photos or p.sources or (p.notes or "").strip() or p.name):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Add a photo, a link or a few words about the instrument first")
    out = ins.analyze(child, p, get_settings().data_dir)
    found = {s["url"]: s for s in out["sources"]}
    p.sources = [{"url": s["url"], "title": found.get(s["url"], {}).get("title", ""), "found": found.get(s["url"], {}).get("found")}
                 for s in p.sources or []]
    p.analyzed_at = datetime.now(timezone.utc)
    db.commit()
    return out
