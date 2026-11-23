"""Native-speaker pronunciations for the language lessons.

Instead of only a synthetic voice, Melo plays real recordings by native speakers from Lingua Libre
(https://lingualibre.org), stored on Wikimedia Commons under free licences (mostly CC BY-SA 4.0). For every
word or phrase up to 3 recordings are kept, mixing female and male speakers and different people, so a child
hears natural pronunciation and accents. The recordings are also the reference when the child speaks: the
child's voice is compared with them (see app/audio/pronounce.py).

Why Lingua Libre and not videos: every recording there is one word or phrase by a declared native speaker,
with the speaker's gender and region, under a licence that allows reuse with attribution. Cutting audio out
of online videos would break those sites' terms and the speakers' copyright.

Files are downloaded only when a parent asks (or the developer runs `python -m app.lang.native_audio`),
converted to 16 kHz mono WAV, trimmed and normalised, and stored in <data dir>/native_audio with a
manifest that keeps the attribution (speaker, licence, source page) shown in the app.
"""
from __future__ import annotations

import io
import json
import logging
import re
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
import wave
from pathlib import Path

import numpy as np

log = logging.getLogger("melo.native_audio")

SPARQL = "https://lingualibre.org/bigdata/namespace/wdq/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "MeloMusicTeacher/1.4 (children's language and music learning app)"}
MIN_GAP = 1.5  # seconds between requests to Wikimedia / Lingua Libre: one at a time, never a burst
MAX_WAIT = 900  # longest "retry after" we wait for before giving up on this run
_last_request = [0.0]


def user_agent() -> dict:
    """Wikimedia asks automated clients to give a contact (a web page or an email) in the User-Agent.
    Set KM_WIKIMEDIA_CONTACT to add it; it is never filled in automatically."""
    from ..config import get_settings

    contact = (getattr(get_settings(), "wikimedia_contact", "") or "").strip()
    if contact and "@" not in contact and not contact.startswith("http"):
        # a plain Wikimedia username: point to its public user page, as the bot policy suggests
        contact = "https://commons.wikimedia.org/wiki/User:" + urllib.parse.quote(contact.replace(" ", "_"))
    return {"User-Agent": f"MeloMusicTeacher/1.4 (children's language and music learning app{'; ' + contact if contact else ''})"}


class RateLimited(Exception):
    pass


def _fetch(url: str, accept: str = "*/*", timeout: float = 60, max_bytes: int | None = None) -> bytes:
    """GET politely: spaced out, and on 429 / 503 wait as long as the server asks (up to MAX_WAIT)."""
    import urllib.error

    for attempt in range(4):
        gap = MIN_GAP - (time.monotonic() - _last_request[0])
        if gap > 0:
            time.sleep(gap)
        _last_request[0] = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={**user_agent(), "Accept": accept})
            with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - fixed https endpoints
                return r.read(max_bytes + 1) if max_bytes else r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 3:
                raise
            wait = int(e.headers.get("Retry-After") or 30 * (attempt + 1))
            if wait > MAX_WAIT:
                raise RateLimited(f"the server asked to wait {wait} s; try again later") from None
            log.warning("Wikimedia asked to slow down: waiting %s s", wait)
            time.sleep(wait)
    raise RateLimited("too many retries")
PER_ITEM = 3


def _custom(item: str) -> bool:
    """A parent's own phrase ("c" + 12 hex). Not every id starting with "c" (the word "cat")."""
    return bool(re.fullmatch(r"c[0-9a-f]{12}", item))


RATE = 16000
GENDER = {"Q16": "male", "Q17": "female"}
# Melo language code -> ISO 639-3 code used by Lingua Libre
ISO3 = {"en": "eng", "hi": "hin", "mr": "mar", "fr": "fra", "es": "spa", "ar": "ara", "zh": "cmn", "yue": "yue", "ko": "kor",
        "ru": "rus", "tr": "tur", "sa": "san", "gu": "guj", "bn": "ben", "pa": "pan", "ta": "tam", "te": "tel", "kn": "kan",
        "de": "deu", "ja": "jpn"}


def audio_dir(data_dir: Path) -> Path:
    return Path(data_dir) / "native_audio"


def _manifest_path(data_dir: Path) -> Path:
    return audio_dir(data_dir) / "manifest.json"


_cache: dict[str, dict] = {}
_lock = threading.Lock()


def manifest(data_dir: Path) -> dict:
    """{lang: {item: [{file, speaker, gender, license, source, text}]}} (cached; refreshed after a download)."""
    key = str(data_dir)
    with _lock:
        if key not in _cache:
            try:
                _cache[key] = json.loads(_manifest_path(data_dir).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                _cache[key] = {}
        return _cache[key]


def bundled_dir() -> Path:
    """Recordings shipped inside the installed app (read-only), next to the ones downloaded on this computer."""
    from ..config import BUNDLE_DIR

    return Path(BUNDLE_DIR) / "native_audio"


def _bundled() -> dict:
    key = "__bundle__"
    with _lock:
        if key not in _cache:
            try:
                _cache[key] = json.loads((bundled_dir() / "manifest.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                _cache[key] = {}
        return _cache[key]


def references(data_dir: Path, lang: str, item: str) -> list[dict]:
    """Native recordings of one word or phrase: family recordings first, then this computer's, then bundled ones."""
    own = manifest(data_dir).get(lang, {}).get(item, [])
    shipped = [{**r, "bundled": True} for r in _bundled().get(lang, {}).get(item, []) if r["file"] not in {o["file"] for o in own}]
    refs = own + shipped
    return sorted(refs, key=lambda r: 0 if r.get("family") else 1)[:PER_ITEM + 2]


def file_path(data_dir: Path, rel: str, bundled: bool = False) -> Path | None:
    """The WAV for a manifest entry, only inside the audio folders (no path tricks)."""
    if not re.fullmatch(r"[a-z]{2,3}/[A-Za-z0-9_.\-]{1,120}\.(wav|mp3)", rel):
        return None
    root = bundled_dir() if bundled else audio_dir(data_dir)
    p = (root / rel).resolve()
    return p if p.is_file() and root.resolve() in p.parents else None


def add_family_recording(data_dir: Path, lang: str, item: str, wav: bytes, gender: str, speaker: str) -> dict:
    """A parent, grandparent or teacher who speaks the language records the word: it becomes a reference too."""
    x, rate = decode_wav(wav)
    x = normalise(trim(resample(x, rate)))
    if len(x) < RATE * 0.2:
        raise ValueError("The recording is too short or silent")
    if len(x) > RATE * 8:
        raise ValueError("Please record only the word or phrase (up to 8 seconds)")
    data = {k: dict(v) for k, v in manifest(data_dir).items()}
    refs = data.setdefault(lang, {}).setdefault(item, [])
    refs[:] = [r for r in refs if not (r.get("family") and r.get("gender") == gender)]  # one family voice per gender, replaced
    name = f"{item}-family-{gender[0]}.wav"
    (audio_dir(data_dir) / lang).mkdir(parents=True, exist_ok=True)
    (audio_dir(data_dir) / lang / name).write_bytes(encode_wav(x))
    entry = {"file": f"{lang}/{name}", "speaker": speaker or "family", "gender": gender, "license": "family recording (stays on this computer)",
             "source": None, "family": True, "seconds": round(len(x) / RATE, 2)}
    refs.insert(0, entry)
    _save_manifest(data_dir, data)
    return entry


def decode_mp3(data: bytes) -> np.ndarray | None:
    """16 kHz mono samples of an MP3, in memory only (the file itself stays unchanged, as "no derivatives"
    licences ask). None when the optional miniaudio package is missing or the file is damaged."""
    try:
        import miniaudio
    except ImportError:
        return None
    try:
        snd = miniaudio.decode(data, output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=RATE)
    except Exception:  # noqa: BLE001 - miniaudio.DecodeError and friends
        return None
    return trim(np.frombuffer(snd.samples.tobytes(), dtype="<i2").astype(np.float32) / 32768.0)


def load_reference(data_dir: Path, ref: dict) -> np.ndarray | None:
    """Decoded audio for comparison: WAV (Lingua Libre, OpenSLR, Common Voice, family) and, with miniaudio, MP3 (Tatoeba)."""
    p = file_path(data_dir, ref["file"], bool(ref.get("bundled")))
    if p is None:
        return None
    try:
        if p.suffix == ".mp3":
            return decode_mp3(p.read_bytes())
        x, rate = decode_wav(p.read_bytes())
        return resample(x, rate)
    except (OSError, ValueError, wave.Error):
        return None


def _save_manifest(data_dir: Path, data: dict, merge: bool = True) -> None:
    """Write the manifest. With `merge` (default), entries saved meanwhile by another process (a download running
    next to the app) are kept: per word, the list being saved wins, other words stay."""
    p = _manifest_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    if merge and data:
        try:
            disk = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            disk = {}
        for lang, items in data.items():
            disk.setdefault(lang, {}).update(items)
        data = disk
    tmp = p.with_suffix(f".{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)
    with _lock:
        _cache[str(data_dir)] = data


# --- finding recordings ---------------------------------------------------------------------------------
def variants(text: str) -> list[str]:
    """How a word may be written as a Lingua Libre transcription: as is, without end punctuation, lower case."""
    t = unicodedata.normalize("NFC", text.strip())
    bare = re.sub(r"[\s]*[.!?。！？，,;:।؟¿¡]+$", "", t).strip().lstrip("¿¡")
    out = [t, bare, bare.lower(), bare[:1].upper() + bare[1:]]
    return list(dict.fromkeys(x for x in out if x))


def _http_json(url: str, params: dict, accept: str = "application/json", timeout: float = 60) -> dict:
    return json.loads(_fetch(url + "?" + urllib.parse.urlencode(params), accept, timeout))


P = "https://lingualibre.org/prop/direct/"


def _sparql(q: str) -> list[dict]:
    return _http_json(SPARQL, {"query": q, "format": "json"}, "application/sparql-results+json")["results"]["bindings"]


def language_entity(iso3: str) -> str | None:
    rows = _sparql(f'SELECT ?lang WHERE {{ ?lang <{P}P13> "{iso3}" }} LIMIT 1')
    return rows[0]["lang"]["value"] if rows else None


def find(iso3: str, texts: list[str], chunk: int = 40) -> list[dict]:
    """Every Lingua Libre recording in this language whose transcription is one of `texts`.
    The transcriptions are matched first and the language is a constant: that keeps each query under a second."""
    lang = language_entity(iso3)
    if not lang:
        return []
    out = []
    for i in range(0, len(texts), chunk):
        values = " ".join(json.dumps(t, ensure_ascii=False) for t in texts[i:i + chunk])
        rows = _sparql(f"""SELECT ?rec ?file ?text ?speaker ?name ?gender WHERE {{
          VALUES ?text {{ {values} }}
          ?rec <{P}P7> ?text ; <{P}P4> <{lang}> ; <{P}P3> ?file ; <{P}P5> ?speaker .
          OPTIONAL {{ ?speaker <{P}P8> ?gender }}
          OPTIONAL {{ ?speaker <{P}P11> ?name }}
        }}""")
        out.extend(_row(r) for r in rows)
    return out


def _row(r: dict) -> dict:
    return {"text": r["text"]["value"], "file": urllib.parse.unquote(r["file"]["value"].rsplit("/", 1)[-1]),
            "speaker_id": r["speaker"]["value"].rsplit("/", 1)[-1], "speaker": r.get("name", {}).get("value", "native speaker"),
            "gender": GENDER.get(r.get("gender", {}).get("value", "").rsplit("/", 1)[-1], "unknown")}


def _unused(rows: list[dict]) -> list[dict]:  # kept for readability of the old single-query form
    out = []
    for r in rows:
        out.append({"text": r["text"]["value"], "file": urllib.parse.unquote(r["file"]["value"].rsplit("/", 1)[-1]),
                    "speaker_id": r["speaker"]["value"].rsplit("/", 1)[-1], "speaker": r.get("name", {}).get("value", "native speaker"),
                    "gender": GENDER.get(r.get("gender", {}).get("value", "").rsplit("/", 1)[-1], "unknown")})
    return out


def choose(recs: list[dict], n: int = PER_ITEM) -> list[dict]:
    """Up to n recordings by different speakers, female and male mixed (one of each first when both exist)."""
    by_speaker: dict[str, dict] = {}
    for r in recs:
        by_speaker.setdefault(r["speaker_id"], r)
    pool = list(by_speaker.values())
    picked: list[dict] = []
    for g in ("female", "male"):
        hit = next((r for r in pool if r["gender"] == g and r not in picked), None)
        if hit:
            picked.append(hit)
    for r in pool:
        if len(picked) >= n:
            break
        if r not in picked:
            picked.append(r)
    return picked[:n]


# --- audio --------------------------------------------------------------------------------------------------
def decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(data)) as w:
        ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if width == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 4:
        x = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    elif width == 1:
        x = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    else:
        raise ValueError(f"unsupported WAV sample width {width}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, rate


def resample(x: np.ndarray, rate: int, target: int = RATE) -> np.ndarray:
    if rate == target or len(x) == 0:
        return x
    n = int(round(len(x) * target / rate))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def trim(x: np.ndarray, rate: int = RATE, pad: float = 0.08) -> np.ndarray:
    """Cut the silence before and after the word (keeps a short natural margin)."""
    if len(x) == 0:
        return x
    frame = int(0.02 * rate)
    energy = np.array([np.sqrt(np.mean(x[i:i + frame] ** 2)) for i in range(0, max(1, len(x) - frame), frame)])
    if energy.size == 0 or energy.max() <= 0:
        return x
    on = np.where(energy > max(0.02 * energy.max(), 1e-4))[0]
    if on.size == 0:
        return x
    a = max(0, on[0] * frame - int(pad * rate))
    b = min(len(x), (on[-1] + 1) * frame + int(pad * rate))
    return x[a:b]


def normalise(x: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    return x if peak <= 0 else (x * (0.89 / peak)).astype(np.float32)


def encode_wav(x: np.ndarray, rate: int = RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def _commons_info(filename: str) -> dict:
    d = _http_json(COMMONS_API, {"action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "titles": f"File:{filename}", "format": "json"})
    page = next(iter(d["query"]["pages"].values()))
    info = (page.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata", {})
    return {"url": info.get("url"), "size": info.get("size"), "license": meta.get("LicenseShortName", {}).get("value", "CC BY-SA 4.0"),
            "page": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(filename)}"}


def download(data_dir: Path, langs: list[str] | None = None, progress=None, max_bytes: int = 2_000_000) -> dict:
    """Find and store up to 3 native recordings per word and phrase. Safe to run again: keeps what it has."""
    from .phrases import ITEMS

    data = {k: dict(v) for k, v in manifest(data_dir).items()}
    stats: dict[str, dict] = {}
    for lang in langs or list(ISO3):
        if lang not in ITEMS or lang not in ISO3:
            continue
        words = ITEMS[lang]
        want: dict[str, str] = {}
        for item, w in words.items():
            if _custom(item):  # custom phrases of one child are fetched for that child only
                continue
            for v in variants(w.text):
                want.setdefault(v, item)
        try:
            recs = find(ISO3[lang], list(want))
        except RateLimited as e:
            stats[lang] = {"error": str(e)}
            _save_manifest(data_dir, data)
            return stats  # the servers asked us to stop for now: keep what we have, resume later
        except Exception as e:  # network, endpoint busy: report and go on with the next language
            log.warning("Lingua Libre search failed for %s: %s", lang, e)
            stats[lang] = {"error": str(e)[:200]}
            continue
        by_item: dict[str, list[dict]] = {}
        for r in recs:
            by_item.setdefault(want[r["text"]], []).append(r)
        lang_dir = audio_dir(data_dir) / lang
        lang_dir.mkdir(parents=True, exist_ok=True)
        have = data.setdefault(lang, {})
        got = 0
        for item, rs in by_item.items():
            existing = have.get(item, [])
            if len(existing) >= PER_ITEM:
                continue
            for r in choose(rs):
                if any(e.get("commons") == r["file"] for e in existing) or len(existing) >= PER_ITEM:
                    continue
                try:
                    info = _commons_info(r["file"])
                    if not info["url"] or (info.get("size") or 0) > max_bytes:
                        continue
                    raw = _fetch(info["url"].split("?")[0], "audio/*", 60, max_bytes)
                    x, rate = decode_wav(raw)
                    x = normalise(trim(resample(x, rate)))
                    if len(x) < RATE * 0.15:
                        continue
                    name = f"{item}-{len(existing)}-{r['gender'][0]}.wav"
                    (lang_dir / name).write_bytes(encode_wav(x))
                    existing.append({"file": f"{lang}/{name}", "speaker": r["speaker"], "gender": r["gender"], "license": info["license"],
                                     "source": info["page"], "commons": r["file"], "text": r["text"], "seconds": round(len(x) / RATE, 2)})
                    got += 1
                except RateLimited as e:  # asked to stop for now: keep everything saved so far, resume next time
                    if existing:
                        have[item] = existing
                    _save_manifest(data_dir, data)
                    stats[lang] = {"items": len(have), "of": len(words), "new_files": got, "error": str(e)}
                    return stats
                except Exception as e:  # one bad file never stops the rest
                    log.warning("skipped %s: %s", r["file"], e)
            if existing:
                have[item] = existing
        _save_manifest(data_dir, data)
        stats[lang] = {"items": len(have), "of": len(words), "new_files": got, "found": len(recs)}
        if progress:
            progress(lang, stats[lang])
    return stats


# --- whole sentences from Tatoeba (tatoeba.org): sentence recordings by native speakers --------------------
# Lingua Libre has mostly single words; Tatoeba has recorded sentences. Its export lists every recording with
# the contributor and the licence. Recordings without a licence ("for Tatoeba only") are skipped. Many are
# CC BY-NC-ND (non-commercial, no derivatives): they are stored byte-for-byte as published (MP3), only played,
# credited, and not put in installers (see packaging/melo.spec). Tatoeba does not record the speaker's gender.
TATOEBA_API = "https://api.tatoeba.org/v1/sentences"
TATOEBA_EXPORT = "https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2"
OPEN_LICENSES = ("CC BY 4.0", "CC BY-SA 4.0", "CC0 1.0", "CC BY-NC 4.0", "CC BY-NC-ND 3.0")


def _tatoeba_audio_index(data_dir: Path) -> dict[str, list[tuple[str, str, str, str]]]:
    """sentence id -> [(audio id, contributor, licence, attribution url)] for openly licensed recordings."""
    import tarfile

    path = audio_dir(data_dir) / "tatoeba" / "sentences_with_audio.csv"
    if not path.is_file() or time.time() - path.stat().st_mtime > 30 * 86400:
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = _fetch(TATOEBA_EXPORT, "*/*", 180)
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:bz2") as t:
            member = next(m for m in t.getmembers() if m.isfile() and m.name.endswith(".csv"))
            path.write_bytes(t.extractfile(member).read())
    out: dict[str, list] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 4 and parts[3] in OPEN_LICENSES:
            out.setdefault(parts[0], []).append((parts[1], parts[2], parts[3], parts[4] if len(parts) > 4 else ""))
    return out


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFKC", text).casefold()
    # drop punctuation and spaces but keep combining marks: "ಕಾಲು" (leg) and "ಕಲು" are different words
    return "".join(c for c in t if unicodedata.category(c)[0] in "LMN")


def find_sentence(iso3: str, text: str) -> list[str]:
    """Tatoeba sentence ids whose text is exactly this sentence (ignoring case and punctuation)."""
    d = _http_json(TATOEBA_API, {"lang": iso3, "q": f'"{text}"', "sort": "relevance", "limit": 20})
    want = _norm(text)
    return [str(s["id"]) for s in d.get("data", []) if _norm(s.get("text", "")) == want]


def download_sentences(data_dir: Path, langs: list[str] | None = None, progress=None, only_missing_words: bool = True) -> dict:
    """Recordings of the phrases and sentences (and of words Lingua Libre lacks) from Tatoeba, up to 3 each."""
    from .phrases import ITEMS

    index = _tatoeba_audio_index(data_dir)
    data = {k: dict(v) for k, v in manifest(data_dir).items()}
    stats: dict[str, dict] = {}
    for lang in langs or list(ISO3):
        if lang not in ITEMS:
            continue
        have = data.setdefault(lang, {})
        got, searched = 0, 0
        for item, w in ITEMS[lang].items():
            if _custom(item) or len(have.get(item, [])) >= PER_ITEM:
                continue
            is_sentence = item.startswith(("p_", "s_")) or " " in w.text
            if not is_sentence and not only_missing_words:
                continue
            if not is_sentence and have.get(item):
                continue
            try:
                searched += 1
                ids = find_sentence(ISO3[lang], w.text)
            except RateLimited as e:
                _save_manifest(data_dir, data)
                stats[lang] = {"error": str(e), "new_files": got}
                return stats
            except Exception as e:  # one failed search never stops the rest
                log.warning("Tatoeba search failed for %s %s: %s", lang, item, e)
                continue
            refs = have.get(item, [])
            users = {r.get("speaker") for r in refs}
            for sid in ids:
                for audio_id, user, lic, attribution in index.get(sid, []):
                    if len(refs) >= PER_ITEM or user in users:
                        continue
                    try:
                        raw = _fetch(f"https://audio.tatoeba.org/sentences/{ISO3[lang]}/{sid}.mp3", "audio/mpeg", 60, 2_000_000)
                    except RateLimited as e:
                        _save_manifest(data_dir, data)
                        stats[lang] = {"error": str(e), "new_files": got}
                        return stats
                    except Exception as e:  # noqa: BLE001
                        log.warning("Tatoeba audio %s failed: %s", sid, e)
                        continue
                    if not raw.startswith((b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
                        continue
                    (audio_dir(data_dir) / lang).mkdir(parents=True, exist_ok=True)
                    name = f"{item}-t{len(refs)}.mp3"
                    (audio_dir(data_dir) / lang / name).write_bytes(raw)  # unmodified, as the licence asks
                    refs.append({"file": f"{lang}/{name}", "speaker": user, "gender": "unknown", "license": lic,
                                 "source": f"https://tatoeba.org/sentences/show/{sid}", "attribution": attribution or None,
                                 "origin": "tatoeba", "noncommercial": "NC" in lic, "text": w.text})
                    users.add(user)
                    got += 1
            if refs:
                have[item] = refs
        _save_manifest(data_dir, data)
        stats[lang] = {"searched": searched, "new_files": got, "items": len(have)}
        if progress:
            progress(lang, stats[lang])
    return stats


def coverage(data_dir: Path) -> dict:
    from .phrases import ITEMS

    m = manifest(data_dir)
    out = {}
    for lang in ISO3:
        items = {k: v for k, v in m.get(lang, {}).items() if k in ITEMS.get(lang, {}) and not _custom(k)}  # not the sentence pool
        files = [r for rs in items.values() for r in rs]
        out[lang] = {"items": len(items), "of": len([i for i in ITEMS.get(lang, {}) if not _custom(i)]), "files": len(files),
                     "female": sum(1 for r in files if r["gender"] == "female"), "male": sum(1 for r in files if r["gender"] == "male")}
    return out


if __name__ == "__main__":  # python -m app.lang.native_audio [langs...]  (developer / offline preparation)
    import sys

    from ..config import get_settings

    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.WARNING)
    res = download(get_settings().data_dir, sys.argv[1:] or None, progress=lambda lang, s: print(lang, s, flush=True))
    print("== sentences (Tatoeba) ==", flush=True)
    download_sentences(get_settings().data_dir, sys.argv[1:] or None, progress=lambda lang, s: print(lang, "sentences", s, flush=True))
    print("== sentences (OpenSLR) ==", flush=True)
    from . import openslr

    openslr.download(get_settings().data_dir, sys.argv[1:] or None, progress=lambda lang, s: print(lang, "openslr", s, flush=True))
    print(json.dumps(coverage(get_settings().data_dir), indent=1))
