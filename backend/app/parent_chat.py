"""Parent chat: a parent (or teacher) talks to Melo's AI teacher about the child, and the app changes with it.

The parent says what they want ("she should play the Mahamrityunjaya mantra by Diwali", "he gets frustrated,
go slower", "add phrases for shopping at the market"). The AI teacher (or, without an AI brain, a simple
intent reader) answers and PROPOSES concrete changes. Nothing changes until the parent taps Apply. Every
change is validated here, then becomes part of the child's learning memory, so lesson plans, personal
praise, AI reviews and the progress tracker follow it from then on: the feedback loop.

Changes a parent can make:
  set_goal      a goal in the parent's words (+ the skill it is about): shown in the tracker, given to the AI
  set_focus     the music skill the next lessons lean on
  set_tactic    how Melo teaches: gentle | challenge | more_games | more_repetition | more_singing
  set_minutes   lesson length (3-20 minutes)
  open_song     a built-in song or mantra (e.g. Mahamrityunjaya Mantra), opened in the song school
  add_song      a new sargam tune made by the AI brain, taught phrase by phrase with fading help
  practice_topic a conversation topic in a language (e.g. At the market in Hindi)
  add_phrases   a new conversation topic: the AI brain writes and translates the phrases
  note          anything else, kept in the child's memory for the AI teacher
"""
from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from . import memory
from .curriculum import SKILLS, SONGS
from .db import Base
from .models import Child, LangSkillState, utcnow

log = logging.getLogger("melo.parent_chat")

TACTICS = {
    "gentle": "Go gently: easier starts, more help, more praise for trying",
    "challenge": "More challenge: harder tasks sooner, fewer hints",
    "more_games": "More games and play between learning",
    "more_repetition": "More repetition of the same thing before moving on",
    "more_singing": "Sing along more (turn on 'Melo sings' in Settings on this device)",
}
ACTION_TYPES = ("set_goal", "set_focus", "set_tactic", "set_minutes", "open_song", "add_song", "practice_topic", "add_phrases", "note")


class CustomPhrase(Base):
    """A phrase from a parent-requested conversation topic, with its translations (AI-made), for one child."""
    __tablename__ = "custom_phrases"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(20), index=True)
    topic_title: Mapped[str] = mapped_column(String(60))
    topic_emoji: Mapped[str] = mapped_column(String(8))
    emoji: Mapped[str] = mapped_column(String(8))
    english: Mapped[str] = mapped_column(String(120))
    texts: Mapped[dict] = mapped_column(JSON, default=dict)  # lang -> "native text|romanisation"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatTurn(Base):
    """One message in a chat (parent with the AI teacher, or the child with Melo), kept on this computer so a new
    session continues the conversation. Old turns are folded into a running summary (see summarize)."""
    __tablename__ = "chat_turns"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(8))  # parent | child
    role: Mapped[str] = mapped_column(String(8))  # user | melo
    text: Mapped[str] = mapped_column(String(1200))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


RECENT_TURNS = 6  # sent with every AI request, next to the summary
SUMMARIZE_EVERY = 8  # new turns before the running summary is refreshed
SUMMARY_CHARS = 900
KEEP_TURNS = 200  # per child and channel; older ones live on only in the summary


def record_turn(db: Session, child: Child, channel: str, role: str, text: str) -> None:
    db.add(ChatTurn(child_id=child.id, channel=channel, role=role, text=text[:1200]))
    db.flush()
    ids = [r for (r,) in db.query(ChatTurn.id).filter(ChatTurn.child_id == child.id, ChatTurn.channel == channel)
           .order_by(ChatTurn.id.desc()).offset(KEEP_TURNS)]
    if ids:
        db.query(ChatTurn).filter(ChatTurn.id.in_(ids)).delete(synchronize_session=False)


def recent_turns(db: Session, child: Child, channel: str, n: int = RECENT_TURNS) -> list[dict]:
    rows = list(db.scalars(select(ChatTurn).where(ChatTurn.child_id == child.id, ChatTurn.channel == channel)
                           .order_by(ChatTurn.id.desc()).limit(n)))
    return [{"from": r.role, "text": r.text, "at": r.at.isoformat() if r.at else None} for r in reversed(rows)]


def chat_summary(db: Session, child: Child, channel: str) -> str:
    n = db.get(memory.MemoryNode, memory.nid_child(child.id))
    return ((n.props or {}).get("chat_summaries", {}) if n else {}).get(channel, {}).get("text", "")


def maybe_summarize(db: Session, child: Child, channel: str) -> bool:
    """Fold the turns since the last summary into it, every SUMMARIZE_EVERY turns. AI when available, else a
    compact extract, so the context survives new sessions and stays small enough for any model."""
    memory.ensure_child(db, child)
    node = db.get(memory.MemoryNode, memory.nid_child(child.id))
    sums = dict((node.props or {}).get("chat_summaries", {}))
    cur = sums.get(channel, {"text": "", "upto": 0})
    new = list(db.scalars(select(ChatTurn).where(ChatTurn.child_id == child.id, ChatTurn.channel == channel, ChatTurn.id > cur.get("upto", 0))
                          .order_by(ChatTurn.id)))
    if len(new) < SUMMARIZE_EVERY:
        return False
    from .teacher.safety import clean_parent_text, redact_for_ai
    from .teacher.service import _obj, get_teacher

    lines = [f"{'Parent' if channel == 'parent' and t.role == 'user' else 'Child' if t.role == 'user' else 'Melo'}: {redact_for_ai(t.text, child.name)}"
             for t in new]
    text = None
    teacher = get_teacher()
    ai = teacher._ai_for(child)
    if ai:
        data = teacher._ask(ai, ("Update the running summary of a conversation about a child's learning. Keep goals, requests, worries, "
                                 "decisions, what was changed and what the child likes or finds hard. Max 120 words, plain sentences.\n"
                                 f"Summary so far: {cur.get('text', '')}\nNew messages:\n" + "\n".join(lines)[-6000:]),
                            _obj({"summary": {"type": "string"}}), 600)
        text = clean_parent_text((data or {}).get("summary"), SUMMARY_CHARS)
    if not text:  # offline: keep what the parent / child said, newest last, within the size limit
        said = [ln for ln in lines if not ln.startswith("Melo:")]
        text = (cur.get("text", "") + " | " + " | ".join(s[:140] for s in said)).strip(" |")[-SUMMARY_CHARS:]
    sums[channel] = {"text": text, "upto": new[-1].id, "at": utcnow().isoformat()}
    node.props = {**(node.props or {}), "chat_summaries": sums}
    return True


_loaded: set[str] = set()


def load_custom_phrases(db: Session) -> None:
    """Register every saved custom phrase with the language engine (once per process, then as they are added)."""
    from .lang.phrases import register_custom

    for p in db.scalars(select(CustomPhrase)):
        if p.id in _loaded:
            continue
        register_custom(p.topic, p.topic_title, p.topic_emoji, p.child_id, p.id, p.emoji, p.texts or {})
        _loaded.add(p.id)


# --- the parent's plan, kept on the child's memory node ----------------------------------------------------
def plan(db: Session, child: Child) -> dict:
    memory.ensure_child(db, child)
    n = db.get(memory.MemoryNode, memory.nid_child(child.id))
    props = n.props or {}
    from .lang.phrases import CUSTOM_TOPICS

    load_custom_phrases(db)
    from .basics import custom_songs

    return {"goals": props.get("goals", []), "tactics": props.get("tactics", []), "focus": props.get("focus_override"),
            "minutes": child.session_minutes,
            "custom_topics": [{"id": k, "title": v["title"], "emoji": v["emoji"], "phrases": len(v["items"])}
                              for k, v in CUSTOM_TOPICS.items() if v["child_id"] == child.id],
            "custom_songs": [{"id": sid, "title": s["title"]} for sid, s in custom_songs(db, child).items()]}


def _set_props(db: Session, child: Child, **updates) -> None:
    memory.ensure_child(db, child)
    n = db.get(memory.MemoryNode, memory.nid_child(child.id))
    n.props = {**(n.props or {}), **updates}


def tactics(db: Session, child: Child) -> list[str]:
    n = db.get(memory.MemoryNode, memory.nid_child(child.id))
    return [t["id"] for t in ((n.props or {}).get("tactics", []) if n else [])]


# --- what the app can offer (given to the AI so it only proposes real things) -----------------------------
def catalogue(db: Session, child: Child) -> dict:
    from .lang.content import TARGETS
    from .lang.phrases import PHRASE_TOPICS

    langs = sorted({s.lang for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.attempts > 0))})
    return {"songs": {k: v["title"] for k, v in SONGS.items()}, "music_skills": list(SKILLS), "tactics": TACTICS,
            "topics": {t[0]: t[2] for t in PHRASE_TOPICS}, "languages_studied": langs, "languages": {k: t.name for k, t in TARGETS.items()}}


def _song_match(text: str) -> str | None:
    low = text.lower()
    aliases = {"mahamrityunjaya_mantra": ("mahamrit", "mrityunjay", "mrutyunjay", "maha mrityunjaya", "mahamrut", "महामृत्युंजय", "मृत्युंजय"),
               "gayatri_mantra": ("gayatri", "गायत्री"), "happy_birthday": ("birthday",), "twinkle": ("twinkle",), "jingle_bells": ("jingle",)}
    for sid, words in aliases.items():
        if sid in SONGS and any(w in low for w in words):
            return sid
    for sid, s in SONGS.items():
        if s["title"].lower() in low:
            return sid
    return None


def _action(kind: str, label: str, **params) -> dict:
    return {"id": secrets.token_hex(4), "type": kind, "label": label, "params": params}


def offline_reply(db: Session, child: Child, message: str) -> dict:
    """Without an AI brain: understand the common requests and propose the matching changes."""
    from .lang.content import TARGETS

    low = message.lower()
    acts = []
    cat = catalogue(db, child)
    lang = (cat["languages_studied"] or ["hi"])[0]
    for code, t in TARGETS.items():
        if t.name.lower() in low:
            lang = code
    song = _song_match(message)
    if song:
        acts.append(_action("open_song", f"Open the song lesson: {SONGS[song]['title']}", song_id=song))
    if re.search(r"market|shop|bazaar|bazar|price|buy|बाज़ार|बाजार|दुकान", low):
        acts.append(_action("practice_topic", f"Practise 'At the market' phrases in {TARGETS[lang].name}", lang=lang, topic="market"))
    if re.search(r"school|class|teacher|स्कूल|विद्यालय|कक्षा|टीचर", low):
        acts.append(_action("practice_topic", f"Practise 'At school' phrases in {TARGETS[lang].name}", lang=lang, topic="school"))
    if re.search(r"friend|play with|playground|other kids|other children|dost|दोस्त|मित्र", low):
        acts.append(_action("practice_topic", f"Practise 'Playing with friends' phrases in {TARGETS[lang].name}", lang=lang, topic="friends"))
    if re.search(r"feeling|feel |hurt|sad|express|emotion|भावना|चोट", low):
        acts.append(_action("practice_topic", f"Practise 'Feelings and caring' phrases in {TARGETS[lang].name}", lang=lang, topic="feelings"))
    m = re.search(r"(\d{1,2})\s*(?:min|minute)", low)
    if m and 3 <= int(m.group(1)) <= 20:
        acts.append(_action("set_minutes", f"Lessons of {int(m.group(1))} minutes", minutes=int(m.group(1))))
    elif re.search(r"shorter|too long|less time", low):
        acts.append(_action("set_minutes", f"Shorter lessons ({max(3, child.session_minutes - 2)} minutes)", minutes=max(3, child.session_minutes - 2)))
    if re.search(r"frustrat|upset|cries|crying|too hard|difficult for|slow(er)?|gentle|easier|scared|shy", low):
        acts.append(_action("set_tactic", TACTICS["gentle"], tactic="gentle"))
    if re.search(r"bored|too easy|harder|challenge|faster|quick learner|ahead", low):
        acts.append(_action("set_tactic", TACTICS["challenge"], tactic="challenge"))
    if re.search(r"game|fun|play more", low):
        acts.append(_action("set_tactic", TACTICS["more_games"], tactic="more_games"))
    if re.search(r"repeat|again and again|forgets|remember", low):
        acts.append(_action("set_tactic", TACTICS["more_repetition"], tactic="more_repetition"))
    for sk, words in {"rhythm": ("rhythm", "beat", "taal", "clap"), "pitch": ("pitch", "high and low", "notes", "sur"),
                      "melody": ("melody", "tune", "song"), "dynamics": ("loud", "soft"), "timbre": ("instrument sound",), "creativity": ("compose", "create", "own music")}.items():
        if any(re.search(rf"\b{re.escape(w)}\b", low) for w in words) and re.search(r"focus|work on|improve|practi|better at|learn", low):
            acts.append(_action("set_focus", f"Next lessons lean on {sk}", skill=sk))
            break
    if re.search(r"goal|want (him|her|them|my|our)|should (be able|learn|play|read|speak)|by (diwali|christmas|holi|next|the end)|achieve|target", low):
        acts.append(_action("set_goal", f"Goal: {message.strip()[:120]}", goal=message.strip()[:200]))
    acts.append(_action("note", "Remember this for the AI teacher", text=message.strip()[:500]))
    reply = ("Here is what I can change for this. Tap Apply on the ones you want."
             if len(acts) > 1 else "I have noted this for the AI teacher. Turn on an AI brain for more personal suggestions.")
    return {"reply": reply, "actions": acts, "source": "offline"}


def ai_reply(db: Session, child: Child, message: str, history: list[dict]) -> dict | None:
    from . import assessment
    from .teacher.safety import clean_parent_text, redact_for_ai
    from .teacher.service import _obj, get_teacher

    teacher = get_teacher()
    ai = teacher._ai_for(child)
    if not ai:
        return None
    cat = catalogue(db, child)
    t = assessment.tracker(db, child, with_catalogue=False)
    digest = [{"area": a["title"], "axes": {x["label"]: x["final"] for x in a["axes"]}} for a in t["areas"]]
    prompt = (
        f"You are Melo's AI teacher talking with the PARENT of a {child.age}-year-old (in English, warm, practical, max 4 sentences). "
        "Understand what they want the child to achieve or what should change, explain briefly what you will do, and propose concrete "
        "changes from the list. The parent approves each one, so propose only what they asked for or what clearly helps.\n"
        f"Parent's plan so far: {json.dumps(plan(db, child), ensure_ascii=False)}\n"
        f"Progress tracker (0-100): {json.dumps(digest, ensure_ascii=False)}\n"
        f"Child's learning memory: {json.dumps(memory.brief(db, child), ensure_ascii=False)}\n"
        f"What the app can do: {json.dumps(cat, ensure_ascii=False)}\n"
        f"Summary of earlier conversations with this parent: {json.dumps(chat_summary(db, child, 'parent'), ensure_ascii=False)}\n"
        f"Latest messages: {json.dumps([{'from': h.get('from'), 'text': redact_for_ai(str(h.get('text', '')), child.name)[:400]} for h in history[-RECENT_TURNS:]], ensure_ascii=False)}\n"
        f"Parent says: {json.dumps(redact_for_ai(message, child.name), ensure_ascii=False)}\n"
        "Action fields (use empty string / empty list / 0 when not used): type; label (what the parent will see); goal (set_goal text); "
        "skill (set_focus, one of music_skills; for set_goal the skill it is about, may be empty); tactic (set_tactic key); minutes (set_minutes 3-20); "
        "song_id (open_song: a key of songs); title + swars (add_song: 8-24 sargam names from Sa Re Ga Ma Pa Dha Ni and Sa' with a clear "
        "repeating pattern); lang (language code) + topic (practice_topic: a key of topics); topic_title + emoji + phrases (add_phrases: "
        "3-6 short everyday English phrases a child can say, for a new situation the parent asked for, and lang = the languages to "
        "translate into, comma separated codes); text (note)."
    )
    act = _obj({"type": {"type": "string", "enum": list(ACTION_TYPES)}, "label": {"type": "string"}, "goal": {"type": "string"},
                "skill": {"type": "string"}, "tactic": {"type": "string"}, "minutes": {"type": "integer"}, "song_id": {"type": "string"},
                "title": {"type": "string"}, "swars": {"type": "array", "items": {"type": "string"}}, "lang": {"type": "string"},
                "topic": {"type": "string"}, "topic_title": {"type": "string"}, "emoji": {"type": "string"},
                "phrases": {"type": "array", "items": {"type": "string"}}, "text": {"type": "string"}})
    schema = _obj({"reply": {"type": "string"}, "actions": {"type": "array", "items": act}})
    data = teacher._ask(ai, prompt, schema, 1800)
    if not data:
        return None
    acts = []
    for a in (data.get("actions") or [])[:6]:
        clean = validate_action(db, child, a)
        if clean:
            acts.append(clean)
    acts.append(_action("note", "Remember this for the AI teacher", text=message.strip()[:500]))
    reply = clean_parent_text(data.get("reply"), 800) or "Here is what I suggest."
    return {"reply": reply.replace("{name}", child.name), "actions": acts, "source": "ai"}


def validate_action(db: Session, child: Child, a: dict) -> dict | None:
    """Keep only actions that are real and safe; returns the cleaned action or None."""
    from .lang.content import TARGETS
    from .lang.phrases import TOPIC_IDS
    from .teacher.safety import clean_parent_text

    kind = a.get("type")
    label = clean_parent_text(str(a.get("label") or ""), 160) or kind
    if kind == "set_goal" and str(a.get("goal") or "").strip():
        sk = a.get("skill") if a.get("skill") in SKILLS or a.get("skill") in ("listen", "speak", "read", "write") else None
        return _action(kind, label, goal=clean_parent_text(str(a["goal"]), 200), skill=sk)
    if kind == "set_focus" and a.get("skill") in SKILLS:
        return _action(kind, label, skill=a["skill"])
    if kind == "set_tactic" and a.get("tactic") in TACTICS:
        return _action(kind, label or TACTICS[a["tactic"]], tactic=a["tactic"])
    if kind == "set_minutes" and isinstance(a.get("minutes"), int) and 3 <= a["minutes"] <= 20:
        return _action(kind, label, minutes=a["minutes"])
    if kind == "open_song" and a.get("song_id") in SONGS:
        return _action(kind, label, song_id=a["song_id"])
    if kind == "add_song" and a.get("swars") and str(a.get("title") or "").strip():
        from . import basics

        try:
            basics.validate(list(a["swars"])[:24], None, None, 8, 3, str(a["title"])[:60], None)
        except (ValueError, TypeError):
            return None
        return _action(kind, label, title=clean_parent_text(str(a["title"]), 60), swars=list(a["swars"])[:24])
    if kind == "practice_topic" and a.get("lang") in TARGETS and a.get("topic") in TOPIC_IDS:
        return _action(kind, label, lang=a["lang"], topic=a["topic"])
    if kind == "add_phrases" and a.get("phrases") and str(a.get("topic_title") or "").strip():
        langs = [c.strip() for c in str(a.get("lang") or "").split(",") if c.strip() in TARGETS] or catalogue(db, child)["languages_studied"] or ["hi"]
        phrases = [p for p in (clean_parent_text(str(x), 80) for x in a["phrases"][:6]) if p]
        if len(phrases) >= 2:
            return _action(kind, label, topic_title=clean_parent_text(str(a["topic_title"]), 40), emoji=str(a.get("emoji") or "💬")[:4],
                           phrases=phrases, langs=langs[:4])
    if kind == "note" and str(a.get("text") or "").strip():
        return _action(kind, label, text=clean_parent_text(str(a["text"]), 500))
    return None


def chat(db: Session, child: Child, message: str, history: list[dict]) -> dict:
    """Answer the parent. The conversation is stored here (not only in the browser): the AI gets the running
    summary + the last turns, so a new session, another device or a long chat keeps its context."""
    stored = recent_turns(db, child, "parent")  # the server's copy wins over what the page sent
    try:
        out = ai_reply(db, child, message, stored or history)
    except Exception:  # a broken AI answer must never break the chat
        log.exception("parent chat AI failed")
        out = None
    out = out or offline_reply(db, child, message)
    record_turn(db, child, "parent", "user", message)
    record_turn(db, child, "parent", "melo", out["reply"])
    try:
        maybe_summarize(db, child, "parent")
    except Exception:  # the summary is a bonus; the turns are already saved
        log.exception("chat summary failed")
    return out


# --- applying an approved change --------------------------------------------------------------------------
def apply(db: Session, child: Child, action: dict) -> dict:
    a = validate_action(db, child, {**action.get("params", {}), "type": action.get("type"), "label": action.get("label")})
    if a is None:
        raise ValueError("This change is not possible as written")
    kind, p = a["type"], a["params"]
    now = utcnow().isoformat()
    if kind == "set_goal":
        goals = (plan(db, child)["goals"] + [{"text": p["goal"], "skill": p.get("skill"), "at": now}])[-5:]
        _set_props(db, child, goals=goals)
        memory._event(db, child.id, "goal", f"Parent goal: {p['goal']}", memory.nid_child(child.id))
        return {"ok": True, "message": "Goal saved. The AI teacher plans lessons towards it and the tracker shows it."}
    if kind == "set_focus":
        memory.set_focus_override(db, child, p["skill"])
        return {"ok": True, "message": f"The next lessons lean on {p['skill']}."}
    if kind == "set_tactic":
        current = [t for t in plan(db, child)["tactics"] if t["id"] not in (p["tactic"], {"gentle": "challenge", "challenge": "gentle"}.get(p["tactic"]))]
        _set_props(db, child, tactics=(current + [{"id": p["tactic"], "text": TACTICS[p["tactic"]], "at": now}])[-4:])
        memory._event(db, child.id, "tactic", f"Parent chose: {TACTICS[p['tactic']]}", memory.nid_child(child.id))
        return {"ok": True, "message": f"Melo will {TACTICS[p['tactic']].lower()}."}
    if kind == "set_minutes":
        child.session_minutes = p["minutes"]
        return {"ok": True, "message": f"Lessons are now {p['minutes']} minutes."}
    if kind == "open_song":
        return {"ok": True, "message": f"{SONGS[p['song_id']]['title']} is in the song school.", "link": f"/play/{child.id}/songs/{p['song_id']}"}
    if kind == "practice_topic":
        return {"ok": True, "message": "Open this to practise.", "link": f"/play/{child.id}/learn/{p['lang']}?topic={p['topic']}"}
    if kind == "add_song":
        from . import basics

        ex = basics.validate(p["swars"], None, None, 8, 3, p["title"], None)
        row = basics.save(db, child, "alankars", 3, ex, "parent-chat")
        return {"ok": True, "message": f"'{row.title}' is ready in the song school.", "link": f"/play/{child.id}/songs/x_{row.id}"}
    if kind == "add_phrases":
        return add_phrases(db, child, p["topic_title"], p["emoji"], p["phrases"], p["langs"])
    memory.add_note(db, child, p["text"], author="parent-chat")
    return {"ok": True, "message": "Kept in the child's memory: the AI teacher will take it into account."}


def add_phrases(db: Session, child: Child, title: str, emoji: str, phrases: list[str], langs: list[str]) -> dict:
    """The AI brain translates the parent's phrases; the topic then works like the built-in ones."""
    from .lang.content import TARGETS
    from .lang.phrases import register_custom
    from .teacher.service import _obj, get_teacher

    teacher = get_teacher()
    ai = teacher._ai_for(child)
    if not ai:
        raise ValueError("New phrases need an AI brain to translate them. Turn on the AI brain for this child first.")
    codes = [c for c in dict.fromkeys(["en"] + langs) if c in TARGETS]
    row = _obj({"english": {"type": "string"}, "emoji": {"type": "string"},
                "texts": _obj({c: {"type": "string"} for c in codes})})
    prompt = ("Translate these short phrases a child will say, naturally and simply, into each language. For languages not written in "
              "Latin letters give 'native text|romanisation' (romanisation as a reading aid). One emoji per phrase that pictures it. "
              f"Languages: {json.dumps({c: TARGETS[c].name for c in codes})}. Phrases: {json.dumps(phrases, ensure_ascii=False)}")
    data = teacher._ask(ai, prompt, _obj({"phrases": {"type": "array", "items": row}}), 2500)
    rows = (data or {}).get("phrases") or []
    if len(rows) < 2:
        raise ValueError("The AI brain could not translate the phrases this time. Please try again.")
    topic = f"c_{secrets.token_hex(3)}"
    saved = 0
    for r in rows[:6]:
        texts = {c: str(r.get("texts", {}).get(c, "")).strip()[:120] for c in codes}
        texts = {c: v for c, v in texts.items() if v and (TARGETS[c].latin or "|" in v or True)}
        if len(texts) < 2:
            continue
        pid = f"c{secrets.token_hex(6)}"
        cp = CustomPhrase(id=pid, child_id=child.id, topic=topic, topic_title=title, topic_emoji=emoji[:4] or "💬",
                          emoji=str(r.get("emoji") or "💬")[:4], english=str(r.get("english") or "")[:120], texts=texts)
        db.add(cp)
        register_custom(topic, title, cp.topic_emoji, child.id, pid, cp.emoji, texts)
        _loaded.add(pid)
        saved += 1
    if saved < 2:
        raise ValueError("The translated phrases were not usable. Please try again.")
    memory._event(db, child.id, "custom_topic", f"New conversation topic from the parent: {title} ({saved} phrases)", memory.nid_child(child.id))
    first = next((c for c in langs if c != "en"), "en")
    return {"ok": True, "message": f"'{title}' has {saved} phrases in {', '.join(TARGETS[c].name for c in codes)}.",
            "link": f"/play/{child.id}/learn/{first}?topic={topic}"}
