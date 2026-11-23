"""Language learning API: pick a language, then a stream of short listen / speak / read / write activities.

Like the music lessons, the server builds each activity (the answer stays here), the app sends
back what the child did, and the server judges it and adapts. There is no timer and no lesson
length: a child can do one word or fifty. Speaking is only offered when the parent allowed the
microphone and the browser can recognise speech.
"""
from __future__ import annotations

import random
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import assessment, memory
from ..db import get_db
from ..lang import engine
from ..lang.content import TARGETS, WORDS
from ..lang.phrases import ITEMS, PHRASE_TOPICS, TOPIC_IDS, TOPIC_OF, custom_topics_for, is_topic, topic_pool
from ..models import Child, LangAttempt, LangItemState, LangSkillState
from ..schemas import Strict
from ..security import owned_child
from ..teacher.emotion import react
from ..teacher.service import get_teacher

router = APIRouter(prefix="/api", tags=["learn"])
SITTING = timedelta(minutes=30)


class NextIn(Strict):
    focus: str | None = Field(default=None, pattern="^(listen|speak|read|write)$")
    speech: bool = False  # the browser can recognise speech and the microphone is on
    topic: str | None = Field(default=None, max_length=20)  # a conversation topic, or None for picture words


class PracticeIn(Strict):
    item: str = Field(max_length=40)
    skill: str = Field(pattern="^(listen|speak|read|write)$")


class AnswerIn(Strict):
    response: dict = Field(default_factory=dict)


def item_state_new(items: dict, act) -> bool:
    return act.spec.get("item") not in items


def _maybe_grow(db: Session, child: Child, lang: str, after: dict) -> None:
    """Mastered what is there? Prepare the next, harder challenge pack in the background."""
    if after.get("stage", 0) < 4:
        return
    from ..lang import growth

    st = growth.status(db, child, lang)
    if st["due"]:
        growth.grow_in_background(child.id, lang, "the child mastered the current content")


def _native(lang: str, item: str | None) -> list[dict]:
    from .native import public_refs

    return public_refs(lang, item)


def _load_custom(db: Session) -> None:
    from ..parent_chat import load_custom_phrases

    load_custom_phrases(db)


def _with_custom(db: Session, child: Child, lang: str, summ: dict) -> dict:
    """Add the topics a parent asked for (AI-made phrases for this child) to the topic chips."""
    _load_custom(db)
    items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == lang))}
    for t in custom_topics_for(child.id, lang):
        summ["topics"].append({"id": t["id"], "emoji": t["emoji"], "title": t["title"], "total": len(t["items"]), "custom": True,
                               "known": sum(1 for i in t["items"] if items.get(i) and items[i].strength >= engine.KNOWN)})
    return summ


def _target(lang: str):
    if lang not in TARGETS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We do not teach this language yet")
    return TARGETS[lang]


def _state(db: Session, child: Child, lang: str) -> tuple[dict[str, LangSkillState], dict[str, LangItemState]]:
    skills = {s.skill: s for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.lang == lang))}
    for name in engine.SKILLS:
        if name not in skills:
            skills[name] = LangSkillState(child_id=child.id, lang=lang, skill=name, mastery=0.0, difficulty=1, attempts=0, successes=0,
                                          streak=0, fail_streak=0)
            db.add(skills[name])
    items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == lang))}
    db.flush()
    return skills, items


def _recent(db: Session, child: Child, lang: str) -> list[LangAttempt]:
    since = datetime.now(timezone.utc) - SITTING
    return list(db.scalars(select(LangAttempt).where(
        LangAttempt.child_id == child.id, LangAttempt.lang == lang, LangAttempt.outcome.is_not(None), LangAttempt.created_at >= since)
        .order_by(LangAttempt.created_at.desc()).limit(6)))


@router.get("/learn/languages")
def languages() -> list[dict]:
    return [{"code": t.code, "name": t.name, "native": t.native, "flag": t.flag, "rtl": t.rtl, "locale": t.locale, "words": len(WORDS[t.code])}
            for t in TARGETS.values()]


@router.get("/learn/compare")
def compare(langs: str, topic: str = "greetings", ui: str = "en") -> dict:
    """The same words or phrases side by side in as many of the taught languages as the family chooses."""
    codes = [c for c in dict.fromkeys(x.strip() for x in langs.split(",")) if c]
    if not 1 <= len(codes) <= len(TARGETS) or any(c not in TARGETS for c in codes):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Choose 1 to {len(TARGETS)} languages we teach")
    if topic != "words" and topic not in TOPIC_IDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown topic")
    meaning_lang, roman_meaning = ("hi", True) if ui == "hinglish" else ((ui, False) if ui in TARGETS else ("en", False))
    meanings = {w.id: (w.roman if roman_meaning and w.roman else w.text) for w in topic_pool(meaning_lang, topic)}
    rows = []
    for w in topic_pool("en", topic):
        rows.append({"id": w.id, "emoji": w.emoji, "meaning": meanings.get(w.id, w.text), "english": w.text,
                     "cells": {c: {"text": ITEMS[c][w.id].text, "roman": ITEMS[c][w.id].roman} for c in codes}})
    t = TARGETS
    return {"topic": topic, "rows": rows,
            "topics": [{"id": "words", "emoji": "🔤", "title": "Words"}] + [{"id": a, "emoji": b, "title": c} for a, b, c in PHRASE_TOPICS],
            "languages": [{"code": c, "name": t[c].name, "native": t[c].native, "flag": t[c].flag, "locale": t[c].locale, "rtl": t[c].rtl, "latin": t[c].latin} for c in codes]}


@router.post("/children/{child_id}/learn/{lang}/practice", status_code=201)
def practice(lang: str, body: PracticeIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Practise one chosen word or phrase (from the side-by-side view): hear-and-pick, read, say or write it.
    Answered like any other activity, so it counts toward the child's progress."""
    _target(lang)
    if body.item not in ITEMS[lang]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown word")
    if body.skill == "speak" and not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Speaking needs a parent to allow the microphone")
    skills, items = _state(db, child, lang)
    pool = topic_pool(lang, TOPIC_OF.get(body.item, "words"))
    word = ITEMS[lang][body.item]
    d = skills[body.skill].difficulty
    act = engine.build(lang, word, body.skill, d, pool, random.Random(secrets.randbits(32)), hint=not TARGETS[lang].latin and d <= 2)
    attempt = LangAttempt(child_id=child.id, lang=lang, activity=act.type, skill=act.skill, difficulty=act.difficulty, spec=act.spec)
    db.add(attempt)
    db.commit()
    return {"attempt_id": attempt.id, "type": act.type, "skill": act.skill, "difficulty": act.difficulty, "spec": act.public,
            "say": get_teacher().say(f"lang.intro.{act.type}", child.language).replace("{name}", child.name), "retry": False, "comfort": False,
            "native": _native(lang, act.spec.get("item")), "native_question": _native(lang, act.spec.get("question_item"))}


@router.get("/children/{child_id}/learn")
def overview(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[dict]:
    """Every language with this child's place on the listen-speak-read-write scale."""
    out = []
    for code in TARGETS:
        skills = {s.skill: s for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.lang == code))}
        items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == code))}
        out.append(engine.summary(code, skills, items, speech=child.consent_microphone, reached=memory.lang_reached(db, child.id, code)))
    return out


@router.get("/children/{child_id}/learn/{lang}")
def language_status(lang: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    _target(lang)
    skills, items = _state(db, child, lang)
    db.commit()
    return _with_custom(db, child, lang, engine.summary(lang, skills, items, speech=child.consent_microphone, reached=memory.lang_reached(db, child.id, lang)))


@router.post("/children/{child_id}/learn/{lang}/next", status_code=201)
def next_activity(lang: str, body: NextIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    _target(lang)
    skills, items = _state(db, child, lang)
    # an activity left unanswered (tab closed, child wandered off) is simply dropped: no penalty
    for a in db.scalars(select(LangAttempt).where(LangAttempt.child_id == child.id, LangAttempt.lang == lang, LangAttempt.outcome.is_(None))):
        db.delete(a)
    recent = _recent(db, child, lang)
    miss_run = 0
    for a in recent:
        if a.outcome != "miss":
            break
        miss_run += 1
    last = None
    if recent:
        a = recent[0]
        last = {"item": (a.spec or {}).get("item"), "outcome": a.outcome, "type": a.activity, "skill": a.skill, "retry": bool((a.spec or {}).get("retry"))}
    speech = bool(body.speech and child.consent_microphone)
    _load_custom(db)
    if body.topic and not is_topic(body.topic, child.id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown topic")
    # a new sitting (new day, closed tab, another device) for a child with history: welcome back and warm up
    returning = not recent and any(i.seen for i in items.values())
    from ..lang import growth

    grow_state = growth.status(db, child, lang)
    challenge = None
    if not body.topic and not body.focus and grow_state["mastered_base"] and grow_state["latest"] and random.random() < 0.5:
        challenge = grow_state["latest"]  # the built-in content is mastered: half the turns come from the newest challenge
        body = body.model_copy(update={"topic": challenge})
    act = engine.choose(lang, skills, items, random.Random(secrets.randbits(32)), focus=body.focus, speech=speech, last=last, miss_run=miss_run,
                        topic=body.topic, warmup=returning and not body.focus, need=assessment.needs(db, child, f"lang:{lang}"))
    attempt = LangAttempt(child_id=child.id, lang=lang, activity=act.type, skill=act.skill, difficulty=act.difficulty, spec=act.spec)
    db.add(attempt)
    db.commit()
    teacher = get_teacher()
    ui = child.language
    lines = []
    if returning:
        known = sum(1 for k, i in items.items() if k in ITEMS[lang] and engine.once_known(i))
        lines.append(teacher.say("lang.welcome_back", ui, n=known) if known >= 2 else teacher.say("lang.welcome_back_new", ui))
    if challenge and item_state_new(items, act):
        lines.append(teacher.say("lang.challenge", ui))
    if "errorless" in act.events:
        lines.append(teacher.say("lang.errorless", ui))
    elif "comfort" in act.events:
        lines.append(teacher.say("lang.comfort", ui))
    elif "retry" in act.events:
        lines.append(teacher.say("retry", ui))
    item_state = items.get(act.spec.get("item", ""))
    if item_state is None and act.spec.get("item") in ITEMS[lang] and "retry" not in act.events and "warmup" not in act.events:
        lines.append(teacher.say("lang.new_phrase" if act.spec["item"].startswith("p_") else "lang.new_word", ui))
    lines.append(teacher.say(_intro_key(act), ui))
    return {"attempt_id": attempt.id, "type": act.type, "skill": act.skill, "difficulty": act.difficulty, "spec": act.public,
            "say": " ".join(lines).replace("{name}", child.name), "retry": "retry" in act.events, "comfort": "comfort" in act.events,
            "native": _native(lang, act.spec.get("item")),
            "native_question": _native(lang, act.spec.get("question_item")),
            "emotion": _intro_emotion(act)}


def _intro_key(act: engine.Activity) -> str:
    if "conversation" in act.events:
        return "lang.intro.say_reply" if act.type == "say_word" else "lang.intro.reply_pick"
    if act.spec.get("barakhadi"):
        return "lang.intro.barakhadi"
    if "sentence" in act.events:
        return "lang.intro.sentence"
    return f"lang.intro.{act.type}"


def _intro_emotion(act: engine.Activity) -> str:
    """How Melo sounds while setting up the next activity: gentle after a struggle, curious for something new."""
    if "comfort" in act.events or "retry" in act.events or "errorless" in act.events:
        return "calm"
    if "warmup" in act.events:
        return "warm"
    if "conversation" in act.events:
        return "playful"
    return "curious" if act.difficulty <= 2 else "warm"


@router.post("/children/{child_id}/learn/attempts/{attempt_id}/answer")
def answer(attempt_id: str, body: AnswerIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    attempt = db.get(LangAttempt, attempt_id)
    if attempt is None or attempt.child_id != child.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    if attempt.outcome is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This activity was already answered")
    if attempt.activity == "say_word" and body.response.get("heard") and not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Microphone input is not allowed for this child")
    lang = attempt.lang
    skills, items = _state(db, child, lang)
    reached = memory.lang_reached(db, child.id, lang)
    before = engine.summary(lang, skills, items, speech=child.consent_microphone, reached=reached)
    try:
        result = engine.score(attempt.activity, attempt.spec, body.response)
        pron = ((attempt.response or {}).get("pronunciation") or {}).get("score")
        if attempt.activity == "say_word" and pron is not None:
            # second opinion from the native-speaker comparison: speech recognisers often miss small children's voices
            if result.outcome == "uncertain" and pron >= 75:
                result = engine.Result("success", round(pron / 100, 3), {**result.detail, "via": "native comparison"})
            elif result.outcome == "miss" and pron >= 70:
                result = engine.Result("partial", round(pron / 100, 3), {**result.detail, "via": "native comparison"})
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Invalid response: {exc}") from None
    item_id = attempt.spec.get("item")
    item = None
    if item_id in ITEMS[lang] and result.outcome in ("success", "partial", "miss"):
        item = items.get(item_id)
        if item is None:
            item = LangItemState(child_id=child.id, lang=lang, item=item_id, strength=0.0, seen=0, correct=0)
            db.add(item)
            items[item_id] = item
    events = engine.apply(skills[attempt.skill], item, result, attempt.difficulty, guided=(attempt.spec or {}).get("glow") is not None)
    attempt.response = {**{k: v for k, v in (attempt.response or {}).items() if k == "pronunciation"},
                        **{k: v for k, v in body.response.items() if k in ("choice", "heard", "coverage", "spill", "text", "skipped")}}
    attempt.outcome, attempt.score, attempt.answered_at = result.outcome, result.score, datetime.now(timezone.utc)
    db.flush()
    after = _with_custom(db, child, lang, engine.summary(lang, skills, items, speech=child.consent_microphone,
                                                         reached=memory.lang_reached(db, child.id, lang)))
    db.commit()

    teacher = get_teacher()
    ui = child.language
    o = result.outcome
    if after["stage"] > before["stage"]:
        events.append("stage_up")
    # how this sitting is going: a streak to cheer, or a run of misses to be gentle about
    prior = [a for a in _recent(db, child, lang) if a.id != attempt.id]
    streak = miss_run = 0
    for a in prior:
        if a.outcome != "success":
            break
        streak += 1
    for a in prior:
        if a.outcome != "miss":
            break
        miss_run += 1
    feel = react(o, streak=streak + 1 if o == "success" else 0, miss_run=miss_run, events=events, skill=attempt.skill,
                 difficulty=attempt.difficulty, conversation=bool((attempt.spec or {}).get("question")))
    if attempt.activity == "say_word" and o == "uncertain":
        parts = [teacher.say("lang.unheard", ui)]
    elif attempt.activity == "say_word" and o in ("partial", "miss"):
        parts = [teacher.say("lang.almost", ui)]  # recognition is unreliable: never tell a child they said it wrong
        feel = react("partial")
    else:
        # the specific, emotional line replaces the generic one ("Three in a row!" rather than "Correct")
        parts = [teacher.say(k, ui) for k in feel.lines] or [teacher.say(o, ui)]
        if o == "miss":
            parts.append(teacher.say("lang.reveal", ui))
    if "stage_up" in events:
        parts.append(teacher.say("lang.stage_up", ui, n=after["stage"]))
    elif after["tier"] > before["tier"]:
        events.append("new_words")
        parts.append(teacher.say("lang.new_words", ui))
    elif "harder" in events or "easier" in events:
        parts.append(teacher.say("harder" if "harder" in events else "easier", ui))
    # the child's learning graph: language stages, the word's memory, struggles and milestones
    memory.record_language(db, child, lang, after, item, events)
    assessment.update_after_activity(db, child)  # progress tracker: measured after every single activity
    db.commit()
    if o == "success":
        _maybe_grow(db, child, lang, after)
    if assessment.ai_due(db, child):  # every 12 answers: the AI teacher's 20 %, saved long before any session or token limit ends
        assessment.request_ai_assessment(child.id, "regular review during a language sitting")
    word = ITEMS[lang].get(item_id)
    reveal = {"correct": attempt.spec.get("answer") if attempt.activity != "say_word" else None,
              "word": word.text if word else attempt.spec.get("say") or attempt.spec.get("glyph"),
              "roman": word.roman if word else None, "emoji": word.emoji if word else None, "heard": result.detail.get("heard"),
              "pronunciation": ((attempt.response or {}).get("pronunciation") or {}).get("score"), "native": _native(lang, item_id)}
    reveal["why"] = why_line(lang, ui, attempt.spec or {}, item_id)
    return {"outcome": o, "score": result.score, "say": " ".join(p for p in parts if p).replace("{name}", child.name), "events": events,
            "star": o in ("success", "partial"), "reveal": reveal, "status": after,
            "emotion": feel.emotion, "energy": feel.energy, "sfx": feel.sfx, "streak": streak + 1 if o == "success" else 0}


@router.post("/children/{child_id}/learn/{lang}/end")
def end_sitting(lang: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """The child leaves a language lesson: save the progress tracker and ask the AI teacher for its review."""
    _target(lang)
    t = assessment.update_after_activity(db, child)
    db.commit()
    started = assessment.request_ai_assessment(child.id, f"{lang} sitting ended")
    area = next((a for a in t["areas"] if a["id"] == f"lang:{lang}"), None)
    return {"saved": True, "ai_review": started, "area": area}


@router.get("/children/{child_id}/learn/{lang}/growth")
def growth_status(lang: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """How much of this language is mastered, and the challenge packs made so far."""
    from ..lang import growth

    _target(lang)
    _load_custom(db)
    return {**growth.status(db, child, lang), "list": [{"id": p["id"], "title": p["title"], "items": len(p["items"])} for p in growth.packs(child.id, lang)]}


@router.post("/children/{child_id}/learn/{lang}/grow")
def grow_now(lang: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """A parent asks for the next, harder challenge pack now (even before the current content is mastered)."""
    from ..lang import growth

    _target(lang)
    _load_custom(db)
    started = growth.grow_in_background(child.id, lang, "asked by the parent")
    return {"started": started, "message": "Melo is finding harder sentences (native recordings where they exist). This takes up to a minute."
            if started else "Melo is already preparing a pack."}


def _meaning(item: str | None, ui: str, lang: str) -> str | None:
    """What a word or phrase means in the child's own language (None when it is the same language)."""
    if not item:
        return None
    if ui == "hinglish":
        w = ITEMS.get("hi", {}).get(item)
        return (w.roman or w.text).rstrip(" .!?।") if w and lang != "hi" else None
    code = ui if ui in ITEMS else "en"
    if code == lang:
        return None
    w = ITEMS.get(code, {}).get(item)
    return w.text.rstrip(" .!?।") if w else None


_WHY = {
    "word": {"en": "“{word}” means “{meaning}” {emoji}.", "hi": "“{word}” का मतलब है “{meaning}” {emoji}।",
             "hinglish": "“{word}” ka matlab hai “{meaning}” {emoji}."},
    "reply": {"en": "When someone asks “{q}” ({qm}), we answer “{a}” ({am}). The answer fits the question, like a key fits a lock.",
              "hi": "जब कोई पूछे “{q}” ({qm}), तो हम कहते हैं “{a}” ({am})। जवाब सवाल से मेल खाता है, जैसे ताले में चाबी।",
              "hinglish": "Jab koi pooche “{q}” ({qm}), toh hum kehte hain “{a}” ({am}). Jawaab sawaal se match karta hai, jaise taale mein chaabi."},
}


def why_line(lang: str, ui: str, spec: dict, item: str | None) -> str | None:
    """The reason behind the answer, in the child's own language: what the word means, or why this reply
    answers that question. Not just "correct": understanding, so it is not learned by heart."""
    t = lambda k: _WHY[k].get(ui) or _WHY[k]["en"]  # noqa: E731
    qid = spec.get("question_item")
    if qid and item:
        q, a = ITEMS[lang].get(qid), ITEMS[lang].get(item)
        qm, am = _meaning(qid, ui, lang), _meaning(item, ui, lang)
        if q and a and qm and am:
            return t("reply").format(q=q.text, qm=qm, a=a.text, am=am)
        return None
    w = ITEMS.get(lang, {}).get(item or "")
    m = _meaning(item, ui, lang)
    if w and m:
        return t("word").format(word=w.text, meaning=m, emoji=w.emoji or "")
    return None
