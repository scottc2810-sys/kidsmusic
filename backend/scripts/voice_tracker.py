"""The shared native-recording tracker: one CSV that the owner and Claude both edit.

    python scripts/voice_tracker.py export   # refresh coverage, keep everything typed in the "found_*" columns
    python scripts/voice_tracker.py import   # bring in recordings the owner found, then refresh
    python scripts/voice_tracker.py summary  # per-language counts

Files (project root, never committed or bundled: see .gitignore):
  voice-tracker.csv   every built-in word and phrase in every language, with what native recordings exist
  voice-missing.csv   only the rows still missing a female and/or male native speaker (to search by hand)

Columns Claude writes: lang, language, item_id, kind, topic, english, text, romanised, native_female,
native_male, sources, status, computer_voice (recorded / online only / none), search_commons, search_tatoeba, search_forvo.
Columns the owner writes (kept on every refresh): found_url_or_file, found_license, found_speaker, found_gender,
found_by, notes. Claude fills "imported" after bringing a recording in.

A found recording is imported when found_url_or_file is a local .wav / .mp3 file or a direct https link to one,
found_license is filled in and allows reuse (CC0, CC BY, CC BY-SA, public domain or "own recording"), and
found_gender is female or male. Licences with NC (non-commercial) or ND (no derivatives) are not imported.
"""
from __future__ import annotations

import csv
import sys
import urllib.parse
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.lang import native_audio as na  # noqa: E402
from app.lang import tts  # noqa: E402
from app.lang.content import TARGETS, WORDS  # noqa: E402
from app.lang.phrases import ITEMS, TOPIC_OF  # noqa: E402

TRACKER = ROOT / "voice-tracker.csv"
MISSING = ROOT / "voice-missing.csv"
MINE = ["lang", "language", "item_id", "kind", "topic", "english", "text", "romanised", "native_female", "native_male",
        "sources", "status", "computer_voice", "search_commons", "search_tatoeba", "search_forvo"]
YOURS = ["found_url_or_file", "found_license", "found_speaker", "found_gender", "found_by", "notes", "imported"]
OK_LICENCES = ("cc0", "cc by", "cc-by", "public domain", "pd", "own recording", "family")


def _voice(data_dir: Path, code: str, item: str) -> str:
    """recorded = a neural-voice clip is saved (works offline); online = made on first play; none."""
    sl = tts.slots(data_dir, code, item)
    return "recorded" if any(not x["live"] for x in sl) else "online only" if sl else "none"


def _rows() -> list[dict]:
    s = get_settings()
    out = []
    for code, t in TARGETS.items():
        for item, w in ITEMS[code].items():
            if tts.is_custom(item):
                continue
            refs = [r for r in na.references(s.data_dir, code, item) if not r.get("family")]
            fem = sum(r.get("gender") == "female" for r in refs)
            male = sum(r.get("gender") == "male" for r in refs)
            status = "complete" if fem and male else "only male" if male else "only female" if fem else "missing"
            q = urllib.parse.quote(w.text)
            iso3 = na.ISO3.get(code, "")
            out.append({
                "lang": code, "language": t.name, "item_id": item, "kind": "phrase" if item.startswith("p_") else "word",
                "topic": TOPIC_OF.get(item, "words"), "english": ITEMS["en"][item].text if item in ITEMS["en"] else WORDS["en"].get(item, w).text,
                "text": w.text, "romanised": w.roman or "", "native_female": fem, "native_male": male,
                "sources": ", ".join(sorted({r.get("origin") or ("lingualibre" if r.get("commons") else "other") for r in refs})),
                "status": status, "computer_voice": _voice(s.data_dir, code, item),
                "search_commons": f"https://commons.wikimedia.org/w/index.php?search={q}&title=Special:MediaSearch&type=audio",
                "search_tatoeba": f"https://tatoeba.org/en/sentences/search?query={q}&from={iso3}&has_audio=yes" if iso3 else "",
                "search_forvo": f"https://forvo.com/search/{q}/{code}/",
            })
    return out


def _read(path: Path) -> dict[tuple[str, str], dict]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        return {(r["lang"], r["item_id"]): r for r in csv.DictReader(f)}


def export() -> list[dict]:
    old = _read(TRACKER)
    rows = _rows()
    for r in rows:
        kept = old.get((r["lang"], r["item_id"]), {})
        for c in YOURS:
            r[c] = kept.get(c, "")
    cols = MINE + YOURS
    # utf-8 with BOM so Excel shows every script correctly
    with TRACKER.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, cols)
        w.writeheader()
        w.writerows(rows)
    with MISSING.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, cols)
        w.writeheader()
        w.writerows(r for r in rows if r["status"] != "complete")
    return rows


def _audio(src: str) -> bytes:
    if src.lower().startswith("https://"):
        return na._fetch(src, max_bytes=5_000_000)
    p = Path(src.strip('"')).expanduser()
    if not p.is_file():
        raise ValueError(f"no such file: {p}")
    return p.read_bytes()


def import_found() -> list[str]:
    s = get_settings()
    rows = _read(TRACKER)
    done = []
    data = {k: dict(v) for k, v in na.manifest(s.data_dir).items()}
    for (code, item), r in rows.items():
        src = (r.get("found_url_or_file") or "").strip()
        if not src or (r.get("imported") or "").strip():
            continue
        lic = (r.get("found_license") or "").strip()
        gender = (r.get("found_gender") or "").strip().lower()
        try:
            if not lic or any(x in lic.lower() for x in ("nc", "nd", "non-commercial", "no deriv")) or not any(x in lic.lower() for x in OK_LICENCES):
                raise ValueError("licence missing or not reusable (needs CC0, CC BY, CC BY-SA, public domain or own recording)")
            if gender not in ("female", "male"):
                raise ValueError("found_gender must be female or male")
            raw = _audio(src)
            if raw[:4] == b"RIFF":
                x, rate = na.decode_wav(raw)
            else:
                x, rate = na.decode_mp3(raw), na.RATE
                if x is None:
                    raise ValueError("only .wav or .mp3 files can be read")
            x = na.normalise(na.trim(na.resample(x, rate)))
            if len(x) < na.RATE * 0.2:
                raise ValueError("the recording is too short or silent")
            refs = data.setdefault(code, {}).setdefault(item, [])
            name = f"{item}-found-{gender[0]}-{len(refs)}.wav"
            (na.audio_dir(s.data_dir) / code).mkdir(parents=True, exist_ok=True)
            (na.audio_dir(s.data_dir) / code / name).write_bytes(na.encode_wav(x))
            refs.append({"file": f"{code}/{name}", "speaker": (r.get("found_speaker") or "native speaker").strip()[:60], "gender": gender,
                         "license": lic, "source": src if src.startswith("https://") else None, "text": r.get("text"),
                         "origin": "owner_found", "attribution": (r.get("found_speaker") or "").strip()[:60], "seconds": round(len(x) / na.RATE, 2)})
            r["imported"] = f"yes {date.today().isoformat()}"
            done.append(f"{code}/{item} ({gender})")
        except Exception as e:  # noqa: BLE001 - report each row, keep going
            r["notes"] = (f"not imported: {e}. " + (r.get("notes") or "")).strip()[:300]
    na._save_manifest(s.data_dir, data)
    # write back the owner's columns (imported / notes), then refresh everything
    with TRACKER.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, MINE + YOURS)
        w.writeheader()
        w.writerows(rows.values())
    export()
    return done


def summary(rows: list[dict]) -> str:
    lines = [f"{'language':22} {'items':>5} {'complete':>8} {'one voice':>9} {'missing':>7} {'silent offline':>15}"]
    for code, t in TARGETS.items():
        rs = [r for r in rows if r["lang"] == code]
        lines.append(f"{t.name:22} {len(rs):5} {sum(r['status'] == 'complete' for r in rs):8} "
                     f"{sum(r['status'].startswith('only') for r in rs):9} {sum(r['status'] == 'missing' for r in rs):7} "
                     f"{sum(r['status'] == 'missing' and r['computer_voice'] != 'recorded' for r in rs):15}")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = (sys.argv[1:] or ["export"])[0]
    if cmd == "import":
        got = import_found()
        print(f"imported {len(got)}: " + ", ".join(got))
    rows = export()
    print(summary(rows))
    print(f"\n{TRACKER}\n{MISSING}")
