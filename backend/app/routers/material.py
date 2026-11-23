"""Language lessons from the family's own material: a photo of the school word list or a book page, a link,
or a few lines from the parent. The AI brain picks the child-sized words and phrases in it, translates them,
and they become a personal conversation topic that works like the built-in ones (listen, speak, read, write,
native or neural voices). Photos are only read, never stored."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from .. import instrument as ins
from ..db import get_db
from ..lang.content import TARGETS
from ..models import Child
from ..security import client_ip, owned_child, rate_limiter

router = APIRouter(prefix="/api", tags=["learn-material"])
MAX_FILES = 4

SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["title", "emoji", "phrases"],
    "properties": {"title": {"type": "string"}, "emoji": {"type": "string"},
                   "phrases": {"type": "array", "items": {"type": "string"}}},
}


@router.post("/children/{child_id}/learn/material", status_code=201)
async def from_material(request: Request, files: list[UploadFile] = File(default=[]), urls: str = Form(default=""),
                        notes: str = Form(default="", max_length=3000), langs: str = Form(...), title: str = Form(default="", max_length=60),
                        child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    from ..parent_chat import add_phrases
    from ..teacher.service import get_teacher

    rate_limiter.check(f"material:{child.id}:{client_ip(request)}", 6)
    codes = [c for c in dict.fromkeys(x.strip() for x in langs.split(",")) if c in TARGETS]
    if not codes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose at least one language to learn")
    teacher = get_teacher()
    if not teacher.uses_ai(child):
        raise HTTPException(status.HTTP_409_CONFLICT, "Reading your material needs the AI brain. Turn it on for this child in Settings first.")
    images = []
    for f in files[:MAX_FILES]:
        data = await f.read(ins.MAX_PHOTO_BYTES + 1)
        if len(data) > ins.MAX_PHOTO_BYTES:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Photo too large (up to 6 MB)")
        mime = ins.sniff_image(data)
        if mime is None:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Please choose JPEG, PNG or WebP photos")
        images.append((data, mime))
    pages = [ins.fetch_page(u.strip()) for u in urls.splitlines() if u.strip().lower().startswith(("http://", "https://"))][:3]
    text = notes.strip() + "\n" + "\n".join(f"{p['title']} :: {p['text'][:3000]}" for p in pages if p["found"])
    if not images and not text.strip():
        unread = [p["reason"] for p in pages if not p["found"]]
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            "Add a photo, a link or a few words" + (f" (the link could not be read: {unread[0]})" if unread else ""))
    prompt = (f"A parent shared their {child.age}-year-old's own learning material (school word list, book page, rhyme, notes) so the "
              f"language lessons can use it. Material text: {json.dumps(text[:6000], ensure_ascii=False)}\n"
              f"{len(images)} photo(s) of the material are attached.\n"
              "Pick up to 6 short, everyday words or phrases from it that a small child can learn and say (2-6 words each, no names of "
              "real people, nothing unsafe). Write them in simple English (they will be translated). Give a short topic title (max 4 words) "
              "and one emoji for the topic.")
    data = teacher.ask_with_images(child, prompt, SCHEMA, images, 1500)
    phrases = [str(p).strip()[:80] for p in (data or {}).get("phrases", []) if str(p).strip()][:6]
    if len(phrases) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Melo could not find enough words in that material. Try a clearer photo or add a few words.")
    name = (title.strip() or str((data or {}).get("title") or "My words"))[:40]
    try:
        out = add_phrases(db, child, name, str((data or {}).get("emoji") or "📚")[:4], phrases, codes)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
    db.commit()
    return {**out, "phrases": phrases, "title": name}
