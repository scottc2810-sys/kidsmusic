#!/usr/bin/env python3
"""Translation helper for Melo.

    python scripts/i18n_template.py            # report what each language pack is missing
    python scripts/i18n_template.py pt         # start (or top up) the two files for a new language "pt"

A language is two JSON files (anything missing falls back to English):
  frontend/src/locales/<code>.json          English on-screen text -> translation
  backend/app/teacher/locales/<code>.json   phrase key -> list of lines Melo speaks
Then register the language in frontend/src/languages.ts and backend/app/languages.py.
New entries are written with an empty value: fill them in; empty values are ignored by the app.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"
UI_DIR = SRC / "locales"
PHRASE_DIR = ROOT / "backend" / "app" / "teacher" / "locales"
_STR = r'"((?:[^"\\]|\\.)*)"'


def ui_strings() -> list[str]:
    """Every English string the screens can show: `en: "..."` in the source, plus chapter titles."""
    found: dict[str, None] = {}
    for path in sorted(SRC.rglob("*.ts*")):
        if path.name.endswith(".test.ts"):
            continue
        for m in re.finditer(r"\ben:\s*" + _STR, path.read_text(encoding="utf-8")):
            found[json.loads('"' + m.group(1) + '"')] = None
    for m in re.finditer(r'Chapter\("\w+", \d, ' + _STR, (ROOT / "backend" / "app" / "path.py").read_text(encoding="utf-8")):
        found[m.group(1)] = None
    return list(found)


def phrase_keys() -> dict[str, list[str]]:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.teacher import phrases  # noqa: PLC0415

    return {k: v["en"] for k, v in phrases.P.items()}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def main() -> None:
    ui, phrases = ui_strings(), phrase_keys()
    if len(sys.argv) > 1:
        code = sys.argv[1]
        ui_path, ph_path = UI_DIR / f"{code}.json", PHRASE_DIR / f"{code}.json"
        ui_old, ph_old = load(ui_path), load(ph_path)
        ui_path.write_text(json.dumps({s: ui_old.get(s, "") for s in ui}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        merged = {k: ph_old.get(k) or [] for k in phrases}
        merged = {"_english": {k: v[0] for k, v in phrases.items() if not merged[k]}, **merged} if any(not v for v in merged.values()) else merged
        ph_path.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"Wrote {ui_path.relative_to(ROOT)} and {ph_path.relative_to(ROOT)}")
    print(f"{len(ui)} on-screen strings, {len(phrases)} spoken phrase keys")
    for path in sorted(UI_DIR.glob("*.json")):
        d = load(path)
        missing = [s for s in ui if not d.get(s)]
        spoken = load(PHRASE_DIR / path.name)
        missing_spoken = [k for k in phrases if not spoken.get(k)]
        print(f"  {path.stem}: screen {len(ui) - len(missing)}/{len(ui)}, spoken {len(phrases) - len(missing_spoken)}/{len(phrases)}")
        for s in missing[:5]:
            print(f"      untranslated: {s[:70]}")


if __name__ == "__main__":
    main()
