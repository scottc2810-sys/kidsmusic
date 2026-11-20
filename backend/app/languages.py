"""Language registry (mirror of frontend/src/languages.ts).

To add a teaching language:
  1. add an entry here and in frontend/src/languages.ts;
  2. add backend/app/teacher/locales/<code>.json  (phrase key -> list of spoken lines);
  3. add frontend/src/locales/<code>.json         (English UI text -> translation).
Anything a pack does not translate falls back to English, so a partial pack is safe to ship.
`python scripts/i18n_template.py <code>` writes both templates.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Lang:
    code: str
    name: str
    native: str
    ai_name: str  # how we ask the AI to write in this language
    notes: str  # letters | sargam | solfege
    rtl: bool = False
    builtin: bool = False  # lines live in phrases.py; others load from teacher/locales/<code>.json


_ALL = [
    Lang("en", "English", "English", "simple English", "letters", builtin=True),
    Lang("hi", "Hindi", "हिंदी", "simple Hindi written in Devanagari script", "sargam", builtin=True),
    Lang("hinglish", "Hinglish", "Hinglish", "Hinglish (Hindi and English mixed, written in Latin script)", "sargam", builtin=True),
    Lang("es", "Spanish", "Español", "simple Spanish", "solfege"),
    Lang("fr", "French", "Français", "simple French", "solfege"),
    Lang("zh", "Chinese (Mandarin)", "中文", "simple Mandarin Chinese written in Simplified Chinese characters", "solfege"),
    Lang("ar", "Arabic", "العربية", "simple Modern Standard Arabic", "solfege", rtl=True),
]
LANGUAGES: dict[str, Lang] = {x.code: x for x in _ALL}
BUILTIN = tuple(x.code for x in _ALL if x.builtin)

_LETTER = ["C", "C sharp", "D", "D sharp", "E", "F", "F sharp", "G", "G sharp", "A", "A sharp", "B"]
_SARGAM = ["Sa", "komal Re", "Re", "komal Ga", "Ga", "Ma", "tivra Ma", "Pa", "komal Dha", "Dha", "komal Ni", "Ni"]
_SARGAM_HI = ["सा", "कोमल रे", "रे", "कोमल ग", "ग", "म", "तीव्र म", "प", "कोमल ध", "ध", "कोमल नि", "नि"]
_SOLFEGE = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"]
_SOLFEGE_AR = ["دو", "دو♯", "ري", "ري♯", "مي", "فا", "فا♯", "صول", "صول♯", "لا", "لا♯", "سي"]


def lang(code: str) -> Lang:
    return LANGUAGES.get(code) or LANGUAGES["en"]


def note_name(midi: int, code: str) -> str:
    """The note's name as a child of this language learns it. Sa = Do = C."""
    info = lang(code)
    if info.notes == "sargam":
        names = _SARGAM_HI if code == "hi" else _SARGAM
    elif info.notes == "solfege":
        names = _SOLFEGE_AR if code == "ar" else _SOLFEGE
    else:
        names = _LETTER
    return names[midi % 12]
