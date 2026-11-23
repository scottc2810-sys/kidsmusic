"""The recordings shipped inside the installers, so every word and phrase has a voice without downloading.

    python packaging/voices.py bundle [out_dir]   # used by melo.spec: copy the shippable recordings
    python packaging/voices.py pack   [zip]       # make a voice pack (zip) for build machines without data/
    python packaging/voices.py fetch  URL|PATH    # unpack a voice pack into data/native_audio (CI)

Shipped: native-speaker recordings under licences that allow it (Lingua Libre CC BY-SA, OpenSLR CC BY-SA,
Tatoeba CC BY / CC BY-SA / CC0) and the synthetic neural-voice clips for words without a native speaker.
Never shipped: family recordings (they stay on that computer), non-commercial Tatoeba clips, and Common
Voice clips (its terms forbid re-sharing). Set MELO_BUNDLE_SYNTHETIC=0 to leave the synthetic clips out
(installed apps then record them on first use when online).
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NATIVE = ROOT / "data" / "native_audio"


def shippable(r: dict) -> bool:
    return not r.get("family") and not r.get("noncommercial") and not r.get("noshare")


def bundle(out: Path, src: Path = NATIVE) -> dict:
    """Copy the shippable recordings to `out` with their manifests. Returns counts."""
    shutil.rmtree(out, ignore_errors=True)
    stats = {"native": 0, "synthetic": 0}
    if (src / "manifest.json").is_file():
        public: dict = {}
        for lang, items in json.loads((src / "manifest.json").read_text(encoding="utf-8")).items():
            for item, refs in items.items():
                keep = [r for r in refs if shippable(r) and (src / r["file"]).is_file()]
                for r in keep:
                    (out / lang).mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src / r["file"], out / r["file"])
                if keep:
                    public.setdefault(lang, {})[item] = keep
                    stats["native"] += len(keep)
        if public:
            (out / "manifest.json").write_text(json.dumps(public, ensure_ascii=False), encoding="utf-8")
    if os.environ.get("MELO_BUNDLE_SYNTHETIC", "1") != "0" and (src / "tts.json").is_file():
        synth: dict = {}
        for lang, items in json.loads((src / "tts.json").read_text(encoding="utf-8")).items():
            for item, slots in items.items():
                for g, e in slots.items():
                    if (src / e["file"]).is_file():
                        (out / lang).mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src / e["file"], out / e["file"])
                        synth.setdefault(lang, {}).setdefault(item, {})[g] = e
                        stats["synthetic"] += 1
        if synth:
            (out / "tts.json").write_text(json.dumps(synth, ensure_ascii=False), encoding="utf-8")
    return stats


def pack(zip_path: Path) -> dict:
    tmp = ROOT / "build" / "voice_pack"
    stats = bundle(tmp)
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:  # audio is already compressed or tiny
        for f in sorted(tmp.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(tmp).as_posix())
    return stats


def fetch(source: str) -> int:
    """Unpack a voice pack (a local path or an https URL) into data/native_audio, merging the manifests."""
    if source.startswith("https://"):
        tmp = ROOT / "build" / "voices.zip"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(source, tmp)  # noqa: S310 - https only
        source = str(tmp)
    NATIVE.mkdir(parents=True, exist_ok=True)
    n = 0
    with zipfile.ZipFile(source) as z:
        for name in z.namelist():
            target = (NATIVE / name).resolve()
            if NATIVE.resolve() not in target.parents:  # no path tricks
                continue
            if name in ("manifest.json", "tts.json"):
                incoming = json.loads(z.read(name))
                have = json.loads((NATIVE / name).read_text(encoding="utf-8")) if (NATIVE / name).is_file() else {}
                for lang, items in incoming.items():
                    have.setdefault(lang, {}).update({k: v for k, v in items.items() if k not in have.get(lang, {})})
                (NATIVE / name).write_text(json.dumps(have, ensure_ascii=False), encoding="utf-8")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(z.read(name))
                n += 1
    return n


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "bundle":
        print(bundle(Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "build" / "native_bundle"))
    elif cmd == "pack":
        z = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "dist" / "melo-voices.zip"
        print(pack(z), "->", z)
    elif cmd == "fetch" and len(sys.argv) > 2:
        print(fetch(sys.argv[2]), "files added")
    else:
        print(__doc__)
        sys.exit(2)
