"""Child-safety filtering for any AI-generated text and redaction of what we send out."""
from __future__ import annotations

import re

# Language a patient, non-shaming teacher must never use (EN + Hindi + Hinglish).
_BLOCKED = [
    r"\bstupid\b", r"\bdumb\b", r"\bidiot\b", r"\blazy\b", r"\bbad\b", r"\bwrong\b", r"\bfail(ed|ure)?\b",
    r"\bterrible\b", r"\bawful\b", r"\bugly\b", r"\bshame\b", r"\bpunish", r"\bhate\b", r"\bkill\b",
    r"other (kids|children)", r"better than", r"worse than", r"\bbuy\b", r"\bsubscribe\b", r"\bsecret\b",
    r"\bpassword\b", r"\baddress\b", r"phone number", r"\bbekaar\b", r"\bbekar\b", r"\bgalat\b", r"\bbura\b",
    r"\bpagal\b", r"\bbuddhu\b", r"बेकार", r"गलत", r"ग़लत", r"बुरा", r"पागल", r"बुद्धू", r"सज़ा", r"सजा",
]
_BLOCKED_RE = re.compile("|".join(_BLOCKED), re.IGNORECASE)
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s-]{7,}\d)")
_TAG_RE = re.compile(r"<[^>]{1,40}>")


def is_child_safe(text: str) -> bool:
    return bool(text.strip()) and not _BLOCKED_RE.search(text) and not _URL_RE.search(text)


def clean_child_text(text: str | None, max_chars: int = 240) -> str | None:
    """Return a trimmed, safe line for the child, or None if it must be replaced by a curated line."""
    if not text:
        return None
    t = _TAG_RE.sub("", str(text)).replace("\n", " ").strip()
    t = re.sub(r"\s{2,}", " ", t)
    if not is_child_safe(t):
        return None
    if len(t) > max_chars:
        cut = t[:max_chars]
        # cut at the last sentence end to keep it natural
        m = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "), cut.rfind("। "))
        t = cut[: m + 1] if m > 40 else cut.rstrip() + "…"
    return t


def clean_parent_text(text: str | None, max_chars: int = 900) -> str | None:
    if not text:
        return None
    t = _TAG_RE.sub("", str(text)).strip()
    t = _URL_RE.sub("", t)
    return t[:max_chars] if t else None


def redact_for_ai(text: str, child_name: str | None = None) -> str:
    """Strip personal data from child input before it leaves the host."""
    t = _EMAIL_RE.sub("[email]", text)
    t = _PHONE_RE.sub("[number]", t)
    t = _URL_RE.sub("[link]", t)
    if child_name:
        t = re.sub(re.escape(child_name), "{name}", t, flags=re.IGNORECASE)
    return t[:300]
