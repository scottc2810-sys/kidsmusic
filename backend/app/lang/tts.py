"""Synthetic voices for every word and phrase that has no native-speaker recording yet.

Native recordings (Lingua Libre, Tatoeba, OpenSLR, Common Voice, family) always come first. Many phrases,
above all the little conversations, have none in most languages, and many computers have no device voice
for Marathi, Gujarati, Tamil, Kannada, Cantonese, Sanskrit ... so the lesson stayed silent. This module fills
the gap with pretrained neural voices, one female and one male per language where available:

* ``edge``   - Microsoft neural voices through the ``edge-tts`` package (online, about 1 s per phrase,
               native accent for 18 of the 20 languages). Generated on first use and cached.
* ``gtts``   - Google Translate voice through ``gTTS`` (online): only for Punjabi, which edge lacks.
* ``parler`` - AI4Bharat Indic-Parler-TTS (offline, Apache-2.0), the only pretrained model that officially
               speaks Sanskrit ("Aryan"); also Punjabi. Heavy (torch, about 4 GB, slow on a CPU), so it is used
               only for pre-recording:  ``python -m app.lang.tts --parler sa pa``. Never generated during a lesson.

Sanskrit without Parler falls back to a Hindi neural voice (same Devanagari script) with Sanskrit spelling
fixes (see ``sanskrit_for_hindi_voice``), better than silence but with a Hindi accent: pre-record with Parler.

Synthetic clips are for listening only. They are never used as the reference when a child's pronunciation
is scored (see routers/native.py: compare_voice uses native_audio.references only).
Only the app's own built-in words are sent to the online services; parents' custom phrases never are.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from .native_audio import audio_dir

log = logging.getLogger("melo.tts")

CUSTOM_ID = re.compile(r"c[0-9a-f]{12}")  # a parent's own phrase (parent_chat.py): stays on this computer


def is_custom(item: str) -> bool:
    return bool(CUSTOM_ID.fullmatch(item))


@dataclass(frozen=True)
class Voice:
    engine: str  # edge | gtts | parler
    name: str  # engine voice id / Parler speaker or description
    gender: str  # female | male
    rate: str = "-10%"  # a little slower than conversation: these are learners
    sanskrit: bool = False  # Hindi voice reading Sanskrit: apply the spelling fixes


def _edge(f: str, m: str, rate: str = "-10%") -> list[Voice]:
    return [Voice("edge", f, "female", rate), Voice("edge", m, "male", rate)]


# Best first per gender. The first voice that is available (or already recorded) is used.
VOICES: dict[str, list[Voice]] = {
    "en": _edge("en-US-AnaNeural", "en-US-GuyNeural") + [Voice("edge", "en-US-ChristopherNeural", "male")],  # Ana: a child's voice
    "hi": _edge("hi-IN-SwaraNeural", "hi-IN-MadhurNeural"),
    "mr": _edge("mr-IN-AarohiNeural", "mr-IN-ManoharNeural"),
    "fr": _edge("fr-FR-DeniseNeural", "fr-FR-HenriNeural"),
    "es": _edge("es-ES-ElviraNeural", "es-ES-AlvaroNeural"),
    "ar": _edge("ar-SA-ZariyahNeural", "ar-SA-HamedNeural"),
    "zh": _edge("zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"),
    "yue": _edge("zh-HK-HiuGaaiNeural", "zh-HK-WanLungNeural"),  # Cantonese, not Mandarin
    "ko": _edge("ko-KR-SunHiNeural", "ko-KR-InJoonNeural"),
    "ru": _edge("ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"),
    "tr": _edge("tr-TR-EmelNeural", "tr-TR-AhmetNeural"),
    "gu": _edge("gu-IN-DhwaniNeural", "gu-IN-NiranjanNeural"),
    "bn": _edge("bn-IN-TanishaaNeural", "bn-IN-BashkarNeural"),
    "ta": _edge("ta-IN-PallaviNeural", "ta-IN-ValluvarNeural"),
    "te": _edge("te-IN-ShrutiNeural", "te-IN-MohanNeural"),
    "kn": _edge("kn-IN-SapnaNeural", "kn-IN-GaganNeural"),
    "de": _edge("de-DE-TanjaNeural", "de-DE-ChristophNeural"),
    "ja": _edge("ja-JP-NanamiNeural", "ja-JP-KeitaNeural"),
    "sa": [
        Voice("parler", "Aryan", "male"),
        Voice("parler", "A female speaker", "female"),
        Voice("edge", "hi-IN-SwaraNeural", "female", "-20%", sanskrit=True),
        Voice("edge", "hi-IN-MadhurNeural", "male", "-20%", sanskrit=True),
    ],
    "pa": [
        Voice("parler", "Divjot", "female"),
        Voice("parler", "Gurpreet", "male"),
        Voice("gtts", "pa", "female"),
    ],
}
GENDERS = ("female", "male")
CREDIT = {"edge": "Microsoft neural voice (synthetic)", "gtts": "Google voice (synthetic)",
          "parler": "AI4Bharat Indic-Parler-TTS (synthetic, Apache-2.0)"}

# --- Sanskrit read by a Hindi voice ---------------------------------------------------------------------
_VIRAMA = "्"
_VOWEL_SIGN_ECHO = {"ि": "ि", "ी": "ि", "ु": "ु", "ू": "ु", "े": "े", "ै": "ि", "ो": "ो", "ौ": "ु"}


def sanskrit_for_hindi_voice(text: str) -> str:
    """Spell Sanskrit so a Hindi voice says it the Sanskrit way. Only what a Hindi voice gets wrong:

    * visarga ः is pronounced as an h followed by a short echo of the vowel before it, as in recitation:
      रामः -> राम-ह (raamaha), रात्रिः -> रात्रि-हि (raatrihi), शनैः -> शनै-हि (ai echoes i, au echoes u); before a consonant
      inside a word (दुःखम्) only the h: दुह्खम्. A Hindi voice otherwise drops ः or says "h" without the echo.
    * the avagraha ऽ and the double danda ॥ are dropped (they are not spoken).
    The inherent final "a" (नाम = naama) cannot be forced on a Hindi voice; Indic-Parler-TTS gets it right.
    """
    out = []
    for i, ch in enumerate(text):
        if ch != "ः":
            out.append(ch)
            continue
        nxt = text[i + 1] if i + 1 < len(text) else " "
        word_end = not ("ऀ" <= nxt <= "ॿ")
        if not word_end:
            out.append("ह" + _VIRAMA)
            continue
        prev = text[i - 1] if i else ""
        out.append("ह" + _VOWEL_SIGN_ECHO.get(prev, ""))  # inherent a after a consonant: plain ह = "ha"
    return "".join(out).replace("ऽ", "").replace("॥", "।")


# --- engines --------------------------------------------------------------------------------------------
class Unavailable(Exception):
    pass


def _online_allowed() -> bool:
    from ..config import get_settings

    return bool(getattr(get_settings(), "tts_online", True))


def engine_ready(engine: str) -> bool:
    try:
        if engine == "edge":
            import edge_tts  # noqa: F401
        elif engine == "gtts":
            import gtts  # noqa: F401
        elif engine == "parler":
            import parler_tts  # noqa: F401
        else:
            return False
    except ImportError:
        return False
    return engine == "parler" or _online_allowed()


def _say_edge(text: str, v: Voice, out: Path) -> None:
    import edge_tts

    async def run() -> None:
        await edge_tts.Communicate(text, v.name, rate=v.rate).save(str(out))

    asyncio.run(run())


def _say_gtts(text: str, v: Voice, out: Path) -> None:
    from gtts import gTTS

    gTTS(text, lang=v.name, slow=False).save(str(out))


_parler: dict = {}


def _say_parler(text: str, v: Voice, out: Path, lang: str) -> None:
    import numpy as np
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    from .native_audio import encode_wav, normalise, trim

    if not _parler:
        repo = "ai4bharat/indic-parler-tts"
        dev = "cuda:0" if torch.cuda.is_available() else "cpu"
        model = ParlerTTSForConditionalGeneration.from_pretrained(repo).to(dev)
        _parler.update(model=model, dev=dev, tok=AutoTokenizer.from_pretrained(repo),
                       desc=AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path))
    language = {"sa": "Sanskrit", "pa": "Punjabi"}.get(lang, "")
    who = v.name
    description = (f"{who} speaks {language} slowly and clearly with a warm, friendly tone, "
                   "in a very clear, close-sounding recording with no background noise.")
    d = _parler["desc"](description, return_tensors="pt").to(_parler["dev"])
    p = _parler["tok"](text, return_tensors="pt").to(_parler["dev"])
    with torch.inference_mode():
        audio = _parler["model"].generate(input_ids=d.input_ids, attention_mask=d.attention_mask,
                                          prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
    x = np.asarray(audio.cpu().numpy().squeeze(), dtype=np.float32)
    out.write_bytes(encode_wav(normalise(trim(x, _parler["model"].config.sampling_rate)), _parler["model"].config.sampling_rate))


# --- cache ----------------------------------------------------------------------------------------------
_locks: dict[str, threading.Lock] = {}
_guard = threading.Lock()
_manifest_lock = threading.Lock()


def _manifest_path(data_dir: Path) -> Path:
    return audio_dir(data_dir) / "tts.json"


def _load(data_dir: Path) -> dict:
    try:
        return json.loads(_manifest_path(data_dir).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _record(data_dir: Path, lang: str, item: str, gender: str, entry: dict) -> None:
    with _manifest_lock:
        data = _load(data_dir)
        data.setdefault(lang, {}).setdefault(item, {})[gender] = entry
        p = _manifest_path(data_dir)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(f".{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(p)


def _text(lang: str, item: str) -> str:
    from .phrases import ITEMS

    w = ITEMS.get(lang, {}).get(item)
    if w is None:
        raise KeyError(item)
    return w.text


_bundled_cache: dict = {}


def _bundled() -> dict:
    """Clips shipped inside the installed app (read-only), recorded when the installer was built."""
    if "m" not in _bundled_cache:
        from .native_audio import bundled_dir

        try:
            _bundled_cache["m"] = json.loads((bundled_dir() / "tts.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            _bundled_cache["m"] = {}
    return _bundled_cache["m"]


def cached(data_dir: Path, lang: str, item: str, gender: str) -> dict | None:
    """The recorded clip for this voice slot, if it exists and matches the current text:
    recorded on this computer first, then the ones shipped with the app ({"bundled": True})."""
    from .native_audio import bundled_dir

    try:
        text = _text(lang, item)
    except KeyError:
        return None
    e = _load(data_dir).get(lang, {}).get(item, {}).get(gender)
    if e and e.get("text") == text and (audio_dir(data_dir) / e["file"]).is_file():
        return e
    b = _bundled().get(lang, {}).get(item, {}).get(gender)
    if b and b.get("text") == text and (bundled_dir() / b["file"]).is_file():
        return {**b, "bundled": True}
    return None


def _live_voices(lang: str, gender: str) -> list[Voice]:
    """Voices that can record right now, during a lesson (fast engines only, never Parler), best first."""
    return [v for v in VOICES.get(lang, []) if v.gender == gender and v.engine != "parler" and engine_ready(v.engine)]


def _live_voice(lang: str, gender: str) -> Voice | None:
    return next(iter(_live_voices(lang, gender)), None)


def ensure(data_dir: Path, lang: str, item: str, gender: str, voice: Voice | None = None) -> dict:
    """Record (once) and return the clip's manifest entry. Raises Unavailable when no engine can."""
    if is_custom(item):
        raise Unavailable("a parent's own phrase is never sent to an online voice")
    have = cached(data_dir, lang, item, gender)
    if have and (voice is None or have.get("engine") == voice.engine):
        return have
    if voice is None:  # try each voice in turn: a service may drop one voice without notice
        candidates = _live_voices(lang, gender)
        if not candidates:
            raise Unavailable(f"no synthetic {gender} voice for {lang} on this computer")
        last: Unavailable | None = None
        for v in candidates:
            try:
                return ensure(data_dir, lang, item, gender, v)
            except Unavailable as e:
                last = e
        raise last or Unavailable("no voice worked")
    v = voice
    key = f"{lang}/{item}/{gender}"
    with _guard:
        lock = _locks.setdefault(key, threading.Lock())
    with lock:
        have = cached(data_dir, lang, item, gender)
        if have and have.get("engine") == v.engine:
            return have
        text = _text(lang, item)
        spoken = sanskrit_for_hindi_voice(text) if v.sanskrit else text
        ext = "wav" if v.engine == "parler" else "mp3"
        name = f"{item}-tts-{v.engine}-{gender[0]}.{ext}"
        if not re.fullmatch(r"[A-Za-z0-9_.\-]{1,120}", name):
            raise Unavailable("unsafe item id")
        out = audio_dir(data_dir) / lang / name
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(f".part.{ext}")
        try:
            if v.engine == "edge":
                _say_edge(spoken, v, tmp)
            elif v.engine == "gtts":
                _say_gtts(spoken, v, tmp)
            elif v.engine == "parler":
                _say_parler(spoken, v, tmp, lang)
            if not tmp.is_file() or tmp.stat().st_size < 500:
                raise Unavailable("the voice returned no audio")
            tmp.replace(out)
        except Unavailable:
            raise
        except Exception as e:  # network down, service changed: the page falls back to another voice
            log.warning("TTS %s %s failed: %s", key, v.engine, e)
            raise Unavailable(str(e)[:200]) from None
        finally:
            tmp.unlink(missing_ok=True)
        entry = {"file": f"{lang}/{name}", "engine": v.engine, "voice": v.name, "gender": gender, "text": text,
                 "license": CREDIT[v.engine], "approx": "Hindi voice reading Sanskrit" if v.sanskrit else None}
        _record(data_dir, lang, item, gender, entry)
        return entry


def slots(data_dir: Path, lang: str, item: str) -> list[dict]:
    """What the page may play when no native recording exists: one per gender, recorded or recordable now.
    {gender, file?, engine, voice, license, approx, live}  (live = will be recorded on first play)."""
    out = []
    for g in GENDERS:
        e = cached(data_dir, lang, item, g)
        if e:
            out.append({**e, "live": False})
            continue
        if is_custom(item):
            continue
        v = _live_voice(lang, g)
        if v:
            out.append({"gender": g, "engine": v.engine, "voice": v.name, "license": CREDIT[v.engine],
                        "approx": "Hindi voice reading Sanskrit" if v.sanskrit else None, "live": True})
    return out


def prerecord(data_dir: Path, langs: list[str] | None = None, use_parler: bool = False, only_missing_native: bool = True,
              progress=None) -> dict:
    """Record every built-in word and phrase ahead of time (so lessons also work offline)."""
    from . import native_audio as na
    from .phrases import ITEMS

    stats: dict[str, dict] = {}
    for lang in langs or list(VOICES):
        made = failed = skipped = 0
        for item in ITEMS.get(lang, {}):
            shippable = [r for r in na.references(data_dir, lang, item)
                         if not (r.get("family") or r.get("noncommercial") or r.get("noshare"))]
            # recordings that cannot ship in the installers (non-commercial, Common Voice, family) don't count:
            # an installed copy would have no voice for that item
            if is_custom(item) or (only_missing_native and shippable):
                skipped += 1
                continue
            for g in GENDERS:
                order = [v for v in VOICES.get(lang, []) if v.gender == g and (use_parler or v.engine != "parler") and engine_ready(v.engine)]
                for v in order:
                    try:
                        ensure(data_dir, lang, item, g, v)
                        made += 1
                        break
                    except Unavailable as e:
                        log.warning("%s %s %s via %s: %s", lang, item, g, v.engine, e)
                else:
                    failed += bool(order)
        stats[lang] = {"recorded": made, "failed": failed, "skipped_native": skipped}
        if progress:
            progress(lang, stats[lang])
    return stats


if __name__ == "__main__":  # python -m app.lang.tts [--parler] [--all] [langs...]
    import sys

    from ..config import get_settings

    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.WARNING)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    res = prerecord(get_settings().data_dir, args or None, use_parler="--parler" in sys.argv,
                    only_missing_native="--all" not in sys.argv, progress=lambda lang, s: print(lang, s, flush=True))
