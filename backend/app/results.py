"""Results per subject and combined: not only "did the activities", but did the child LEARN it, REMEMBER it
and can the child APPLY it in real life.

Every subject area (music, each language, maths, science, vedas & wisdom, finance) gets:
* its skill axes (what was learned), measured from the activities;
* ✅ "Concepts completed": how much of what was started was carried through to mastery (songs played whole,
  topics mastered, language topics known), so finishing a concept moves the result straight away;
* 🌍 "Uses it in real life": real-life application, from the questions and tasks that ask the child to use
  the idea in an everyday situation (story problems, money decisions, life-skill choices, playing a whole song,
  answering a real question in a conversation, playing on the real instrument);
* 🔁 "Remembers": right again after a break of a day or more.
The area summary weighs them like a teacher would: learned 45 %, applied 35 %, remembered 20 %.
The combined result is the mean of the areas with enough evidence.
"""
from __future__ import annotations

import statistics
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Attempt, Child, LangItemState, SkillState, SubjectProgress, SubjectRound

MIN_N = 3
WEIGHTS = {"learned": 0.45, "applied": 0.35, "remembered": 0.20}
SUMMARY_AXES = {"real_life", "retention", "completed"}

SUBJECTS = {
    "maths": ("Maths", "🔢", [("numbers", "Numbers & arithmetic", "🔢"), ("problems", "Story sums", "📖"), ("algebra", "Patterns & algebra", "🧩"),
                              ("geometry", "Shapes & geometry", "📐"), ("measure", "Measuring & data", "⏰"), ("vedic", "Vedic & quick tricks", "⚡")]),
    "science": ("Science", "🔬", [("living", "Plants & animals", "🌱"), ("body", "Body & food", "🧒"), ("materials", "Water & materials", "🧊"),
                                  ("earth", "Earth & sky", "🌍"), ("forces", "Forces & energy", "🧲")]),
    "vedas": ("Vedas & wisdom", "🕉️", [("texts", "The Vedas", "📜"), ("shlokas", "Shlokas", "🪔"), ("gita", "Gita wisdom", "🪷"),
                                      ("life", "Life skills", "🌟"), ("links", "Vedic knowledge", "🔗")]),
    "finance": ("Money & finance", "🪙", [("basics", "Money basics", "🪙"), ("save", "Saving & spending", "🐷"), ("earn", "Earning & business", "💼"),
                                          ("smart", "Smart & safe", "🛡️"), ("grow", "Growing money", "📈")]),
}


def _ax(axis: str, label: str, emoji: str, score: float | None, n: int, skill: str | None = None, info: str | None = None) -> dict:
    return {"id": axis, "label": label, "emoji": emoji, "skill": skill, "measured": None if score is None else round(score, 1), "n": n,
            "evidence": None if score is None else ("limited" if n < 8 else "good"), "info": info}


def real_life_axis(score: float | None, n: int) -> dict:
    return _ax("real_life", "Uses it in real life", "🌍", score, n, info="Questions and tasks that apply the idea to an everyday situation")


def completed_axis(score: float | None, n: int) -> dict:
    return _ax("completed", "Concepts completed", "✅", score, n, info="Started concepts carried through to mastery")


def retention_axis(score: float | None, n: int) -> dict:
    return _ax("retention", "Remembers", "🔁", score, n, info="Right again after a break of a day or more")


# --- subjects (maths, science, vedas, finance) -------------------------------------------------------------
def subject_areas(db: Session, child: Child) -> list[dict]:
    rows = list(db.scalars(select(SubjectRound).where(SubjectRound.child_id == child.id).order_by(SubjectRound.at)))
    progress = {(p.subject, p.topic): p for p in db.scalars(select(SubjectProgress).where(SubjectProgress.child_id == child.id))}
    out = []
    for sid, (title, emoji, strands) in SUBJECTS.items():
        R = [r for r in rows if r.subject == sid]
        if not R:
            continue
        axes = []
        for st, label, em in strands:
            S = [r for r in R if r.strand == st]
            total = sum(r.total for r in S)
            if total < MIN_N:
                axes.append(_ax(st, label, em, None, total))
                continue
            recent = S[-6:]
            acc = sum(r.correct for r in recent) / max(1, sum(r.total for r in recent))
            # highest level shown with 80 %+ (6+ = beyond the built-in levels, counts as full marks)
            reached = max([min(r.difficulty, 5) for r in S if r.total and r.correct / r.total >= 0.8], default=0)
            axes.append(_ax(st, label, em, 100 * (0.55 * max(0, reached - 1) / 4 + 0.45 * acc), total))
        at = sum(r.apply_total for r in R)
        axes.append(real_life_axis(100 * sum(r.apply_correct for r in R) / at if at >= MIN_N else None, at))
        topics = {r.topic for r in R}
        mastered = sum(1 for t in topics if (p := progress.get((sid, t))) and p.difficulty >= 4 and p.rounds >= 2
                       and _last_share(R, t) >= 0.8)
        axes.append(completed_axis(100 * mastered / len(topics) if len(topics) >= 2 else None, len(topics)))
        axes.append(retention_axis(*_subject_retention(R)))
        out.append({"id": sid, "title": title, "emoji": emoji, "axes": axes,
                    "facts": {"topics_played": len(topics), "topics_mastered": mastered, "rounds": len(R)}})
    return out


def _last_share(R: list[SubjectRound], topic: str) -> float:
    last = next((r for r in reversed(R) if r.topic == topic), None)
    return last.correct / last.total if last and last.total else 0.0


def _subject_retention(R: list[SubjectRound]) -> tuple[float | None, int]:
    """Rounds of a topic played again after a day or more, following a good round: how much stuck."""
    last: dict[str, SubjectRound] = {}
    vals: list[float] = []
    for r in R:
        prev = last.get(r.topic)
        if prev and prev.total and prev.correct / prev.total >= 0.6 and r.at - prev.at >= timedelta(hours=20) and r.total:
            vals.append(r.correct / r.total)
        last[r.topic] = r
    return (100 * statistics.fmean(vals), len(vals)) if len(vals) >= 2 else (None, len(vals))


# --- music and languages: real life, completion, retention -----------------------------------------------
def music_extra(db: Session, child: Child, evs: list) -> list[dict]:
    from .routers.songs import _all_songs, _progress

    rows = list(db.scalars(select(Attempt).where(Attempt.child_id == child.id, Attempt.outcome.in_(["success", "partial", "miss"]))
                           .order_by(Attempt.created_at.desc()).limit(400)))
    # real life: playing a WHOLE song, playing on the real instrument (microphone), making your own tune
    applied = [r for r in rows if (r.spec or {}).get("full_song") or ((r.response or {}).get("source") == "mic") or r.activity_type == "free_play"]
    real = (100 * sum(1 for r in applied if r.outcome in ("success", "partial")) / len(applied), len(applied)) if len(applied) >= MIN_N else (None, len(applied))
    prog = _progress(db, child.id, _all_songs(db, child))
    started = [p for p in prog.values() if p["plays"] or p["phrases_learned"]]
    skills = list(db.scalars(select(SkillState).where(SkillState.child_id == child.id, SkillState.attempts > 0)))
    parts = []
    if started:
        parts.append(sum(1 for p in started if p["completed"]) / len(started))
    if skills:
        parts.append(sum(1 for s in skills if s.mastery >= 0.7) / len(skills))
    n = len(started) + len(skills)
    done = (100 * statistics.fmean(parts), n) if parts and n >= 2 else (None, n)
    from .assessment import retention

    return [real_life_axis(*real), completed_axis(*done), retention_axis(*retention([e for e in evs if e.domain == "music"]))]


def lang_extra(db: Session, child: Child, code: str, evs: list, convo: tuple[float | None, int]) -> list[dict]:
    from .assessment import retention, transfer
    from .lang.phrases import PHRASE_TOPICS, PHRASE_WORDS, TOPIC_OF

    L = [e for e in evs if e.domain == "lang" and e.lang == code]
    tr = transfer(L)
    parts = [(s, n) for s, n in (convo, tr) if s is not None]
    real = (statistics.fmean(s for s, _ in parts), sum(n for _, n in parts)) if parts else (None, convo[1] + tr[1])
    items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == code))}
    touched, mastered = 0, 0
    for tid, _emoji, _title in PHRASE_TOPICS:
        ids = [p for p in PHRASE_WORDS.get(code, {}) if TOPIC_OF.get(p) == tid]
        seen = [i for i in ids if i in items]
        if not seen:
            continue
        touched += 1
        if sum(1 for i in ids if items.get(i) and items[i].strength >= 0.6) >= 0.75 * len(ids):
            mastered += 1
    done = (100 * mastered / touched, touched) if touched >= 2 else (None, touched)
    return [real_life_axis(*real), completed_axis(*done), retention_axis(*retention(L))]


# --- summaries --------------------------------------------------------------------------------------------
def summarize(area: dict) -> None:
    """learned / applied / remembered and the weighted area score (missing parts are left out, not zero)."""
    finals = {a["id"]: a.get("final") for a in area["axes"]}
    learned_vals = [a["final"] for a in area["axes"] if a["id"] not in SUMMARY_AXES and a.get("final") is not None]
    if finals.get("completed") is not None:
        learned_vals.append(finals["completed"])
    parts = {"learned": statistics.fmean(learned_vals) if learned_vals else None, "applied": finals.get("real_life"),
             "remembered": finals.get("retention")}
    area["learned"], area["applied"], area["remembered"] = (None if v is None else round(v, 1) for v in parts.values())
    have = {k: v for k, v in parts.items() if v is not None}
    if "learned" not in have:
        area["score"] = None
        return
    w = sum(WEIGHTS[k] for k in have)
    area["score"] = round(sum(WEIGHTS[k] * v for k, v in have.items()) / w, 1)
    area["score_parts"] = {k: WEIGHTS[k] for k in have}


def overall(areas: list[dict]) -> dict:
    scored = [a for a in areas if a.get("score") is not None and a["id"] != "habits"]
    mean = lambda k: round(statistics.fmean(v), 1) if (v := [a[k] for a in scored if a.get(k) is not None]) else None  # noqa: E731
    return {"score": mean("score"), "learned": mean("learned"), "applied": mean("applied"), "remembered": mean("remembered"),
            "areas": [{"id": a["id"], "title": a["title"], "emoji": a["emoji"], "score": a["score"], "learned": a.get("learned"),
                       "applied": a.get("applied"), "remembered": a.get("remembered")} for a in areas if a["id"] != "habits"],
            "weights": WEIGHTS}


def completed_concepts(db: Session, child: Child) -> list[str]:
    """What the child has carried through to mastery, in words, for the AI teacher (so a finished concept is
    never judged only by older, weaker attempts)."""
    from .lang.content import TARGETS
    from .lang.phrases import PHRASE_TOPICS, PHRASE_WORDS, TOPIC_OF
    from .routers.songs import _all_songs, _progress

    out: list[str] = []
    lib = _all_songs(db, child)
    for sid, p in _progress(db, child.id, lib).items():
        if p["completed"]:
            out.append(f"music: played the whole song '{lib[sid]['title']}' successfully")
        elif p["phrases_learned"]:
            out.append(f"music: learned {len(p['phrases_learned'])}/{len(lib[sid]['phrases'])} parts of '{lib[sid]['title']}'")
    for s in db.scalars(select(SkillState).where(SkillState.child_id == child.id, SkillState.mastery >= 0.7)):
        out.append(f"music: skill '{s.skill}' mastered (difficulty {s.difficulty})")
    items = list(db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.strength >= 0.6)))
    for code in sorted({i.lang for i in items}):
        known = {i.item for i in items if i.lang == code}
        for tid, _e, title in PHRASE_TOPICS:
            ids = [p for p in PHRASE_WORDS.get(code, {}) if TOPIC_OF.get(p) == tid]
            if ids and sum(1 for i in ids if i in known) >= 0.75 * len(ids):
                out.append(f"{TARGETS[code].name if code in TARGETS else code}: topic '{title}' mastered")
        out.append(f"{TARGETS[code].name if code in TARGETS else code}: {len(known)} words/phrases known well")
    for p in db.scalars(select(SubjectProgress).where(SubjectProgress.child_id == child.id, SubjectProgress.difficulty >= 4)):
        out.append(f"{p.subject}: topic '{p.topic.replace('_', ' ')}' at level {p.difficulty} ({p.correct}/{p.attempts} right overall)")
    return out[:60]
