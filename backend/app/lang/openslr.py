"""Whole sentences read by native speakers, from Google's crowdsourced speech sets on OpenSLR (CC BY-SA 4.0).

Why this source: Lingua Libre has mostly single words and Tatoeba few recordings outside a handful of
languages. Google recorded volunteers who are native speakers (female and male, studio-like quality) reading
short sentences in Kannada, Gujarati, Marathi, Tamil, Telugu, Bengali, regional English (UK, Ireland,
Nigeria) and regional Spanish (Argentina, Chile, Colombia, Peru, Puerto Rico, Venezuela). The licence allows
reuse, also in the installer, with credit; the clips are trimmed and resampled, and stay under CC BY-SA 4.0.

Only what is needed is downloaded: each set is a zip of about 1 GB on openslr.org, but HTTP range requests
read just its file list, its transcript index and the chosen clips (a few MB per language).

What it gives the child:
* a **pool** of short sentences per language (3-8 words, preferring ones that use words from Melo's
  lessons), each stored like any other native recording (manifest key ``o_<file id>``). Challenge packs draw
  from it (the AI teacher still checks every sentence as suitable for the child's age; offline only sentences
  made entirely of known words are used), and because the clips are WAV the child's voice can be compared
  with them (Tatoeba's MP3s are only played);
* recordings of Melo's own words and phrases when a set has exactly that sentence.

Speakers are anonymous in these sets; the file id gives the speaker number and, for most sets, the gender.
"""
from __future__ import annotations

import io
import logging
import random
import re
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

from . import native_audio as na

log = logging.getLogger("melo.openslr")
BASE = "https://www.openslr.org/resources"
LICENSE = "CC BY-SA 4.0"
POOL = 40  # sentences per language
MIN_WORDS, MAX_WORDS, MAX_CHARS = 3, 8, 70
GAP = 0.4  # seconds between requests: openslr.org is one volunteer-run server
MIN_BLOCK = 256 * 1024

# Melo language -> [(SLR number, set title, zip files)]
SETS: dict[str, list[tuple[int, str, list[str]]]] = {
    "kn": [(79, "Crowdsourced high-quality Kannada multi-speaker speech", ["kn_in_female.zip", "kn_in_male.zip"])],
    "gu": [(78, "Crowdsourced high-quality Gujarati multi-speaker speech", ["gu_in_female.zip", "gu_in_male.zip"])],
    "mr": [(64, "Crowdsourced high-quality Marathi multi-speaker speech", ["mr_in_female.zip"])],
    "ta": [(65, "Crowdsourced high-quality Tamil multi-speaker speech", ["ta_in_female.zip", "ta_in_male.zip"])],
    "te": [(66, "Crowdsourced high-quality Telugu multi-speaker speech", ["te_in_female.zip", "te_in_male.zip"])],
    "bn": [(37, "High quality TTS data for Bengali", ["bn_in.zip", "bn_bd.zip"])],
    "en": [(83, "Crowdsourced UK and Ireland English dialect speech", [f"{d}_english_{g}.zip" for d in ("southern", "northern", "midlands", "scottish", "welsh")
                                                                       for g in ("female", "male")] + ["irish_english_male.zip"]),
           (70, "Crowdsourced Nigerian English speech", ["en_ng_female.zip", "en_ng_male.zip"])],
    "es": [(61, "Crowdsourced Argentinian Spanish speech", ["es_ar_female.zip", "es_ar_male.zip"]),
           (71, "Crowdsourced Chilean Spanish speech", ["es_cl_female.zip", "es_cl_male.zip"]),
           (72, "Crowdsourced Colombian Spanish speech", ["es_co_female.zip", "es_co_male.zip"]),
           (73, "Crowdsourced Peruvian Spanish speech", ["es_pe_female.zip", "es_pe_male.zip"]),
           (74, "Crowdsourced Puerto Rico Spanish speech", ["es_pr_female.zip"]),
           (75, "Crowdsourced Venezuelan Spanish speech", ["es_ve_female.zip", "es_ve_male.zip"])],
}

_last = [0.0]
_net = threading.Lock()


class RangeFile(io.RawIOBase):
    """A remote file read with HTTP range requests, so ``zipfile`` can pick single clips out of a 1 GB zip."""

    def __init__(self, url: str, timeout: float = 60):
        super().__init__()
        self.url, self.timeout, self.pos, self.requests = url, timeout, 0, 0
        self._buf_start, self._buf = 0, b""
        req = urllib.request.Request(url, method="HEAD", headers=na.UA)
        with self._polite(), urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - fixed https host
            self.size = int(r.headers["Content-Length"])

    class _polite:
        def __enter__(self):
            _net.acquire()
            wait = GAP - (time.monotonic() - _last[0])
            if wait > 0:
                time.sleep(wait)

        def __exit__(self, *exc):
            _last[0] = time.monotonic()
            _net.release()

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def _get(self, start: int, end: int) -> bytes:
        for attempt in range(3):
            try:
                req = urllib.request.Request(self.url, headers={**na.UA, "Range": f"bytes={start}-{end}"})
                with self._polite(), urllib.request.urlopen(req, timeout=self.timeout) as r:  # noqa: S310
                    if r.status != 206:
                        raise OSError("the server does not support partial downloads")
                    self.requests += 1
                    return r.read(end - start + 1)
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(2 * (attempt + 1))
        return b""

    def read(self, n: int = -1) -> bytes:
        if self.pos >= self.size:
            return b""
        n = self.size - self.pos if n is None or n < 0 else min(n, self.size - self.pos)
        off = self.pos - self._buf_start
        if not (0 <= off and off + n <= len(self._buf)):
            self._buf_start, self._buf = self.pos, self._get(self.pos, min(self.size, self.pos + max(n, MIN_BLOCK)) - 1)
            off = 0
        out = self._buf[off:off + n]
        self.pos += len(out)
        return out


def _open_zip(url: str) -> zipfile.ZipFile:
    return zipfile.ZipFile(RangeFile(url))


# --- the transcript index of a zip ------------------------------------------------------------------------
_ID = re.compile(r"^[A-Za-z0-9_\-]{3,60}$")


def parse_index(text: str) -> dict[str, str]:
    """{file id: sentence} from a set's line_index.tsv ("id<TAB>text") or line_index.csv ("line, id, text")."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        if "\t" in line:
            parts = [p.strip() for p in line.split("\t")]
            fid, sent = parts[0], next((p for p in reversed(parts[1:]) if p), "")
        else:
            parts = [p.strip() for p in line.split(",", 2)]
            if len(parts) < 3:
                continue
            fid, sent = parts[1], parts[2]
        if _ID.match(fid) and sent:
            out[fid] = sent
    return out


def speaker_of(fid: str) -> tuple[str, str]:
    """("knf_00557", "female") from "knf_00557_01097230618"; gender is unknown when the id does not say."""
    parts = fid.split("_")
    prefix = parts[0]
    gender = {"f": "female", "m": "male"}.get(prefix[-1:], "unknown") if len(prefix) == 3 else "unknown"
    return "_".join(parts[:2]), gender


def rows_for(lang: str) -> list[dict]:
    """Every transcribed clip of this language's sets: {id, text, url, member, slr, title, speaker, gender}."""
    out = []
    for slr, title, zips in SETS.get(lang, []):
        for zname in zips:
            url = f"{BASE}/{slr}/{zname}"
            try:
                z = _open_zip(url)
            except Exception as e:  # noqa: BLE001 - one unreachable zip never stops the others
                log.warning("OpenSLR %s unreachable: %s", url, e)
                continue
            names = z.namelist()
            idx_name = next((n for n in names if re.search(r"line_index\.(tsv|csv)$", n)), None)
            if not idx_name:
                continue
            members = {Path(n).stem: n for n in names if n.endswith(".wav")}
            for fid, text in parse_index(z.read(idx_name).decode("utf-8", "replace")).items():
                if fid in members:
                    spk, gender = speaker_of(fid)
                    if gender == "unknown":  # e.g. "mrt_..." in mr_in_female.zip: the zip says it
                        gender = "female" if "female" in zname else "male" if "male" in zname else "unknown"
                    out.append({"id": fid, "text": text, "url": url, "member": members[fid], "slr": slr, "title": title,
                                "speaker": spk, "gender": gender, "zip": z})
    return out


# --- choosing -------------------------------------------------------------------------------------------
def _melo_words(lang: str) -> set[str]:
    from .growth import _words
    from .phrases import ITEMS

    return {w for i, it in ITEMS.get(lang, {}).items() if not na._custom(i) for w in _words(it.text, lang)}


def suitable(text: str, lang: str) -> bool:
    """Short, plain, child-sized: 3-8 words, no numbers, no foreign script mixed in."""
    from .content import TARGETS
    from .growth import _words

    if len(text) > MAX_CHARS or re.search(r"\d", text) or re.search(r"[(){}\[\]<>/@#&*=+_|~^%$]", text):
        return False
    if lang in TARGETS and not TARGETS[lang].latin and re.search(r"[A-Za-z]", text):
        return False
    n = len(_words(text, lang))
    if lang in ("zh", "yue", "ja"):  # characters, about two per word (as growth counts them)
        n //= 2
    return MIN_WORDS <= n <= MAX_WORDS


def pick_pool(rows: list[dict], lang: str, size: int = POOL, seed: int = 7) -> list[list[dict]]:
    """The sentences to keep: those using Melo's words first, shorter first, female and male voices taking turns.
    Returns one list of clips (up to 3 speakers) per sentence."""
    from .growth import _words

    from .phrases import ITEMS

    vocab = _melo_words(lang)
    lessons = {na._norm(it.text) for i, it in ITEMS.get(lang, {}).items() if not na._custom(i)}  # built-in lessons: not a challenge
    by_text: dict[str, list[dict]] = {}
    for r in rows:
        if suitable(r["text"], lang) and na._norm(r["text"]) not in lessons:
            by_text.setdefault(na._norm(r["text"]), []).append(r)
    rng = random.Random(seed)
    texts = list(by_text.items())
    rng.shuffle(texts)

    def score(item):
        words = _words(item[1][0]["text"], lang)
        return (-sum(1 for w in words if w in vocab), len(words))

    texts.sort(key=score)
    queues = {"female": [], "male": [], "unknown": []}
    for _key, clips in texts:
        queues[clips[0]["gender"]].append(clips)
    order, turn = [], ["female", "male", "unknown"]
    while len(order) < size and any(queues.values()):
        for g in turn:
            if queues[g] and len(order) < size:
                order.append(queues[g].pop(0))
    out = []
    for clips in order:
        seen, keep = set(), []
        for c in clips:
            if c["speaker"] not in seen and len(keep) < na.PER_ITEM:
                seen.add(c["speaker"])
                keep.append(c)
        out.append(keep)
    return out


def _clip(data_dir: Path, lang: str, row: dict) -> dict | None:
    """Download one clip, trimmed / 16 kHz / normalised like the other references, and its manifest entry."""
    try:
        raw = row["zip"].read(row["member"])
        x, rate = na.decode_wav(raw)
        x = na.normalise(na.trim(na.resample(x, rate)))
    except Exception as e:  # noqa: BLE001
        log.warning("OpenSLR clip %s failed: %s", row["id"], e)
        return None
    if len(x) < na.RATE * 0.4 or len(x) > na.RATE * 12:
        return None
    (na.audio_dir(data_dir) / lang).mkdir(parents=True, exist_ok=True)
    name = f"o_{row['id']}.wav"
    (na.audio_dir(data_dir) / lang / name).write_bytes(na.encode_wav(x))
    return {"file": f"{lang}/{name}", "speaker": row["speaker"], "gender": row["gender"], "license": LICENSE,
            "source": f"https://www.openslr.org/{row['slr']}/",
            "attribution": f"Google, {row['title']} (OpenSLR SLR{row['slr']}), trimmed and resampled", "origin": "openslr",
            "noncommercial": False, "text": row["text"], "seconds": round(len(x) / na.RATE, 2)}


def download(data_dir: Path, langs: list[str] | None = None, progress=None, pool: int = POOL) -> dict:
    """Fill each language's sentence pool and add exact matches of Melo's own words and phrases."""
    from .phrases import ITEMS

    stats: dict[str, dict] = {}
    for lang in langs or list(SETS):
        if lang not in SETS:
            continue
        rows = rows_for(lang)
        data = {k: dict(v) for k, v in na.manifest(data_dir).items()}
        have = data.setdefault(lang, {})
        got = exact = 0
        # 1. Melo's own words / phrases read exactly as written
        by_norm: dict[str, list[dict]] = {}
        for r in rows:
            by_norm.setdefault(na._norm(r["text"]), []).append(r)
        for item, w in ITEMS.get(lang, {}).items():
            if na._custom(item) or len(have.get(item, [])) >= na.PER_ITEM:
                continue
            refs = have.get(item, [])
            speakers = {r.get("speaker") for r in refs}
            for r in by_norm.get(na._norm(w.text), []):
                if len(refs) >= na.PER_ITEM or r["speaker"] in speakers:
                    continue
                ref = _clip(data_dir, lang, r)
                if ref:
                    refs.append(ref)
                    speakers.add(ref["speaker"])
                    got += 1
                    exact += 1
            if refs:
                have[item] = refs
        # 2. the pool of short sentences (already downloaded ones are kept, not fetched again)
        pooled = sum(1 for k in have if k.startswith("o_"))
        for clips in pick_pool(rows, lang, pool):
            if pooled >= pool:
                break
            key = f"o_{clips[0]['id']}"
            if key in have:
                continue
            refs = [ref for ref in (_clip(data_dir, lang, c) for c in clips) if ref]
            if refs:
                have[key] = refs
                pooled += 1
                got += len(refs)
        na._save_manifest(data_dir, data)
        stats[lang] = {"clips": len(rows), "new_files": got, "exact": exact, "pool": pooled}
        if progress:
            progress(lang, stats[lang])
    return stats


# --- using the pool --------------------------------------------------------------------------------------
POOL_KEYS = ("o_", "v_")  # OpenSLR, Common Voice


def pool(data_dir: Path, lang: str) -> dict[str, list[dict]]:
    """{pool key: refs} downloaded on this computer or shipped with the app (OpenSLR and Common Voice)."""
    out = {k: [{**r, "bundled": True} for r in v] for k, v in na._bundled().get(lang, {}).items() if k.startswith(POOL_KEYS)}
    out.update({k: v for k, v in na.manifest(data_dir).get(lang, {}).items() if k.startswith(POOL_KEYS)})
    return out


def candidates(data_dir: Path, lang: str, vocab: set[str], level: int, rng: random.Random, limit: int = 20) -> list[dict]:
    """Pool sentences of the right length for this challenge level that use at least one word the child knows,
    in the shape growth.from_tatoeba returns (with their recordings already on this computer)."""
    from .growth import _length, _words

    lo, hi = _length(level)
    out = []
    for key, refs in pool(data_dir, lang).items():
        text = refs[0].get("text") or ""
        words = _words(text, lang)
        n = len(words) if lang not in ("zh", "yue", "ja") else len(words) // 2
        if refs and lo <= n <= hi and any(w in vocab for w in words):
            out.append({"text": text, "sid": key, "words": words, "audio": [], "refs": refs, "source": refs[0].get("origin", "openslr"),
                        "known": sum(1 for w in words if w in vocab) / max(1, len(words))})
    rng.shuffle(out)
    out.sort(key=lambda c: -c["known"])
    return out[:limit]


if __name__ == "__main__":  # python -m app.lang.openslr [langs...]   (developer / offline preparation)
    import json
    import sys

    from ..config import get_settings

    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.WARNING)
    print(json.dumps(download(get_settings().data_dir, sys.argv[1:] or None, progress=lambda l, s: print(l, s, flush=True)), indent=1))
