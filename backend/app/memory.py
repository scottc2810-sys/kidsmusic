"""Learning-graph memory: a per-child knowledge graph of progress (code-review-graph style).

Nodes  : child, skill, activity, song, session, mistake, recording, note, language, word
Edges  : HAS_SKILL, PRACTICED, TRAINS, ATTENDED, INCLUDED, LEARNING, LEARNED, OF_SONG,
         REVEALED, STRUGGLES_WITH, STRONG_AT, ABOUT, STUDIES (child -> language), KNOWS / IN (word -> language)
Events : compact chronological timeline (level ups, difficulty changes, sessions, recordings, notes)

The graph is a *derived* index: it is updated incrementally by the lesson/recording flows and can
be rebuilt from the raw tables at any time (`rebuild`). It powers fast retrieval for the parent
dashboard and for Claude Code via MCP (see app/mcp_server.py), and `brief()` turns it into the short
context every AI prompt gets, so the AI brain knows the child even in a brand-new or lost session.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, delete, or_, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .curriculum import ACTIVITIES, LEVELS, SKILLS
from .db import Base
from .models import Attempt, Child, LangItemState, LangSkillState, LessonSession, Recording, SkillState, utcnow


class MemoryNode(Base):
    __tablename__ = "memory_nodes"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    label: Mapped[str] = mapped_column(String(160))
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MemoryEdge(Base):
    __tablename__ = "memory_edges"
    __table_args__ = (UniqueConstraint("src", "dst", "rel"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    src: Mapped[str] = mapped_column(String(120), index=True)
    dst: Mapped[str] = mapped_column(String(120), index=True)
    rel: Mapped[str] = mapped_column(String(20))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MemoryEvent(Base):
    __tablename__ = "memory_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    kind: Mapped[str] = mapped_column(String(24))
    summary: Mapped[str] = mapped_column(String(300))
    node_id: Mapped[str | None] = mapped_column(String(120), nullable=True)


SKILL_NAMES = {"pitch": "high & low sounds", "dynamics": "loud & soft", "timbre": "instrument sounds", "rhythm": "rhythm",
               "melody": "melodies", "creativity": "making up music"}
ACTIVITY_NAMES = {"high_low": "High or low?", "loud_soft": "Loud or soft?", "instrument_guess": "Guess the instrument",
                  "rhythm_tap": "Tap the rhythm", "find_note": "Find the note", "same_different": "Same or different?",
                  "echo_melody": "Echo the tune", "play_song": "Play a song", "free_play": "Make your own music"}


# --- ids ---------------------------------------------------------------------------------------
def nid_child(cid: str) -> str: return f"child:{cid}"
def nid_skill(cid: str, s: str) -> str: return f"skill:{cid}:{s}"
def nid_activity(cid: str, t: str) -> str: return f"activity:{cid}:{t}"
def nid_song(cid: str, sid: str) -> str: return f"song:{cid}:{sid}"
def nid_session(sid: str) -> str: return f"session:{sid}"
def nid_mistake(cid: str, key: str) -> str: return f"mistake:{cid}:{key}"[:120]
def nid_recording(rid: str) -> str: return f"recording:{rid}"
def nid_lang(cid: str, code: str) -> str: return f"language:{cid}:{code}"
def nid_word(cid: str, code: str, item: str) -> str: return f"word:{cid}:{code}:{item}"[:120]


WORD_STRUGGLE = (3, 0.35)  # seen at least 3 times and still this weak: a word the child finds hard


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# --- low-level upserts ---------------------------------------------------------------------------
def _node(db: Session, cid: str, nid: str, kind: str, label: str, **props) -> MemoryNode:
    n = db.get(MemoryNode, nid)
    if n is None:
        n = MemoryNode(id=nid, child_id=cid, kind=kind, label=label[:160], props={})
        db.add(n)
        db.flush()  # sessions use autoflush=False; flush so later lookups in this transaction see it
    n.label = label[:160]
    if props:
        n.props = {**(n.props or {}), **props}
    return n


def _edge(db: Session, cid: str, src: str, dst: str, rel: str, weight: float | None = None, inc: float = 0.0, **props) -> MemoryEdge:
    e = db.scalar(select(MemoryEdge).where(MemoryEdge.src == src, MemoryEdge.dst == dst, MemoryEdge.rel == rel))
    if e is None:
        e = MemoryEdge(child_id=cid, src=src, dst=dst, rel=rel, weight=0.0, props={})
        db.add(e)
        db.flush()
    e.weight = weight if weight is not None else (e.weight or 0.0) + inc
    if props:
        e.props = {**(e.props or {}), **props}
    e.updated_at = utcnow()
    return e


def _event(db: Session, cid: str, kind: str, summary: str, node_id: str | None = None, at: datetime | None = None) -> None:
    db.add(MemoryEvent(child_id=cid, kind=kind, summary=summary[:300], node_id=node_id, at=at or utcnow()))


def ensure_child(db: Session, child: Child) -> None:
    c = nid_child(child.id)
    _node(db, child.id, c, "child", child.name, age=child.age, language=child.language, level=child.current_level,
          level_name=LEVELS[child.current_level]["name"], instrument=child.instrument)
    for s in SKILLS:
        sid = nid_skill(child.id, s)
        if db.get(MemoryNode, sid) is None:
            _node(db, child.id, sid, "skill", s, mastery=0.0, difficulty=1, attempts=0)
            _edge(db, child.id, c, sid, "HAS_SKILL", weight=0.0)


def _sync_skill(db: Session, child: Child, st: SkillState) -> None:
    sid = nid_skill(child.id, st.skill)
    _node(db, child.id, sid, "skill", st.skill, mastery=round(st.mastery, 3), difficulty=st.difficulty, attempts=st.attempts)
    _edge(db, child.id, nid_child(child.id), sid, "HAS_SKILL", weight=round(st.mastery, 3), difficulty=st.difficulty)
    core = LEVELS[child.current_level]["core_skills"]
    struggling = st.attempts >= 3 and st.mastery < 0.4
    strong = st.attempts >= 4 and st.mastery >= 0.75
    _set_flag_edge(db, child, sid, "STRUGGLES_WITH", struggling, round(1 - st.mastery, 3), core=st.skill in core)
    _set_flag_edge(db, child, sid, "STRONG_AT", strong, round(st.mastery, 3))


def _set_flag_edge(db: Session, child: Child, dst: str, rel: str, on: bool, weight: float, **props) -> None:
    src = nid_child(child.id)
    if on:
        _edge(db, child.id, src, dst, rel, weight=weight, **props)
    else:
        db.execute(delete(MemoryEdge).where(MemoryEdge.src == src, MemoryEdge.dst == dst, MemoryEdge.rel == rel))


# --- incremental hooks ---------------------------------------------------------------------------
def record_attempt(db: Session, child: Child, session: LessonSession, attempt: Attempt, events: list[str]) -> None:
    ensure_child(db, child)
    cid, c = child.id, nid_child(child.id)
    an = nid_activity(cid, attempt.activity_type)
    _node(db, cid, an, "activity", attempt.activity_type, skill=attempt.skill)
    _edge(db, cid, an, nid_skill(cid, attempt.skill), "TRAINS", weight=1.0)
    e = _edge(db, cid, c, an, "PRACTICED", inc=1.0)
    stats = dict(e.props or {})
    stats[attempt.outcome or "skipped"] = stats.get(attempt.outcome or "skipped", 0) + 1
    stats["last_difficulty"] = attempt.difficulty
    e.props = stats
    sn = nid_session(session.id)
    _node(db, cid, sn, "session", f"Lesson {_as_utc(session.started_at):%Y-%m-%d %H:%M}", mode=session.mode, level=session.level)
    _edge(db, cid, c, sn, "ATTENDED", weight=1.0)
    _edge(db, cid, sn, an, "INCLUDED", inc=1.0)
    st = db.scalar(select(SkillState).where(SkillState.child_id == cid, SkillState.skill == attempt.skill))
    if st is not None:
        _sync_skill(db, child, st)
    if attempt.activity_type == "play_song" and attempt.outcome in ("success", "partial"):
        song_id, title = attempt.spec.get("song_id"), attempt.spec.get("title", "")
        if song_id:
            sg = nid_song(cid, song_id)
            _node(db, cid, sg, "song", title)
            learned = attempt.outcome == "success" and attempt.spec.get("full_song")
            _edge(db, cid, c, sg, "LEARNED" if learned else "LEARNING", inc=1.0)
            if learned:
                _event(db, cid, "song_learned", f"Played the whole of {title}", sg)
    for ev in events:
        if ev == "level_up":
            _event(db, cid, "level_up", f"Unlocked level {child.current_level}: {LEVELS[child.current_level]['name']}", c)
        elif ev in ("harder", "easier"):
            word = "increased" if ev == "harder" else "eased"
            _event(db, cid, ev, f"{attempt.skill} difficulty {word} (now {st.difficulty if st else '?'})", nid_skill(cid, attempt.skill))
        elif ev == "break_offer":
            _event(db, cid, "frustration", "Several misses in a row - Melo offered a break / easier game", sn)
    _node(db, cid, c, "child", child.name, level=child.current_level, level_name=LEVELS[child.current_level]["name"])


def record_session_end(db: Session, child: Child, session: LessonSession) -> None:
    ensure_child(db, child)
    sn = nid_session(session.id)
    s = session.summary or {}
    _node(db, child.id, sn, "session", f"Lesson {_as_utc(session.started_at):%Y-%m-%d %H:%M}", mode=session.mode, level=session.level,
          stars=session.stars, activities=s.get("activities", 0), successes=s.get("successes", 0), end_reason=session.end_reason,
          focus=(session.plan or {}).get("focus_skill"))
    _edge(db, child.id, nid_child(child.id), sn, "ATTENDED", weight=1.0)
    if s.get("activities"):
        _event(db, child.id, "session", f"{s.get('activities')} activities, {s.get('successes', 0)} successes, {session.stars} stars "
               f"({session.end_reason})", sn, at=session.ended_at)


def record_recording(db: Session, child: Child, rec: Recording) -> None:
    ensure_child(db, child)
    cid, rn = child.id, nid_recording(rec.id)
    a = rec.analysis or {}
    _node(db, cid, rn, "recording", rec.title, duration=rec.duration_seconds, note_accuracy=a.get("note_accuracy"),
          rhythm=a.get("rhythm_stability"), reliable=a.get("reliable"), created_at=_as_utc(rec.created_at).isoformat())
    _edge(db, cid, nid_child(cid), rn, "RECORDED", weight=1.0)
    song = a.get("song_match") or {}
    if song.get("song_id"):
        sg = nid_song(cid, song["song_id"])
        _node(db, cid, sg, "song", song.get("title") or song["song_id"])
        _edge(db, cid, rn, sg, "OF_SONG", weight=float(song.get("confidence") or 0))
    for m in a.get("recurring_mistakes") or []:
        mn = nid_mistake(cid, m["description"].split(" (")[0])
        _node(db, cid, mn, "mistake", m["description"].split(" (")[0], mistake_type=m.get("kind"), note=m.get("expected_name"))
        _edge(db, cid, rn, mn, "REVEALED", weight=float(m.get("count", 1)))
        _edge(db, cid, nid_child(cid), mn, "STRUGGLES_WITH", inc=float(m.get("count", 1)))
    acc = a.get("note_accuracy")
    _event(db, cid, "recording", f"Recording '{rec.title}' analysed" + (f": {round(acc * 100)}% notes matched" if acc is not None else ""), rn,
           at=rec.created_at)


def add_note(db: Session, child: Child, text: str, about_skill: str | None = None, author: str = "parent") -> MemoryNode:
    ensure_child(db, child)
    count = db.query(MemoryNode).filter(MemoryNode.child_id == child.id, MemoryNode.kind == "note").count()
    nid = f"note:{child.id}:{count + 1}:{int(utcnow().timestamp())}"
    n = _node(db, child.id, nid, "note", text[:160], text=text[:1000], author=author)
    target = nid_skill(child.id, about_skill) if about_skill in SKILLS else nid_child(child.id)
    _edge(db, child.id, nid, target, "ABOUT", weight=1.0)
    _event(db, child.id, "note", f"{author} note: {text[:200]}", nid)
    return n


def record_language(db: Session, child: Child, lang: str, summary: dict, item: LangItemState | None, events: list[str]) -> None:
    """After a language answer: the language's stages, the word's memory, struggles and milestones."""
    from .lang.phrases import ITEMS  # local import: lang imports models

    ensure_child(db, child)
    cid, c, ln = child.id, nid_child(child.id), nid_lang(child.id, lang)
    L = summary["language"]
    _node(db, cid, ln, "language", L["name"], code=lang, stage=summary["stage"], stage_name=summary["stage_name"],
          skills={k: v["stage"] for k, v in summary["skills"].items()}, words_known=summary["words_known"],
          phrases_known=summary["phrases_known"], tier=summary["tier"], focus=summary["focus"])
    _edge(db, cid, c, ln, "STUDIES", weight=round(summary["stage"] / 5, 3), stage=summary["stage"])
    if item is not None and item.item in ITEMS.get(lang, {}):
        w = ITEMS[lang][item.item]
        wn = nid_word(cid, lang, item.item)
        _node(db, cid, wn, "word", w.text, meaning=item.item, language=lang, strength=round(item.strength, 3), seen=item.seen, correct=item.correct)
        _edge(db, cid, wn, ln, "IN", weight=1.0)
        hard = item.seen >= WORD_STRUGGLE[0] and item.strength < WORD_STRUGGLE[1]
        _set_flag_edge(db, child, wn, "STRUGGLES_WITH", hard, round(1 - item.strength, 3), language=lang)
        if item.strength >= 0.6:
            _edge(db, cid, c, wn, "KNOWS", weight=round(item.strength, 3))
        else:
            db.execute(delete(MemoryEdge).where(MemoryEdge.src == c, MemoryEdge.dst == wn, MemoryEdge.rel == "KNOWS"))
    for ev in events:
        if ev == "stage_up":
            _event(db, cid, "lang_stage", f"{L['name']}: reached stage {summary['stage']} ({summary['stage_name']})", ln)
        elif ev == "new_words":
            _event(db, cid, "lang_words", f"{L['name']}: new words opened (tier {summary['tier']}, {summary['words_known']} known)", ln)
        elif ev in ("harder", "easier"):
            _event(db, cid, f"lang_{ev}", f"{L['name']}: {summary['focus'] if ev == 'easier' else 'a skill'} {'stepped up' if ev == 'harder' else 'eased for now'}", ln)


def _rebuild_languages(db: Session, child: Child) -> None:
    from .lang import engine as lang_engine

    langs = {s.lang for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.attempts > 0))}
    for code in sorted(langs):
        if code not in lang_engine.TARGETS:
            continue
        skills = {s.skill: s for s in db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.lang == code))}
        items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == code))}
        summ = lang_engine.summary(code, skills, items, speech=child.consent_microphone, reached=lang_reached(db, child.id, code))
        for it in items.values():
            record_language(db, child, code, summ, it, [])
        if not items:
            record_language(db, child, code, summ, None, [])
        db.flush()


def lang_reached(db: Session, child_id: str, lang: str) -> dict[str, int]:
    """Per skill, the highest difficulty the child has succeeded at at least twice: a stage that stays earned."""
    from sqlalchemy import func

    from .lang.engine import REACHED_SUCCESSES
    from .models import LangAttempt

    rows = db.execute(select(LangAttempt.skill, LangAttempt.difficulty, func.count()).where(
        LangAttempt.child_id == child_id, LangAttempt.lang == lang, LangAttempt.outcome == "success")
        .group_by(LangAttempt.skill, LangAttempt.difficulty))
    out: dict[str, int] = {}
    for skill, d, n in rows:
        if n >= REACHED_SUCCESSES:
            out[skill] = max(out.get(skill, 0), int(d))
    return out


def forget_recording(db: Session, rid: str) -> None:
    rn = nid_recording(rid)
    db.execute(delete(MemoryEdge).where(or_(MemoryEdge.src == rn, MemoryEdge.dst == rn)))
    db.execute(delete(MemoryEvent).where(MemoryEvent.node_id == rn))
    db.execute(delete(MemoryNode).where(MemoryNode.id == rn))


def rebuild(db: Session, child: Child) -> dict:
    """Rebuild the child's graph from raw tables (idempotent; keeps parent notes)."""
    notes = [(n.props.get("text", n.label), n.props.get("author", "parent")) for n in
             db.scalars(select(MemoryNode).where(MemoryNode.child_id == child.id, MemoryNode.kind == "note"))]
    db.execute(delete(MemoryEdge).where(MemoryEdge.child_id == child.id))
    db.execute(delete(MemoryEvent).where(MemoryEvent.child_id == child.id))
    db.execute(delete(MemoryNode).where(MemoryNode.child_id == child.id))
    db.flush()
    ensure_child(db, child)
    db.flush()
    sessions = list(db.scalars(select(LessonSession).where(LessonSession.child_id == child.id).order_by(LessonSession.started_at)))
    for s in sessions:
        for a in s.attempts:
            if a.outcome:
                record_attempt(db, child, s, a, [])
        db.flush()
        if s.ended_at:
            record_session_end(db, child, s)
    for st in db.scalars(select(SkillState).where(SkillState.child_id == child.id)):
        _sync_skill(db, child, st)
    for r in db.scalars(select(Recording).where(Recording.child_id == child.id, Recording.status == "analyzed").order_by(Recording.created_at)):
        record_recording(db, child, r)
        db.flush()
    _rebuild_languages(db, child)
    for text, author in notes:
        add_note(db, child, text, author=author)
        db.flush()
    return graph_stats(db, child)


# --- retrieval -----------------------------------------------------------------------------------
def graph_stats(db: Session, child: Child) -> dict:
    nodes = db.query(MemoryNode).filter(MemoryNode.child_id == child.id).count()
    edges = db.query(MemoryEdge).filter(MemoryEdge.child_id == child.id).count()
    events = db.query(MemoryEvent).filter(MemoryEvent.child_id == child.id).count()
    return {"nodes": nodes, "edges": edges, "events": events}


def _node_dict(n: MemoryNode) -> dict:
    return {"id": n.id, "kind": n.kind, "label": n.label, **{k: v for k, v in (n.props or {}).items() if v is not None}}


def _edge_dict(e: MemoryEdge) -> dict:
    return {"src": e.src, "rel": e.rel, "dst": e.dst, "weight": round(e.weight, 3), **(e.props or {})}


def subgraph(db: Session, child: Child, node_id: str | None = None, depth: int = 1, rel: str | None = None, limit: int = 200) -> dict:
    """Breadth-first neighbourhood around a node (default: the child)."""
    start = node_id or nid_child(child.id)
    root = db.get(MemoryNode, start)
    if root is None or root.child_id != child.id:
        return {"nodes": [], "edges": [], "error": f"node '{start}' not found"}
    seen, frontier, edges_out = {start}, {start}, {}
    for _ in range(max(1, min(depth, 3))):
        q = select(MemoryEdge).where(MemoryEdge.child_id == child.id, or_(MemoryEdge.src.in_(frontier), MemoryEdge.dst.in_(frontier)))
        if rel:
            q = q.where(MemoryEdge.rel == rel.upper())
        nxt = set()
        for e in db.scalars(q.limit(limit)):
            edges_out[e.id] = e
            for x in (e.src, e.dst):
                if x not in seen:
                    seen.add(x)
                    nxt.add(x)
        frontier = nxt
        if not frontier or len(seen) >= limit:
            break
    nodes = list(db.scalars(select(MemoryNode).where(MemoryNode.id.in_(seen))))
    return {"nodes": [_node_dict(n) for n in nodes], "edges": [_edge_dict(e) for e in edges_out.values()]}


def search(db: Session, child: Child, query: str, kind: str | None = None, limit: int = 25) -> list[dict]:
    q = select(MemoryNode).where(MemoryNode.child_id == child.id, MemoryNode.label.ilike(f"%{query[:60]}%"))
    if kind:
        q = q.where(MemoryNode.kind == kind)
    return [_node_dict(n) for n in db.scalars(q.limit(limit))]


def timeline(db: Session, child: Child, days: int = 30, kinds: list[str] | None = None, limit: int = 50) -> list[dict]:
    since = utcnow() - timedelta(days=max(1, min(days, 3650)))
    q = select(MemoryEvent).where(MemoryEvent.child_id == child.id, MemoryEvent.at >= since)
    if kinds:
        q = q.where(MemoryEvent.kind.in_(kinds))
    rows = db.scalars(q.order_by(MemoryEvent.at.desc()).limit(max(1, min(limit, 500))))
    return [{"at": _as_utc(r.at).isoformat(), "kind": r.kind, "summary": r.summary, "node": r.node_id} for r in rows]


def overview(db: Session, child: Child) -> dict:
    ensure_child(db, child)
    db.flush()
    c = nid_child(child.id)
    edges = list(db.scalars(select(MemoryEdge).where(MemoryEdge.src == c)))
    node_ids = {e.dst for e in edges}
    nodes = {n.id: n for n in db.scalars(select(MemoryNode).where(MemoryNode.id.in_(node_ids)))}
    skills = {}
    for e in edges:
        if e.rel == "HAS_SKILL" and e.dst in nodes:
            p = nodes[e.dst].props or {}
            skills[nodes[e.dst].label] = {"mastery": p.get("mastery", 0.0), "difficulty": p.get("difficulty", 1), "attempts": p.get("attempts", 0)}
    struggles = sorted([(e.weight, nodes[e.dst]) for e in edges if e.rel == "STRUGGLES_WITH" and e.dst in nodes], key=lambda x: -x[0])
    strengths = sorted([(e.weight, nodes[e.dst]) for e in edges if e.rel == "STRONG_AT" and e.dst in nodes], key=lambda x: -x[0])
    practiced = sorted([(e.weight, nodes[e.dst].label, e.props) for e in edges if e.rel == "PRACTICED" and e.dst in nodes], key=lambda x: -x[0])
    return {
        "child": {"id": child.id, "name": child.name, "age": child.age, "language": child.language, "instrument": child.instrument,
                  "mode": child.mode, "level": child.current_level, "level_name": LEVELS[child.current_level]["name"]},
        "skills": skills,
        "strengths": [{"node": n.id, "label": n.label, "score": w} for w, n in strengths[:5]],
        "struggles": [{"node": n.id, "kind": n.kind, "label": n.label, "weight": w} for w, n in struggles[:6]],
        "songs": {"learned": sorted(nodes[e.dst].label for e in edges if e.rel == "LEARNED" and e.dst in nodes),
                  "learning": sorted(nodes[e.dst].label for e in edges if e.rel == "LEARNING" and e.dst in nodes)},
        "activities": [{"activity": label, "times": int(w), **{k: v for k, v in (p or {}).items()}} for w, label, p in practiced[:9]],
        "parent_notes": [n["summary"] for n in timeline(db, child, 3650, ["note"], 5)],
        "focus_override": (db.get(MemoryNode, c).props or {}).get("focus_override"),
        "recent": timeline(db, child, 30, None, 12),
        "recommendation": recommend(db, child, skills, [n for _, n in struggles]),
        "languages": languages(db, child),
        "graph": graph_stats(db, child),
    }


def languages(db: Session, child: Child) -> list[dict]:
    """Every language the child studies, from the graph: stage per skill and the words that are hard right now."""
    out = []
    for n in db.scalars(select(MemoryNode).where(MemoryNode.child_id == child.id, MemoryNode.kind == "language")):
        p = n.props or {}
        hard = db.scalars(select(MemoryNode).join(MemoryEdge, MemoryEdge.dst == MemoryNode.id).where(
            MemoryEdge.src == nid_child(child.id), MemoryEdge.rel == "STRUGGLES_WITH", MemoryNode.kind == "word",
            MemoryNode.id.like(f"word:{child.id}:{p.get('code')}:%")).order_by(MemoryEdge.weight.desc()).limit(5))
        out.append({"code": p.get("code"), "name": n.label, "stage": p.get("stage", 0), "stage_name": p.get("stage_name"),
                    "skills": p.get("skills", {}), "words_known": p.get("words_known", 0), "phrases_known": p.get("phrases_known", 0),
                    "focus": p.get("focus"), "hard_words": [{"text": w.label, "meaning": (w.props or {}).get("meaning")} for w in hard]})
    return sorted(out, key=lambda x: -x["stage"])


def _tracker_digest(db: Session, child: Child) -> list[dict]:
    """The spider charts in a few words: per area, each axis score and band, plus what to work on."""
    from . import assessment

    try:
        t = assessment.tracker(db, child, with_catalogue=False)
    except Exception:  # the brief must never fail because of the tracker
        return []
    return [{"area": a["title"], "axes": {x["label"]: x["final"] for x in a["axes"]}, "developing": a["developing"],
             "not_assessed": a["not_assessed"]} for a in t["areas"]][:5]


def brief(db: Session, child: Child) -> dict:
    """The short context the AI brain gets with every request: who the child is as a learner, what is strong,
    what is hard, what happened lately, and what the parent asked for. Built from the learning graph, so it
    survives restarts, new devices and lost sessions. The child's name is not included."""
    ov = overview(db, child)
    days_since = None
    last = db.scalars(select(LessonSession.started_at).where(LessonSession.child_id == child.id).order_by(LessonSession.started_at.desc()).limit(1)).first()
    if last is not None:
        days_since = max(0, (utcnow() - _as_utc(last)).days)
    out = {
        "age": child.age, "level": ov["child"]["level"], "level_name": ov["child"]["level_name"], "mode": child.mode,
        "skills": {k: {"mastery": round(v.get("mastery", 0.0), 2), "difficulty": v.get("difficulty", 1)} for k, v in ov["skills"].items()},
        "strong_at": [x["label"] for x in ov["strengths"]][:4],
        "finds_hard": [x["label"] for x in ov["struggles"]][:5],
        "songs": ov["songs"],
        "languages": [{k: x[k] for k in ("name", "stage", "stage_name", "skills", "words_known", "focus")} | {"hard_words": [w["meaning"] for w in x["hard_words"]]}
                      for x in ov["languages"]][:4],
        "recent_events": [e["summary"] for e in ov["recent"][:8]],
        "parent_notes": ov["parent_notes"][:3],
        "focus_override": ov["focus_override"],
        "days_since_last_lesson": days_since,
        "next_step": ov["recommendation"].get("suggestions", [])[:2],
        "progress_tracker": _tracker_digest(db, child),
        # what the parent asked for and how Melo should teach (parent chat), and what was said before
        "parent_goals": [g["text"] for g in ((db.get(MemoryNode, nid_child(child.id)).props or {}).get("goals", []))][-3:],
        "teaching_tactics": [t["text"] for t in ((db.get(MemoryNode, nid_child(child.id)).props or {}).get("tactics", []))],
        "earlier_conversations": {k: v.get("text", "") for k, v in ((db.get(MemoryNode, nid_child(child.id)).props or {}).get("chat_summaries", {})).items()},
    }
    # parent notes and events may contain the child's name: it never leaves the app
    import json
    import re

    text = json.dumps(out, ensure_ascii=False)
    if child.name.strip():
        text = re.sub(re.escape(json.dumps(child.name.strip(), ensure_ascii=False)[1:-1]), "{name}", text, flags=re.I)
    return json.loads(text)


def recommend(db: Session, child: Child, skills: dict | None = None, struggles: list[MemoryNode] | None = None) -> dict:
    if skills is None:
        ov = overview(db, child)
        return ov["recommendation"]
    core = LEVELS[child.current_level]["core_skills"]
    pending = [s for s in core if skills.get(s, {}).get("mastery", 0) < 0.7]
    focus = min(pending, key=lambda s: skills.get(s, {}).get("mastery", 0)) if pending else None
    acts = [t for t, a in ACTIVITIES.items() if a.skill == focus and a.min_level <= child.current_level] if focus else []
    mistakes = [n.label for n in (struggles or []) if n.kind == "mistake"][:2]
    steps = []
    if focus:
        names = ", ".join(ACTIVITY_NAMES.get(a, a) for a in acts) or "n/a"
        steps.append(f"Next lessons lean on {SKILL_NAMES.get(focus, focus)} (currently {skills.get(focus, {}).get('mastery', 0):.0%}) with: {names}.")
    for m in mistakes:
        steps.append(f"Recurring from recordings: {m} - a short echo game around that note helps.")
    if not pending and child.current_level < max(LEVELS):
        steps.append("All core skills are close to the level target; keep sessions short and fun to unlock the next level.")
    remaining = {s: max(0, 3 - skills.get(s, {}).get("attempts", 0)) for s in core}
    return {"focus_skill": focus, "unlock_needs": {s: {"mastery_target": 0.7, "attempts_left": n} for s, n in remaining.items()},
            "suggestions": steps or ["Keep going - steady short practice is working."]}


def set_focus_override(db: Session, child: Child, skill: str | None) -> None:
    ensure_child(db, child)
    n = db.get(MemoryNode, nid_child(child.id))
    props = dict(n.props or {})
    if skill:
        props["focus_override"] = skill
    else:
        props.pop("focus_override", None)
    n.props = props
    _event(db, child.id, "focus", f"Focus set to {skill}" if skill else "Focus override cleared", n.id)


def focus_override(db: Session, child: Child) -> str | None:
    n = db.get(MemoryNode, nid_child(child.id))
    return (n.props or {}).get("focus_override") if n else None
