"""Native-speaker recordings: play them in lessons, let parents download or record them, and compare the
child's spoken word with them (the pronunciation score is stored with the attempt; the child's audio is not)."""
from __future__ import annotations

import random
import re
import threading
import wave

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import Field
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..lang import commonvoice, native_audio as na, openslr, tts
from ..lang.phrases import ITEMS
from ..models import Child, LangAttempt, Parent
from ..schemas import Strict
from ..security import client_ip, current_parent, owned_child, rate_limiter

router = APIRouter(prefix="/api", tags=["native-audio"])
MAX_CLIP = 1_500_000  # about 45 s of 16 kHz WAV; a spoken word is far shorter
_job: dict = {"running": False, "done": {}, "error": None}


def known(lang: str, item: str) -> bool:
    """A built-in word or phrase, or a letter of the alphabet (abc00 ...)."""
    from ..lang import alphabet

    return (lang in ITEMS and item in ITEMS[lang]) or alphabet.is_item(lang, item)


def public_refs(lang: str, item: str | None) -> list[dict]:
    """What the app may show and play: no file system paths, the attribution kept."""
    if not item:
        return []
    out = []
    for r in na.references(get_settings().data_dir, lang, item):
        out.append({"url": f"/api/learn/native-file/{'b' if r.get('bundled') else 'd'}/{r['file']}", "gender": r["gender"],
                    "speaker": r.get("speaker"), "license": r.get("license"), "source": r.get("source"), "family": bool(r.get("family")),
                    "origin": r.get("origin", "family" if r.get("family") else "lingualibre")})
    if not out and known(lang, item):
        # no human recording yet: a pretrained neural voice (female and male), so the word is never silent
        for t in tts.slots(get_settings().data_dir, lang, item):
            url = f"/api/learn/tts/{lang}/{item}/{t['gender']}" if t["live"] else f"/api/learn/native-file/{'b' if t.get('bundled') else 'd'}/{t['file']}"
            out.append({"url": url, "gender": t["gender"], "speaker": t["voice"], "license": t["license"], "source": None,
                        "family": False, "origin": "tts", "approx": t.get("approx")})
    return out


@router.get("/learn/tts/{lang}/{item}/{gender}")
def tts_clip(lang: str, item: str, gender: str, request: Request, parent: Parent = Depends(current_parent)) -> FileResponse:
    """A neural-voice clip of a built-in word, recorded on first play and cached (about 1 s the first time)."""
    rate_limiter.check(f"tts:{client_ip(request)}", 120)
    if not known(lang, item) or gender not in tts.GENDERS or tts.is_custom(item):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown word")
    try:
        entry = tts.ensure(get_settings().data_dir, lang, item, gender)
    except tts.Unavailable as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from None
    p = na.file_path(get_settings().data_dir, entry["file"], bundled=bool(entry.get("bundled")))
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such recording")
    return FileResponse(p, media_type="audio/mpeg" if p.suffix == ".mp3" else "audio/wav", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/learn/native-file/{where}/{lang}/{name}")
def native_file(where: str, lang: str, name: str, parent: Parent = Depends(current_parent)) -> FileResponse:
    """Signed-in only: family recordings are a relative's voice and stay private to this install."""
    p = na.file_path(get_settings().data_dir, f"{lang}/{name}", bundled=where == "b")
    if where not in ("b", "d") or p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such recording")
    return FileResponse(p, media_type="audio/mpeg" if p.suffix == ".mp3" else "audio/wav", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/learn/native/{lang}/{item}")
def native_refs(lang: str, item: str, parent: Parent = Depends(current_parent)) -> list[dict]:
    if not known(lang, item):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown word")
    return public_refs(lang, item)


@router.get("/learn/native-coverage")
def coverage(parent: Parent = Depends(current_parent)) -> dict:
    """Per language: how many words and phrases have native recordings (female / male), and which are missing."""
    s = get_settings()
    out = {}
    for lang in na.ISO3:
        items = {i: w for i, w in ITEMS.get(lang, {}).items() if not tts.is_custom(i)}
        refs = {i: na.references(s.data_dir, lang, i) for i in items}
        files = [r for rs in refs.values() for r in rs]
        out[lang] = {"items": sum(1 for v in refs.values() if v), "of": len(items), "files": len(files),
                     "female": sum(1 for r in files if r["gender"] == "female"), "male": sum(1 for r in files if r["gender"] == "male"),
                     "family": sum(1 for r in files if r.get("family")),
                     "synthetic": sum(1 for i in items if not refs[i] and any(not t["live"] for t in tts.slots(s.data_dir, lang, i))),
                     "missing": [{"item": i, "text": w.text, "roman": w.roman, "emoji": w.emoji} for i, w in items.items() if not refs[i]][:80]}
    return {"languages": out, "download": {k: v for k, v in _job.items()}, "source": "Lingua Libre (lingualibre.org, CC BY-SA), Tatoeba (tatoeba.org), Google / OpenSLR (openslr.org, CC BY-SA)"}


class DownloadIn(Strict):
    langs: list[str] = Field(default_factory=list, max_length=25)


@router.post("/learn/native-download")
def start_download(body: DownloadIn, request: Request, parent: Parent = Depends(current_parent)) -> dict:
    """The parent asked to download native recordings (about 50 KB each) from Lingua Libre, Tatoeba and OpenSLR."""
    rate_limiter.check(f"native-dl:{parent.id}:{client_ip(request)}", 4)
    if _job["running"]:
        return {"started": False, "message": "A download is already running."}
    langs = [l for l in body.langs if l in na.ISO3] or list(na.ISO3)
    _job.update(running=True, done={}, error=None)

    def work() -> None:
        try:
            na.download(get_settings().data_dir, langs, progress=lambda lang, st: _job["done"].__setitem__(lang, st))
            na.download_sentences(get_settings().data_dir, langs, progress=lambda lang, st: _job["done"].__setitem__(lang, {**_job["done"].get(lang, {}), "sentences": st}))
            openslr.download(get_settings().data_dir, langs, progress=lambda lang, st: _job["done"].__setitem__(lang, {**_job["done"].get(lang, {}), "openslr": st}))
            if commonvoice.api_key():  # the owner's own Mozilla Data Collective account
                commonvoice.download(get_settings().data_dir, langs, progress=lambda lang, st: _job["done"].__setitem__(lang, {**_job["done"].get(lang, {}), "commonvoice": st}))
            # whatever still has no native speaker: record it now with a neural voice, so lessons work offline too
            tts.prerecord(get_settings().data_dir, [l for l in langs if l in tts.VOICES],
                          progress=lambda lang, st: _job["done"].__setitem__(lang, {**_job["done"].get(lang, {}), "synthetic": st}))
        except Exception as e:  # network gone: say so, keep what was downloaded
            _job["error"] = str(e)[:200]
        finally:
            _job["running"] = False

    threading.Thread(target=work, name="melo-native-download", daemon=True).start()
    return {"started": True, "message": f"Downloading native recordings for {len(langs)} languages in the background."}


@router.post("/children/{child_id}/learn/{lang}/native/{item}", status_code=201)
async def record_reference(lang: str, item: str, request: Request, file: UploadFile = File(...), gender: str = Form(...),
                           speaker: str = Form(default=""), child: Child = Depends(owned_child)) -> dict:
    """A family member who speaks the language records a word: it becomes a reference for pronunciation."""
    rate_limiter.check(f"native-rec:{child.id}:{client_ip(request)}", 30)
    if lang not in ITEMS or item not in ITEMS[lang]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown word")
    if gender not in ("female", "male"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "gender must be female or male")
    data = await file.read(MAX_CLIP + 1)
    if len(data) > MAX_CLIP:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long")
    try:
        entry = na.add_family_recording(get_settings().data_dir, lang, item, data, gender, re.sub(r"[^\w .'-]", "", speaker)[:40])
    except (ValueError, EOFError, wave.Error) as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Not a WAV recording" if isinstance(e, wave.Error) else str(e) or "Not a WAV recording") from None
    return {"saved": True, "gender": entry["gender"], "refs": public_refs(lang, item)}


@router.post("/children/{child_id}/learn/attempts/{attempt_id}/voice")
async def compare_voice(attempt_id: str, request: Request, file: UploadFile = File(...), child: Child = Depends(owned_child),
                        db: Session = Depends(get_db)) -> dict:
    """The child's spoken word (16 kHz WAV from the page) is compared with the native recordings of that word.
    Only the score is kept with the attempt; the audio itself is not stored."""
    rate_limiter.check(f"voice:{child.id}:{client_ip(request)}", 60)
    if not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Microphone input is not allowed for this child")
    attempt = db.get(LangAttempt, attempt_id)
    if attempt is None or attempt.child_id != child.id or attempt.activity != "say_word":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Speaking activity not found")
    if attempt.outcome is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This activity was already answered")
    data = await file.read(MAX_CLIP + 1)
    if len(data) > MAX_CLIP:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long")
    from ..audio.pronounce import score

    s = get_settings()
    item = (attempt.spec or {}).get("item")
    refs = [x for x in (na.load_reference(s.data_dir, r) for r in na.references(s.data_dir, attempt.lang, item)) if x is not None]
    if not refs:
        result = {"score": None, "reason": "no native recording of this word yet"}
    else:
        others = [i for i in ITEMS[attempt.lang] if i != item and na.references(s.data_dir, attempt.lang, i)]
        rng = random.Random(attempt_id)
        distractors = [x for i in rng.sample(others, min(4, len(others)))
                       for x in [na.load_reference(s.data_dir, na.references(s.data_dir, attempt.lang, i)[0])] if x is not None]
        try:
            child_audio, rate = na.decode_wav(data)
        except Exception:  # noqa: BLE001 - not a WAV: never the child's fault
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Not a WAV recording") from None
        clip = na.trim(na.resample(child_audio, rate))
        result = score(clip, refs, distractors) if len(clip) > na.RATE * 0.15 else {"score": None, "reason": "nothing heard"}
        result["references"] = len(refs)
    attempt.response = {**(attempt.response or {}), "pronunciation": result}
    db.commit()
    return result
