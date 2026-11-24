"""The shared recording tracker (scripts/voice_tracker.py): every language and item listed, the owner's columns
kept on refresh, found recordings imported only with a reusable licence."""
import csv
import importlib.util
import math
import struct
from pathlib import Path

import pytest

from app.lang.content import TARGETS
from app.lang.phrases import ITEMS
from app.lang.tts import is_custom

SPEC = importlib.util.spec_from_file_location("voice_tracker", Path(__file__).parents[1] / "scripts" / "voice_tracker.py")


@pytest.fixture()
def vt(tmp_path, monkeypatch, client):
    mod = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(mod)
    monkeypatch.setattr(mod, "TRACKER", tmp_path / "voice-tracker.csv")
    monkeypatch.setattr(mod, "MISSING", tmp_path / "voice-missing.csv")
    return mod


def _wav(path: Path, seconds=0.8, rate=16000):
    n = int(seconds * rate)
    frames = b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 220 * i / rate))) for i in range(n))
    hdr = b"RIFF" + struct.pack("<I", 36 + len(frames)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) + b"data" + struct.pack("<I", len(frames))
    path.write_bytes(hdr + frames)


def _rows(p: Path):
    with p.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def test_every_language_and_item_is_listed_and_owner_columns_survive(vt):
    rows = vt.export()
    assert {r["lang"] for r in rows} == set(TARGETS)
    assert len(rows) == sum(1 for c in TARGETS for i in ITEMS[c] if not is_custom(i))  # family-made phrases stay private
    assert {r["status"] for r in rows} <= {"complete", "only male", "only female", "missing"}
    missing = _rows(vt.MISSING)
    assert missing and all(r["status"] != "complete" for r in missing)
    # the owner writes a note; a refresh keeps it
    saved = _rows(vt.TRACKER)
    saved[0]["notes"] = "asked grandma"
    with vt.TRACKER.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, vt.MINE + vt.YOURS)
        w.writeheader()
        w.writerows(saved)
    vt.export()
    assert _rows(vt.TRACKER)[0]["notes"] == "asked grandma"


def test_found_recordings_are_imported_only_with_a_reusable_licence(vt, tmp_path):
    vt.export()
    good, bad = tmp_path / "good.wav", tmp_path / "bad.wav"
    _wav(good), _wav(bad)
    rows = _rows(vt.TRACKER)
    a = next(r for r in rows if r["lang"] == "kn" and r["item_id"] == "p_head")
    b = next(r for r in rows if r["lang"] == "kn" and r["item_id"] == "p_tummy")
    a.update(found_url_or_file=str(good), found_license="CC BY-SA 4.0", found_speaker="Test speaker", found_gender="female", found_by="owner")
    b.update(found_url_or_file=str(bad), found_license="CC BY-NC 4.0", found_gender="male")
    with vt.TRACKER.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, vt.MINE + vt.YOURS)
        w.writeheader()
        w.writerows(rows)
    assert vt.import_found() == ["kn/p_head (female)"]
    after = {(r["lang"], r["item_id"]): r for r in _rows(vt.TRACKER)}
    assert after[("kn", "p_head")]["imported"].startswith("yes") and int(after[("kn", "p_head")]["native_female"]) >= 1
    assert after[("kn", "p_tummy")]["imported"] == "" and "not reusable" in after[("kn", "p_tummy")]["notes"]
    assert vt.import_found() == []  # never imported twice
