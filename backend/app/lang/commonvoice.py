"""Sentences read by native speakers from Mozilla Common Voice (Scripted Speech), via Mozilla Data Collective.

Why: Common Voice is the one open source with recorded sentences in almost every Melo language (Hindi,
Marathi, Punjabi, Telugu, Korean, Arabic, Turkish, Cantonese and more), each checked by other volunteers
(up / down votes), many read by several people, with the speaker's self-declared gender.

Rules that come with it:
* the owner's own Mozilla Data Collective account: an API key in ``KM_MDC_API_KEY`` (.env) and the dataset's
  terms accepted on its web page once (the API answers 403 until then; the page is reported back);
* "it is forbidden to re-host or re-share this dataset" and to try to identify speakers: clips are kept on
  this computer only (``noshare``: never copied into an installer), and only a short anonymous id is stored;
* datasets are .tar.gz archives (no partial download): the archive is streamed once, only the chosen clips are
  kept, everything else is discarded. ``KM_CV_MAX_MB`` (default 4000) skips larger archives.

What is kept per language: exact recordings of Melo's own words and phrases (validated: 2+ up votes, no down
votes, up to 3 different speakers) and a pool of 40 short sentences for the ⭐ Challenge packs (``v_`` keys,
used like the OpenSLR pool). The MP3s become 16 kHz WAV (``miniaudio``), so the child's voice is compared with them;
if it cannot decode one, the MP3 is kept unchanged.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import shutil
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from . import native_audio as na

log = logging.getLogger("melo.commonvoice")
API = "https://mozilladatacollective.com/api"
LICENSE = "CC0 1.0"
POOL = 40
# Melo language -> Common Voice locale (Melo's Cantonese is written in traditional characters, as zh-HK is)
LOCALES = {"en": "en", "hi": "hi", "mr": "mr", "fr": "fr", "es": "es", "ar": "ar", "zh": "zh-CN", "yue": "zh-HK", "ko": "ko",
           "ru": "ru", "tr": "tr", "bn": "bn", "pa": "pa-IN", "ta": "ta", "te": "te", "de": "de", "ja": "ja"}
CLIP_TSVS = ("validated.tsv", "train.tsv", "dev.tsv", "test.tsv")  # never other / invalidated / reported


class TermsNeeded(Exception):
    """The owner has to accept this dataset's terms on its page first."""

    def __init__(self, page: str):
        super().__init__(f"accept the terms at {page}")
        self.page = page


def api_key() -> str:
    from ..config import get_settings

    return (getattr(get_settings(), "mdc_api_key", "") or os.environ.get("KM_MDC_API_KEY", "")).strip()


def max_bytes() -> int:
    try:
        return int(os.environ.get("KM_CV_MAX_MB", "4000")) * 1_000_000
    except ValueError:
        return 4_000_000_000


def _api(path: str, params: dict | None = None, post: bool = False, auth: bool = False) -> dict:
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    headers = {**na.UA, "Accept": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {api_key()}"
    if post:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=b"{}" if post else None, headers=headers, method="POST" if post else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 - fixed https host
        return json.loads(r.read())


def datasets_for(lang: str) -> list[dict]:
    """The archives to fetch for a language: the curated female + male segments when they exist (validated only,
    smaller), else the newest official Common Voice Scripted Speech release. Free CC0 datasets only."""
    loc = LOCALES.get(lang)
    if not loc:
        return []
    items = _api("/datasets", {"q": "Common Voice Scripted Speech", "locale": loc, "limit": 50}).get("items", [])
    items = [i for i in items if "Scripted Speech" in i.get("name", "") and i.get("licenseAbbreviation") == "CC0-1.0"
             and not (i.get("pricing") or {}).get("isPaid") and i.get("locale") == loc]
    seg = {g: i for i in items for g in ("Female", "Male") if i["name"].rstrip().endswith(f"({g})")}
    if len(seg) == 2:
        return [seg["Female"], seg["Male"]]
    official = [i for i in items if (i.get("organization") or {}).get("name") == "Mozilla Common Voice"]
    official.sort(key=lambda i: i.get("createdAt", ""), reverse=True)
    return official[:1]


def _download_url(ds: dict) -> str:
    try:
        return _api(f"/datasets/{ds['id']}/download", post=True, auth=True)["downloadUrl"]
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise TermsNeeded(f"https://mozilladatacollective.com/datasets/{ds['id']}") from None
        raise


def _open_stream(url: str):
    return urllib.request.urlopen(urllib.request.Request(url, headers=na.UA), timeout=120)  # noqa: S310 - pre-signed https


# --- reading an archive -----------------------------------------------------------------------------------
def gender_of(value: str) -> str:
    v = (value or "").lower()
    return "female" if v.startswith("female") else "male" if v.startswith("male") else "unknown"


def parse_clips(text: str) -> list[dict]:
    """Validated clip rows: {id, path, text, gender, speaker, votes}. Anonymous: only the first 10 characters
    of the contributor's random id are kept (to tell speakers apart), nothing else about them."""
    out = []
    for row in csv.DictReader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE):
        path, sent = (row.get("path") or "").strip(), (row.get("sentence") or "").strip()
        try:
            up, down = int(row.get("up_votes") or 0), int(row.get("down_votes") or 0)
        except ValueError:
            continue
        if not path.endswith(".mp3") or not sent or up < 2 or down > 0:
            continue
        out.append({"id": path[:-4], "path": path, "text": sent, "gender": gender_of(row.get("gender", "")),
                    "speaker": (row.get("client_id") or "")[:10] or path[:-4], "votes": up})
    return out


def choose(rows: list[dict], lang: str, have: dict, pool: int = POOL) -> dict[str, list[dict]]:
    """{manifest key: [rows]}: exact recordings of Melo's items still short of voices, then the pool."""
    from . import openslr
    from .phrases import ITEMS

    by_norm: dict[str, list[dict]] = {}
    for r in sorted(rows, key=lambda r: -r["votes"]):
        by_norm.setdefault(na._norm(r["text"]), []).append(r)
    out: dict[str, list[dict]] = {}
    for item, w in ITEMS.get(lang, {}).items():
        if na._custom(item):
            continue
        refs = have.get(item, [])
        room = na.PER_ITEM - len(refs)
        speakers = {r.get("speaker") for r in refs}
        picked = []
        for r in by_norm.get(na._norm(w.text), []):
            if len(picked) < room and r["speaker"] not in speakers:
                picked.append(r)
                speakers.add(r["speaker"])
        if picked:
            out[item] = picked
    room = pool - sum(1 for k in have if k.startswith("v_"))
    for clips in openslr.pick_pool(rows, lang, max(0, room)):
        key = f"v_{clips[0]['id']}"
        if key not in have:
            out[key] = clips
    return out


def _to_reference(raw: bytes) -> tuple[bytes, str]:
    """(audio, extension): 16 kHz WAV when an MP3 decoder is installed, else the MP3 unchanged."""
    x = na.decode_mp3(raw)  # miniaudio (MIT licence), in requirements since 2026-11-18
    if x is None or len(x) == 0:
        return raw, "mp3"
    return na.encode_wav(na.normalise(x)), "wav"


def read_archive(stream, data_dir: Path, lang: str, have: dict, ds: dict, spool: Path) -> dict[str, list[dict]]:
    """Stream a .tar.gz once. Clip lists normally come first; clips met before them are spooled to disk and
    the ones not chosen are deleted. Returns {manifest key: [refs]} for the kept clips."""
    rows: list[dict] = []
    wanted: dict[str, tuple[str, dict]] | None = None  # clip path -> (manifest key, row)
    kept: dict[str, bytes] = {}
    spooled: set[str] = set()

    def decide():
        sel = choose(rows, lang, have)
        return {r["path"]: (key, r) for key, rs in sel.items() for r in rs}

    with tarfile.open(fileobj=stream, mode="r|gz") as tf:
        for m in tf:
            if not m.isfile():
                continue
            base = m.name.rsplit("/", 1)[-1]
            if base in CLIP_TSVS:
                seen = {r["path"] for r in rows}
                rows += [r for r in parse_clips(tf.extractfile(m).read().decode("utf-8", "replace")) if r["path"] not in seen]
                wanted = None  # decide again with the new rows
            elif base.endswith(".mp3"):
                if wanted is None and rows:
                    wanted = decide()
                if wanted is not None:
                    if base in wanted:
                        kept[base] = tf.extractfile(m).read()
                elif m.size < 2_000_000:
                    spool.mkdir(parents=True, exist_ok=True)
                    (spool / base).write_bytes(tf.extractfile(m).read())
                    spooled.add(base)
    wanted = decide() if rows else {}
    for base in spooled & set(wanted):
        kept.setdefault(base, (spool / base).read_bytes())
    out: dict[str, list[dict]] = {}
    page = f"https://mozilladatacollective.com/datasets/{ds['id']}"
    for base, raw in kept.items():
        if base not in wanted:
            continue
        key, r = wanted[base]
        try:
            audio, ext = _to_reference(raw)
        except Exception as e:  # noqa: BLE001 - a damaged clip is skipped
            log.warning("Common Voice clip %s failed: %s", base, e)
            continue
        (na.audio_dir(data_dir) / lang).mkdir(parents=True, exist_ok=True)
        name = f"v_{r['id']}.{ext}"[:124]
        (na.audio_dir(data_dir) / lang / name).write_bytes(audio)
        out.setdefault(key, []).append({
            "file": f"{lang}/{name}", "speaker": r["speaker"], "gender": r["gender"], "license": LICENSE, "source": page,
            "attribution": f"Mozilla Common Voice contributors ({ds.get('name', 'Scripted Speech').strip()})", "origin": "commonvoice",
            "noncommercial": False, "noshare": True, "text": r["text"], "votes": r["votes"]})
    return out


def download(data_dir: Path, langs: list[str] | None = None, progress=None) -> dict:
    """Fetch Common Voice recordings for these languages (all Melo languages that Common Voice has by default)."""
    if not api_key():
        return {"error": "Set KM_MDC_API_KEY in .env (a Mozilla Data Collective API key) to use Common Voice."}
    stats: dict[str, dict] = {}
    for lang in langs or list(LOCALES):
        if lang not in LOCALES:
            continue
        try:
            sets = datasets_for(lang)
        except Exception as e:  # noqa: BLE001
            stats[lang] = {"error": f"catalogue unreachable: {e}"}
            continue
        if not sets:
            stats[lang] = {"error": "no Common Voice dataset"}
            continue
        if sum(int(s.get("sizeBytes") or 0) for s in sets) > max_bytes():
            stats[lang] = {"skipped": f"{sum(int(s.get('sizeBytes') or 0) for s in sets) / 1e9:.1f} GB is over KM_CV_MAX_MB",
                           "pages": [f"https://mozilladatacollective.com/datasets/{s['id']}" for s in sets]}
            continue
        st = {"datasets": [s["name"].strip() for s in sets], "new_files": 0, "exact": 0, "pool": 0}
        for ds in sets:
            spool = na.audio_dir(data_dir) / ".cv_spool" / ds["id"]
            try:
                url = _download_url(ds)
                data = {k: dict(v) for k, v in na.manifest(data_dir).items()}
                have = data.setdefault(lang, {})
                with _open_stream(url) as stream:
                    got = read_archive(stream, data_dir, lang, have, ds, spool)
                for key, refs in got.items():
                    have[key] = have.get(key, []) + refs
                    st["new_files"] += len(refs)
                    st["exact" if not key.startswith("v_") else "pool"] += 1
                na._save_manifest(data_dir, data)
            except TermsNeeded as e:
                st.setdefault("terms_needed", []).append(e.page)
            except Exception as e:  # noqa: BLE001 - network gone: keep what was saved, report it
                st["error"] = str(e)[:200]
            finally:
                shutil.rmtree(spool, ignore_errors=True)
        stats[lang] = st
        if progress:
            progress(lang, st)
    return stats


if __name__ == "__main__":  # python -m app.lang.commonvoice [langs...]
    import sys

    from ..config import get_settings

    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.WARNING)
    print(json.dumps(download(get_settings().data_dir, sys.argv[1:] or None, progress=lambda l, s: print(l, s, flush=True)),
                     indent=1, ensure_ascii=False))
