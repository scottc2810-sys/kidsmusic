"""The child's own instrument at home: what it is, how many keys, what is printed on the keys.

A parent describes it with a short form, photos and/or product links (a shop page, the maker's page).
Melo reads them (the AI brain looks at the photos and page text when the parent allowed the AI brain;
simple text rules otherwise) and suggests the details; the parent confirms. Lessons then use it:
the screen instrument matches the real one (number of keys, number / colour / letter stickers),
songs are moved into its range, and Melo says where to find each note on THAT instrument.

Without a profile everything stays as before: the standard on-screen piano lessons.
"""
from __future__ import annotations

import base64
import html
import ipaddress
import json
import logging
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

log = logging.getLogger("melo.instrument")

NOTE_PC = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6, "GB": 6, "G": 7, "G#": 8, "AB": 8,
           "A": 9, "A#": 10, "BB": 10, "B": 11}
DIATONIC = (0, 2, 4, 5, 7, 9, 11)

# layout: keys (black and white keys) | bars (one row of bars, usually only "white" notes) | pads (drums: rhythm only)
# | voice (sing). stand_in: no picture of this instrument yet, the screen shows a keyboard with the same notes.
KINDS: dict[str, dict] = {
    "keyboard": {"label": "Keyboard / piano", "emoji": "🎹", "layout": "keys", "keys": 61, "first": "C"},
    "toy_keyboard": {"label": "Kids' keyboard", "emoji": "🎹", "layout": "keys", "keys": 37, "first": "C"},
    "harmonium": {"label": "Harmonium", "emoji": "🪗", "layout": "keys", "keys": 39, "first": "C"},
    "melodica": {"label": "Melodica", "emoji": "🎹", "layout": "keys", "keys": 32, "first": "F"},
    "xylophone": {"label": "Xylophone", "emoji": "🌈", "layout": "bars", "keys": 8, "first": "C"},
    "glockenspiel": {"label": "Glockenspiel / metallophone", "emoji": "🔔", "layout": "bars", "keys": 8, "first": "C"},
    "drums": {"label": "Drum / percussion", "emoji": "🥁", "layout": "pads", "keys": 4, "first": "C"},
    "ukulele": {"label": "Ukulele", "emoji": "🎸", "layout": "keys", "keys": 13, "first": "C", "stand_in": True},
    "guitar": {"label": "Guitar", "emoji": "🎸", "layout": "keys", "keys": 25, "first": "C", "stand_in": True},
    "recorder": {"label": "Recorder / flute", "emoji": "🪈", "layout": "keys", "keys": 13, "first": "C", "stand_in": True},
    "violin": {"label": "Violin", "emoji": "🎻", "layout": "keys", "keys": 25, "first": "C", "stand_in": True},
    "voice": {"label": "Singing (no instrument)", "emoji": "🎤", "layout": "keys", "keys": 13, "first": "C", "stand_in": True},
}
LABELS = ("none", "letters", "numbers", "colors", "sargam", "solfege")
MAX_PHOTOS = 6
MAX_PHOTO_BYTES = 6_000_000
MAX_SOURCES = 4


def pitch_class(name: str) -> int:
    return NOTE_PC.get((name or "C").strip().upper().replace("♯", "#").replace("♭", "B"), 0)


def note_range(kind: str, keys: int | None, first_key: str) -> dict:
    """The notes this instrument can play, as MIDI numbers, with middle C (60) as near the middle as possible.
    Octaves on a real toy keyboard vary; only where the notes sit relative to each other matters for lessons."""
    k = KINDS.get(kind, KINDS["keyboard"])
    n = max(2, min(int(keys or k["keys"]), 88))
    pc = pitch_class(first_key or k["first"])
    if k["layout"] == "bars":  # bars: usually the 7 "white" notes only, from the lowest bar upwards
        start = 60 + pc
        notes, m = [], start
        while len(notes) < n:
            if m % 12 in DIATONIC:
                notes.append(m)
            m += 1
        return {"low": notes[0], "high": notes[-1], "notes": notes, "diatonic": True}
    if k["layout"] == "pads":
        return {"low": 60, "high": 60 + n - 1, "notes": list(range(60, 60 + n)), "diatonic": False}
    best = min((pc + 12 * o for o in range(0, 9)), key=lambda lo: abs((lo + (lo + n - 1)) / 2 - 60.5))
    return {"low": best, "high": best + n - 1, "notes": list(range(best, best + n)), "diatonic": False}


def public(profile, data_dir: Path | None = None) -> dict:
    """What the app needs to personalise lessons (and the parent's page)."""
    if profile is None:
        return {"set": False, "kind": "keyboard", "default": True}
    k = KINDS.get(profile.kind, KINDS["keyboard"])
    rng = note_range(profile.kind, profile.keys, profile.first_key)
    return {
        "set": True, "kind": profile.kind, "label": k["label"], "emoji": k["emoji"], "layout": k["layout"],
        "stand_in": bool(k.get("stand_in")), "name": profile.name, "keys": profile.keys or k["keys"], "first_key": profile.first_key,
        "labels": profile.labels, "features": profile.features or {}, "summary": profile.summary, "tips": profile.tips or [],
        "low": rng["low"], "high": rng["high"], "diatonic": rng["diatonic"],
        "sources": profile.sources or [], "notes": profile.notes,
        "photos": [{"id": p["id"], "url": f"/api/children/{profile.child_id}/instrument/photos/{p['id']}"} for p in (profile.photos or [])],
        "analyzed_at": profile.analyzed_at.isoformat() if profile.analyzed_at else None,
    }


# --- reading what the parent gave us ---------------------------------------------------------------------
_KIND_WORDS = [("xylophone", "xylophone"), ("glockenspiel", "glockenspiel"), ("metallophone", "glockenspiel"),
               ("harmonium", "harmonium"), ("melodica", "melodica"), ("ukulele", "ukulele"), ("guitar", "guitar"),
               ("recorder", "recorder"), ("flute", "recorder"), ("violin", "violin"), ("drum", "drums"),
               ("kids", "toy_keyboard"), ("children", "toy_keyboard"), ("toy", "toy_keyboard"), ("beginner", "toy_keyboard"),
               ("keyboard", "keyboard"), ("piano", "keyboard")]


def heuristics(text: str) -> dict:
    """What plain text rules can read from a product title / description (no AI needed)."""
    t = " " + re.sub(r"\s+", " ", text or "").lower() + " "
    out: dict = {}
    m = re.search(r"\b(\d{1,2})\s*-?\s*(?:keys?|key\b|bars?|notes?)\b", t)
    if m and 2 <= int(m.group(1)) <= 88:
        out["keys"] = int(m.group(1))
    for word, kind in _KIND_WORDS:
        if word in t:
            out["kind"] = kind
            break
    if out.get("kind") == "keyboard" and re.search(r"\b(kids?|children|toddlers?|baby|toy|beginners?)\b", t):
        out["kind"] = "toy_keyboard"
    out["mic"] = bool(re.search(r"micro ?phone|\bmic\b|sing ?along|karaoke", t))
    out["record"] = bool(re.search(r"\brecord(ing)?\b|playback", t))
    out["lights"] = bool(re.search(r"light[- ]?up|lighted keys|lighting keys|led keys|keys light", t))
    m = re.search(r"\b(\d{1,3})\s*(?:demo|built-in|preset)?\s*(?:demo )?songs?\b", t)
    if m:
        out["demo_song_count"] = int(m.group(1))
    if re.search(r"number(ed)? (keys|stickers)|numbers on (the )?keys", t):
        out["labels"] = "numbers"
    elif re.search(r"colou?r(ed|ful)? (keys|stickers|bars)|rainbow", t):
        out["labels"] = "colors"
    elif re.search(r"letter(ed)? (keys|stickers)|note (names|stickers)", t):
        out["labels"] = "letters"
    return out


class _TextGrab(HTMLParser):
    """Title, description and visible list / paragraph text of a product page (scripts and styles skipped)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta: list[str] = []
        self.chunks: list[str] = []
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript", "svg"):
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif tag == "meta" and (a.get("name") or a.get("property") or "").lower() in ("description", "og:title", "og:description", "keywords"):
            self.meta.append(a.get("content") or "")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._skip:
            return
        s = data.strip()
        if not s:
            return
        if self._in_title:
            self.title += s
        elif 3 <= len(s) <= 400:
            self.chunks.append(s)


def _public_host(host: str) -> bool:
    """Only ordinary internet addresses: never this computer or the home network (no SSRF)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if getattr(ip, "ipv4_mapped", None):  # ::ffff:127.0.0.1 is 127.0.0.1
            ip = ip.ipv4_mapped
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # we follow redirects ourselves, checking each address
        return None


def fetch_page(url: str, timeout: float = 12, max_bytes: int = 2_000_000) -> dict:
    """{url, found, title, text, reason}: the readable text of a product page. Many shops block programs
    (Amazon often answers 503): then found=False and the parent can add photos or paste the description."""
    out = {"url": url, "found": False, "title": "", "text": "", "reason": ""}
    opener = urllib.request.build_opener(_NoRedirect)
    for _ in range(4):
        p = urllib.parse.urlparse(url)
        if p.scheme not in ("http", "https") or not p.hostname:
            out["reason"] = "Only http(s) links can be read."
            return out
        if not _public_host(p.hostname):
            out["reason"] = "That address is not a public web page."
            return out
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; MeloMusicTeacher/1.0)",
                                                   "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-IN,en;q=0.8"})
        try:
            with opener.open(req, timeout=timeout) as r:  # noqa: S310 - checked scheme and public address above
                raw = r.read(max_bytes)
                charset = r.headers.get_content_charset() or "utf-8"
                break
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                url = urllib.parse.urljoin(url, e.headers["Location"])
                continue
            out["reason"] = f"The shop answered {e.code}" + (" (it blocks programs reading its pages)" if e.code in (403, 429, 503) else "")
            return out
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            out["reason"] = f"Could not open the page ({getattr(e, 'reason', e)})"
            return out
    else:
        out["reason"] = "Too many redirects"
        return out
    g = _TextGrab()
    try:
        g.feed(raw.decode(charset, errors="replace"))
    except Exception:  # noqa: BLE001 - broken HTML: keep what was read
        pass
    text = " | ".join(dict.fromkeys(g.meta + g.chunks))
    out.update(found=bool(g.title or text), title=html.unescape(g.title)[:300], text=html.unescape(text)[:8000])
    if not out["found"]:
        out["reason"] = "The page had no readable text"
    return out


# --- photos ------------------------------------------------------------------------------------------------
def photo_dir(data_dir: Path, child_id: str) -> Path:
    return Path(data_dir) / "instruments" / child_id


def sniff_image(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


# --- analysis ----------------------------------------------------------------------------------------------
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["kind", "name", "keys", "first_key", "labels", "mic", "record", "lights", "demo_songs", "summary", "tips", "confidence"],
    "properties": {
        "kind": {"type": "string", "enum": list(KINDS)},
        "name": {"type": "string"},
        "keys": {"type": "integer"},
        "first_key": {"type": "string", "enum": ["C", "D", "E", "F", "G", "A", "B"]},
        "labels": {"type": "string", "enum": list(LABELS)},
        "mic": {"type": "boolean"}, "record": {"type": "boolean"}, "lights": {"type": "boolean"},
        "demo_songs": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
        "tips": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
    },
}


def analyze(child, profile, data_dir: Path, fetch=fetch_page) -> dict:
    """Read the parent's links, notes and photos and suggest the instrument's details.
    Returns {"suggestion": {...}, "sources": [...], "used_ai": bool, "message": str}. Nothing is saved here."""
    from .teacher.service import get_teacher

    sources = []
    for s in (profile.sources or [])[:MAX_SOURCES]:
        page = fetch(s["url"])
        sources.append({"url": s["url"], "title": page["title"], "found": page["found"], "reason": page["reason"], "_text": page["text"]})
    corpus = " ".join([profile.notes or "", profile.name or ""] + [s["title"] + " " + s["_text"] for s in sources])
    guess = heuristics(corpus)
    base_kind = guess.get("kind", profile.kind or "keyboard")
    suggestion = {
        "kind": base_kind, "name": profile.name or next((s["title"][:80] for s in sources if s["title"]), ""),
        "keys": guess.get("keys") or profile.keys or KINDS[base_kind]["keys"], "first_key": profile.first_key or "C",
        "labels": guess.get("labels", profile.labels or "none"),
        "mic": guess.get("mic", False), "record": guess.get("record", False), "lights": guess.get("lights", False),
        "demo_songs": [], "summary": "", "tips": [], "confidence": "low",
    }
    images = []
    for p in (profile.photos or [])[:4]:
        f = photo_dir(data_dir, profile.child_id) / p["file"]
        if f.is_file():
            images.append((f.read_bytes(), p["mime"]))
    teacher = get_teacher()
    used_ai = False
    message = "Read with simple text rules. Turn on the AI brain for this child to let Melo look at the photos too."
    if teacher.uses_ai(child) and (images or corpus.strip()):
        prompt = (
            "A parent described their child's own musical instrument so a music-teaching app can personalise lessons.\n"
            f"Child's age: {child.age}.\nParent's notes: {profile.notes[:1500]!r}\nName given: {profile.name!r}\n"
            "Product pages (may be partial or missing):\n"
            + "\n".join(f"- {s['url']}: {s['title']} :: {s['_text'][:2500]}" for s in sources)
            + f"\n{len(images)} photo(s) of the instrument are attached.\n"
            f"Text rules guessed: {json.dumps(guess)}.\n"
            "Work out: kind; a short name; number of keys (keyboards) or bars (xylophones) or pads (drums), 0 if unknown; the "
            "leftmost WHITE key's letter (on most kids' keyboards with 32 or 37 keys it is F or C: count from the group of two "
            "black keys; C is the white key just left of the two black keys); what is printed or stuck on the keys (numbers 1-7, "
            "colours, letters, sargam, solfege or none); microphone, recording, light-up keys; built-in demo song names if visible. "
            "summary: ONE short, warm sentence for a small child describing THEIR instrument (e.g. 'your blue keyboard with 37 keys and "
            "a microphone'). tips: up to 4 short, practical tips for the parent to use this exact instrument with the lessons "
            "(e.g. which key is middle C / Sa, switch off auto-rhythm, volume, use the microphone for singing along). "
            "Only state what the photos or text support; say 'low' confidence when guessing."
        )
        data = teacher.ask_with_images(child, prompt, SCHEMA, images, 1500)
        if data and data.get("kind") in KINDS:
            used_ai = True
            message = "Melo looked at " + (f"{len(images)} photo(s)" if images else "the description") + \
                      (" and the product page" if any(s["found"] for s in sources) else "") + ". Check the details and save."
            for k in SCHEMA["properties"]:
                if k in data and data[k] not in (None, ""):
                    suggestion[k] = data[k]
            if not suggestion.get("keys"):
                suggestion["keys"] = KINDS[suggestion["kind"]]["keys"]
        elif teacher.uses_ai(child):
            message = "The AI brain did not answer, so Melo used simple text rules. You can try again."
    suggestion["keys"] = max(2, min(int(suggestion["keys"] or 0) or KINDS[suggestion["kind"]]["keys"], 88))
    suggestion["summary"] = suggestion["summary"][:300]
    suggestion["tips"] = [str(t)[:240] for t in suggestion["tips"]][:4]
    suggestion["demo_songs"] = [str(t)[:60] for t in suggestion["demo_songs"]][:12]
    return {"suggestion": suggestion, "used_ai": used_ai, "message": message,
            "sources": [{k: v for k, v in s.items() if k != "_text"} for s in sources]}


def image_b64(data: bytes) -> str:
    return base64.b64encode(data).decode()
