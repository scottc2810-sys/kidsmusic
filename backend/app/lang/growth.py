"""Raising the bar: when a child has mastered what a language offers, Melo finds and makes harder sentences.

A real teacher does not stop when the book ends. When the child knows most of the current content (every
skill at stage 4+, and three quarters of the words / phrases or of the last challenge pack), Melo prepares a
new "challenge pack" of 6 sentences, each pack longer than the last:

1. real sentences by native speakers, with their recordings, built around words the child already knows:
   from Tatoeba (searched online) and from the OpenSLR sentence pool (Google's native-speaker sets, already
   on this computer or shipped with the app, see ``openslr.py``);
2. sentences written by the AI brain one small step harder, from the child's own vocabulary, for which
   Melo then looks for native recordings of exactly that sentence.

Child safety: Tatoeba and OpenSLR are written by adults for adults. With an AI brain, every found sentence is checked as
suitable for a 3-8 year old. Without one, only sentences made entirely of words the child already knows are
accepted. Packs are saved per child like the parent's custom topics, and the engine starts mixing them into
normal lessons once the built-in content is mastered.
"""
from __future__ import annotations

import json
import logging
import random
import re
import secrets
import threading
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Child, LangItemState, LangSkillState

log = logging.getLogger("melo.growth")
PACK_SIZE = 6
MASTERED = 0.75
_running: set[tuple[str, str]] = set()
_lock = threading.Lock()


def _words(text: str, lang: str) -> list[str]:
    t = unicodedata.normalize("NFKC", text).casefold()
    if lang in ("zh", "yue", "ja"):
        return [c for c in t if unicodedata.category(c)[0] in "LN"]
    # letters, digits and combining marks (Indic vowel signs, Arabic harakat) belong to the word: "नमस्ते" is one word
    return "".join(c if unicodedata.category(c)[0] in "LMN" else " " for c in t).split()


def packs(child_id: str, lang: str) -> list[dict]:
    """This child's challenge packs in this language, oldest first."""
    from .phrases import CUSTOM_TOPICS, ITEMS

    out = [dict(id=tid, **t) for tid, t in CUSTOM_TOPICS.items() if t["child_id"] == child_id and t["title"].startswith("⭐ Challenge")
           and any(i in ITEMS.get(lang, {}) for i in t["items"])]
    return sorted(out, key=lambda p: int(re.sub(r"\D", "", p["title"]) or 0))


def status(db: Session, child: Child, lang: str) -> dict:
    """How much of the language the child has mastered, and whether a harder pack is due."""
    from .phrases import ITEMS, PHRASE_WORDS
    from .content import WORDS

    items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == lang))}
    skills = {s.skill: s for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.lang == lang))}
    base = list(WORDS[lang]) + list(PHRASE_WORDS[lang])
    known = lambda ids: sum(1 for i in ids if items.get(i) and items[i].strength >= 0.6) / max(1, len(ids))  # noqa: E731
    base_share = known(base)
    ps = packs(child.id, lang)
    last_share = known(ps[-1]["items"]) if ps else None
    skills_ok = all(skills.get(s) and skills[s].difficulty >= 4 for s in ("listen", "read", "write")) and \
        (not child.consent_microphone or (skills.get("speak") and skills["speak"].difficulty >= 4))
    content_ok = (last_share if ps else base_share) >= MASTERED
    return {"base_known": round(base_share, 3), "packs": len(ps), "last_pack_known": None if last_share is None else round(last_share, 3),
            "skills_ready": bool(skills_ok), "due": bool(skills_ok and content_ok), "mastered_base": base_share >= MASTERED and bool(skills_ok),
            "latest": ps[-1]["id"] if ps else None}


def known_words(db: Session, child: Child, lang: str) -> set[str]:
    from .phrases import ITEMS

    items = db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == lang, LangItemState.strength >= 0.6))
    out: set[str] = set()
    for it in items:
        w = ITEMS[lang].get(it.item)
        if w:
            out.update(_words(w.text, lang))
    return out


def _length(level: int) -> tuple[int, int]:
    return 2 + level, 4 + level  # pack 1: 3-5 words, pack 2: 4-6 ...


def from_tatoeba(lang: str, vocab: set[str], level: int, rng: random.Random, limit: int = 30) -> list[dict]:
    """Real sentences with native recordings that use words the child knows, the right length for this level."""
    from . import native_audio as na
    from ..config import get_settings

    lo, hi = _length(level)
    index = na._tatoeba_audio_index(get_settings().data_dir)
    seeds = rng.sample(sorted(vocab), min(8, len(vocab)))
    found: dict[str, dict] = {}
    for w in seeds:
        try:
            data = na._http_json(na.TATOEBA_API, {"lang": na.ISO3[lang], "q": w, "sort": "relevance", "limit": limit})
        except Exception as e:  # noqa: BLE001 - offline or busy: the AI part can still fill the pack
            log.info("Tatoeba search failed: %s", e)
            break
        for s in data.get("data", []):
            sid, text = str(s.get("id")), s.get("text", "")
            n = len(_words(text, lang)) if lang not in ("zh", "yue", "ja") else len(_words(text, lang)) // 2
            if sid in found or not index.get(sid) or not lo <= n <= hi or len(text) > 80:
                continue
            found[sid] = {"text": text, "sid": sid, "words": _words(text, lang), "audio": index[sid]}
    return list(found.values())


def _mix(a: list[dict], b: list[dict], each: int = 20) -> list[dict]:
    """Both sources take turns, so the AI teacher sees sentences from each."""
    out: list[dict] = []
    for x, y in zip(a[:each] + [None] * each, b[:each] + [None] * each):
        out += [c for c in (x, y) if c]
    return out


def _safe_offline(cands: list[dict], vocab: set[str]) -> list[dict]:
    """No AI to check content: only sentences made entirely of words the child already knows."""
    return [c for c in cands if c["words"] and all(w in vocab for w in c["words"])]


def grow(db: Session, child: Child, lang: str, reason: str = "mastered") -> dict:
    """Make the next challenge pack for this child and language. Returns what was made."""
    from . import native_audio as na, openslr
    from .content import TARGETS
    from .. import memory
    from ..config import get_settings
    from ..parent_chat import CustomPhrase, _loaded, load_custom_phrases
    from ..teacher.safety import clean_child_text
    from ..teacher.service import LANG_NAMES, _obj, get_teacher
    from .phrases import register_custom

    load_custom_phrases(db)
    level = len(packs(child.id, lang)) + 1
    vocab = known_words(db, child, lang)
    rng = random.Random(secrets.randbits(32))
    teacher = get_teacher()
    ai = teacher._ai_for(child)
    ui = child.language if child.language in TARGETS else "en"
    ui_name = LANG_NAMES.get(child.language, "English")
    cands = _mix(from_tatoeba(lang, vocab, level, rng), openslr.candidates(get_settings().data_dir, lang, vocab, level, rng)) if vocab else []
    chosen: list[dict] = []
    if ai and cands:
        # the AI teacher picks the child-suitable ones and gives their meaning in the child's language
        schema = _obj({"ok": {"type": "array", "items": _obj({"sid": {"type": "string"}, "meaning": {"type": "string"},
                                                                 "roman": {"type": "string"}, "emoji": {"type": "string"}})}})
        prompt = (f"These are real {TARGETS[lang].name} sentences recorded by native speakers. Choose up to {PACK_SIZE} that are perfectly "
                  f"suitable for a {child.age}-year-old learner (everyday, kind, nothing scary, adult, violent, sad or about alcohol, "
                  f"money worries, romance or death) and useful to say. For each: meaning in {ui_name}, romanisation if the script "
                  f"is not Latin (else empty), one emoji. Sentences: {json.dumps([{'sid': c['sid'], 'text': c['text']} for c in cands[:40]], ensure_ascii=False)}")
        data = teacher._ask(ai, prompt, schema, 1500) or {}
        by = {c["sid"]: c for c in cands}
        for row in (data.get("ok") or [])[:PACK_SIZE]:
            c = by.get(str(row.get("sid")))
            if c and clean_child_text(row.get("meaning") or "x"):
                chosen.append({**c, "meaning": str(row.get("meaning") or "")[:120], "roman": str(row.get("roman") or "")[:160],
                               "emoji": str(row.get("emoji") or "💬")[:4], "source": c.get("source", "tatoeba")})
    elif cands:
        for c in _safe_offline(cands, vocab)[:PACK_SIZE]:
            chosen.append({**c, "meaning": "", "roman": "", "emoji": "💬", "source": c.get("source", "tatoeba")})
    if ai and len(chosen) < PACK_SIZE:
        # the AI teacher writes the rest, one small step harder, then we look for native recordings of them
        lo, hi = _length(level)
        schema = _obj({"sentences": {"type": "array", "items": _obj({"text": {"type": "string"}, "roman": {"type": "string"},
                                                                       "meaning": {"type": "string"}, "emoji": {"type": "string"}})}})
        prompt = (f"Write {PACK_SIZE - len(chosen)} new {TARGETS[lang].name} sentences for a {child.age}-year-old who already knows these words: "
                  f"{json.dumps(sorted(vocab)[:80], ensure_ascii=False)}. Each {lo}-{hi} words, natural everyday speech a native child would "
                  f"say, using mostly known words plus at most one new word each, a small step harder than before (challenge level {level}). "
                  f"Kind and child-safe. For each: romanisation if the script is not Latin (else empty), meaning in {ui_name}, one emoji.")
        data = teacher._ask(ai, prompt, schema, 1800) or {}
        for row in (data.get("sentences") or [])[:PACK_SIZE - len(chosen)]:
            text = clean_child_text(str(row.get("text") or ""), 120)
            if text:
                chosen.append({"text": text, "sid": None, "audio": [], "meaning": str(row.get("meaning") or "")[:120],
                               "roman": str(row.get("roman") or "")[:160], "emoji": str(row.get("emoji") or "💬")[:4], "source": "ai"})
    if len(chosen) < 2:
        return {"made": False, "reason": "no suitable sentences found" + ("" if ai else " (an AI brain finds and checks many more)")}
    topic = f"c_{secrets.token_hex(3)}"
    title = f"⭐ Challenge {level}"
    data_dir = get_settings().data_dir
    m = {k: dict(v) for k, v in na.manifest(data_dir).items()}
    recorded = 0
    for c in chosen:
        pid = f"c{secrets.token_hex(6)}"
        texts = {lang: c["text"] + (f"|{c['roman']}" if c.get("roman") and not TARGETS[lang].latin else "")}
        if c.get("meaning") and ui != lang:
            texts[ui] = c["meaning"]
        cp = CustomPhrase(id=pid, child_id=child.id, topic=topic, topic_title=title, topic_emoji="⭐", emoji=c["emoji"] or "💬",
                          english=c.get("meaning") or c["text"], texts=texts)
        db.add(cp)
        register_custom(topic, title, "⭐", child.id, pid, cp.emoji, texts)
        _loaded.add(pid)
        if c.get("refs"):  # OpenSLR pool: the recordings are already here (downloaded or shipped)
            m.setdefault(lang, {})[pid] = [dict(r) for r in c["refs"]]
            recorded += 1
            continue
        sids = [c["sid"]] if c.get("sid") else []
        if not sids:
            try:
                sids = na.find_sentence(na.ISO3[lang], c["text"])
            except Exception:  # noqa: BLE001 - no recording found: the device voice is used
                sids = []
        index = na._tatoeba_audio_index(data_dir) if sids else {}
        refs = []
        for sid in sids:
            for audio_id, user, lic, attribution in (c.get("audio") or index.get(sid, []))[:3]:
                try:
                    raw = na._fetch(f"https://audio.tatoeba.org/sentences/{na.ISO3[lang]}/{sid}.mp3", "audio/mpeg", 60, 2_000_000)
                except Exception:  # noqa: BLE001
                    continue
                (na.audio_dir(data_dir) / lang).mkdir(parents=True, exist_ok=True)
                name = f"{pid}-t{len(refs)}.mp3"
                (na.audio_dir(data_dir) / lang / name).write_bytes(raw)
                refs.append({"file": f"{lang}/{name}", "speaker": user, "gender": "unknown", "license": lic,
                             "source": f"https://tatoeba.org/sentences/show/{sid}", "origin": "tatoeba", "noncommercial": "NC" in lic, "text": c["text"]})
            if len(refs) >= 3:
                break
        if refs:
            m.setdefault(lang, {})[pid] = refs
            recorded += 1
    na._save_manifest(data_dir, m)
    memory._event(db, child.id, "challenge", f"{TARGETS[lang].name}: {title} made ({len(chosen)} sentences, {recorded} with native voices; {reason})",
                  memory.nid_child(child.id))
    return {"made": True, "topic": topic, "title": title, "sentences": len(chosen), "with_native_voice": recorded,
            "from_tatoeba": sum(1 for c in chosen if c["source"] == "tatoeba"), "from_openslr": sum(1 for c in chosen if c["source"] == "openslr"),
            "from_commonvoice": sum(1 for c in chosen if c["source"] == "commonvoice"),
            "from_ai": sum(1 for c in chosen if c["source"] == "ai")}


def grow_in_background(child_id: str, lang: str, reason: str) -> bool:
    key = (child_id, lang)
    with _lock:
        if key in _running:
            return False
        _running.add(key)

    def work() -> None:
        try:
            from ..db import session_factory

            with session_factory()() as db:
                child = db.get(Child, child_id)
                if child is not None:
                    out = grow(db, child, lang, reason)
                    db.commit()
                    log.info("growth %s %s: %s", child_id, lang, out)
        except Exception:  # never disturb a lesson
            log.exception("growth failed")
        finally:
            with _lock:
                _running.discard(key)

    threading.Thread(target=work, name="melo-growth", daemon=True).start()
    return True
