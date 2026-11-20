"""Adaptive lesson engine: mastery, difficulty, session flow and activity selection.

Deterministic given (child state, session seed); see docs/ARCHITECTURE.md §4 for the rules.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .curriculum import (ACTIVITIES, LEVELS, MAX_LEVEL, SKILLS, TOPICS, ActivityDef, age_adjust, gen_play_song, level_activities,
                         scaffold, topic_activities)
from .models import Attempt, Child, LessonSession, SkillState
from .scoring import ScoreResult

ALPHA = 0.3
STREAK_UP = 2  # two clean successes in a row: a little harder
PLACEMENT_ATTEMPTS = 4  # a skill's first tries: every success steps up (a child who already knows it moves fast)
PLACEMENT_MAX_DIFFICULTY = 4
STRETCH_RUN = 3  # successes in a row in one lesson before Melo offers something from the next level
STRETCH_PASSES = 2  # next-level successes that open the next level early
PROVEN_DIFFICULTY = 3  # doing well at this difficulty shows the skill without many repetitions
FAILS_DOWN = 2
FRUSTRATION_MISSES = 3
DISENGAGED_SKIPS = 2
UNCERTAIN_CHECK = 2
UNLOCK_MASTERY = 0.7
UNLOCK_MIN_ATTEMPTS = 3
UNLOCK_SUCCESS_RATE = 0.6  # ...or right at least 60% of the time overall
UNLOCK_MASTERY_FLOOR = 0.45  # ...as long as recent form is not poor
UNLOCK_NEED_BONUS = 0.9  # selection weight bonus for core skills still needed for the next level
NEW_CONCEPT_SETTLE = 2  # scored tries of the latest new activity before introducing another


@dataclass
class EngineUpdate:
    events: list[str] = field(default_factory=list)
    stars_earned: int = 0
    hint: str | None = None


def as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def skill_states(db: Session, child: Child) -> dict[str, SkillState]:
    states = {s.skill: s for s in db.scalars(select(SkillState).where(SkillState.child_id == child.id))}
    for sk in SKILLS:
        if sk not in states:
            st = SkillState(child_id=child.id, skill=sk, mastery=0.0, difficulty=1, attempts=0, successes=0, streak=0, fail_streak=0)
            db.add(st)
            states[sk] = st
    db.flush()
    return states


def skills_snapshot(states: dict[str, SkillState]) -> dict[str, dict]:
    return {k: {"mastery": round(v.mastery, 3), "difficulty": v.difficulty, "attempts": v.attempts} for k, v in states.items()}


def allowed_focus_skills(child: Child, mode: str) -> list[str]:
    acts = level_activities(child.current_level, _effective_mode(mode))
    return sorted({a.skill for a in acts})


def _effective_mode(mode: str) -> str:
    return "screen" if mode == "practice" else mode


# --- outcome processing ----------------------------------------------------------------------
def apply_outcome(db: Session, child: Child, session: LessonSession, attempt: Attempt, result: ScoreResult) -> EngineUpdate:
    upd = EngineUpdate()
    states = skill_states(db, child)
    st = states[attempt.skill]
    o = result.outcome

    if o in ("success", "partial", "miss"):
        st.attempts += 1
        st.mastery = max(0.0, min(1.0, st.mastery + ALPHA * (result.score - st.mastery)))
        session.uncertain_run = 0
        session.skip_run = 0
    if o == "success":
        st.successes += 1
        st.streak += 1
        st.fail_streak = 0
        session.miss_run = 0
        session.successes += 1
        upd.stars_earned = 1
        # Placement: while a skill is new and every try has been right, each success steps up,
        # so a child who already knows the material is not kept on beginner items.
        placing = st.attempts <= PLACEMENT_ATTEMPTS and st.successes == st.attempts and st.difficulty < PLACEMENT_MAX_DIFFICULTY
        if (placing or st.streak >= STREAK_UP) and st.difficulty < 5:
            st.difficulty += 1
            st.streak = 0
            upd.events.append("harder")
    elif o == "partial":
        session.miss_run = 0  # nearly right: keeps the streak, neither up nor down
        upd.stars_earned = 1  # reward effort and progress, not perfection
    elif o == "miss":
        st.streak = 0
        st.fail_streak += 1
        session.miss_run += 1
        if st.fail_streak >= FAILS_DOWN and st.difficulty > 1:
            st.difficulty -= 1
            st.fail_streak = 0
            upd.events.append("easier")
        if session.miss_run >= FRUSTRATION_MISSES:
            session.miss_run = 0
            session.pending_override = "easy"
            upd.events.append("break_offer")
    elif o == "uncertain":
        session.uncertain_run += 1
        if session.uncertain_run >= UNCERTAIN_CHECK:
            session.uncertain_run = 0
            upd.events.append("check_mic")
    elif o == "skipped":
        session.skip_run += 1
        if session.skip_run >= DISENGAGED_SKIPS:
            session.skip_run = 0
            session.pending_override = "game"
            upd.events.append("game_switch")

    if o in ("success", "partial", "miss"):
        session.activities_done += 1
    session.stars += upd.stars_earned
    hint = result.detail.get("hint") or (result.detail.get("tempo") if result.detail.get("tempo") in ("faster", "slower") else None)
    upd.hint = hint

    if maybe_unlock_level(child, states, db):
        upd.events.append("level_up")
    return upd


def skill_demonstrated(st: SkillState) -> bool:
    """A skill counts toward the next level once the child has shown it reliably.

    Either the running mastery is high, or the child gets it right most of the time overall
    (one unlucky miss must not erase weeks of good work) while recent mastery is still decent.
    """
    rate = st.successes / st.attempts if st.attempts else 0.0
    if st.difficulty >= PROVEN_DIFFICULTY and st.attempts >= 2 and rate >= UNLOCK_SUCCESS_RATE:
        return True  # already working at a harder difficulty: no need to repeat easy items
    if st.attempts < UNLOCK_MIN_ATTEMPTS:
        return False
    return st.mastery >= UNLOCK_MASTERY or (rate >= UNLOCK_SUCCESS_RATE and st.mastery >= UNLOCK_MASTERY_FLOOR)


def skills_needed_for_unlock(child: Child, states: dict[str, SkillState]) -> list[str]:
    if child.current_level >= MAX_LEVEL:
        return []
    return [s for s in LEVELS[child.current_level]["core_skills"] if not skill_demonstrated(states[s])]


def stretch_passes(db: Session, child: Child) -> int:
    """Successes on next-level material while at this level (stretch items, or songs played whole)."""
    rows = db.execute(select(Attempt.activity_type, Attempt.spec).where(
        Attempt.child_id == child.id, Attempt.level == child.current_level, Attempt.outcome == "success")).all()
    n = 0
    for t, spec in rows:
        act = ACTIVITIES.get(t)
        if act is None or act.min_level <= child.current_level:
            continue
        spec = spec or {}
        if spec.get("song_school") and not spec.get("full_song"):
            continue  # one guided part of a song is not yet evidence; the whole song is
        n += 1
    return n


def maybe_unlock_level(child: Child, states: dict[str, SkillState], db: Session | None = None) -> bool:
    """Open the next level when the core skills are shown, or when the child has already
    succeeded on next-level material (they knew it before, or learned it elsewhere)."""
    if child.current_level >= MAX_LEVEL:
        return False
    if not skills_needed_for_unlock(child, states) or (db is not None and stretch_passes(db, child) >= STRETCH_PASSES):
        child.current_level += 1
        return True
    return False


# --- session flow ----------------------------------------------------------------------------
def time_up(child: Child, session: LessonSession, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    return (now - as_utc(session.started_at)).total_seconds() >= child.session_minutes * 60


def apply_signal(session: LessonSession, signal: str) -> str | None:
    """Returns an end reason when the signal ends the session."""
    if signal in ("tired", "stop"):
        return signal
    if signal == "frustrated":
        session.pending_override = "easy"
    elif signal == "want_game":
        session.pending_override = "game"
    return None


# --- selection -------------------------------------------------------------------------------
def _types_attempted(db: Session, child_id: str) -> dict[str, int]:
    rows = db.execute(
        select(Attempt.activity_type, func.count()).where(Attempt.child_id == child_id, Attempt.outcome.in_(["success", "partial", "miss"]))
        .group_by(Attempt.activity_type)
    ).all()
    return {t: c for t, c in rows}


def _practice_songs(db: Session, child_id: str) -> list[str]:
    rows = db.scalars(
        select(Attempt.spec).where(Attempt.child_id == child_id, Attempt.activity_type == "play_song", Attempt.outcome.in_(["success", "partial"]))
        .order_by(Attempt.created_at.desc()).limit(30)
    ).all()
    seen: list[str] = []
    for spec in rows:
        sid = (spec or {}).get("song_id")
        if sid and sid not in seen:
            seen.append(sid)
    return seen


def choose_next(db: Session, child: Child, session: LessonSession) -> tuple[ActivityDef, int, dict, list[str]]:
    """Pick the next activity. Returns (definition, difficulty, full_spec, events)."""
    events: list[str] = []
    states = skill_states(db, child)
    history = list(db.scalars(select(Attempt).where(Attempt.session_id == session.id).order_by(Attempt.created_at)))
    rng = random.Random(session.seed * 1_000_003 + len(history))
    mode = session.mode
    attempted = _types_attempted(db, child.id)

    topic = (session.plan or {}).get("topic")
    if topic in TOPICS:
        # Music Basics practice: only this topic's activities; the topic itself is the "new concept".
        candidates = topic_activities(topic, _effective_mode(mode))
    else:
        candidates = level_activities(child.current_level, _effective_mode(mode))
    if mode == "practice" and topic not in TOPICS:
        practiced = [a for a in candidates if attempted.get(a.type) and "practice" in a.modes]
        candidates = practiced or [a for a in candidates if "practice" in a.modes] or candidates

    override = session.pending_override
    session.pending_override = None
    scored = [h for h in history if h.outcome in ("success", "partial", "miss")]
    last = scored[-1] if scored and history[-1] is scored[-1] else None

    # Re-teach before moving on: after a miss the same item comes back once, with more help.
    if (last is not None and last.outcome == "miss" and override is None and not (last.spec or {}).get("retry")
            and not (last.spec or {}).get("stretch") and last.activity_type in ACTIVITIES and not ACTIVITIES[last.activity_type].is_game
            and last.activity_type != "play_song"):
        act = ACTIVITIES[last.activity_type]
        return act, last.difficulty, scaffold(act.type, last.spec), ["retry"]

    # Stretch: a run of successes earns one item from the next level (two passes open that level).
    run = 0
    for h in reversed(scored):
        if h.outcome != "success":
            break
        run += 1
    if (run >= STRETCH_RUN and last is not None and override is None and topic not in TOPICS and child.current_level < MAX_LEVEL
            and not (last.spec or {}).get("stretch")):
        ahead = [a for a in level_activities(child.current_level + 1, _effective_mode(mode))
                 if a.min_level == child.current_level + 1 and not a.is_game]
        if ahead:
            act = rng.choice(ahead)
            spec = age_adjust(act.type, act.generate(1, rng), child.age)
            spec["stretch"] = True
            return act, 1, spec, ["stretch"]
    if override == "game":
        games = [a for a in candidates if a.is_game]
        candidates = games or candidates

    # Teach one new concept at a time: a further never-seen activity is only offered once the
    # child has had NEW_CONCEPT_SETTLE scored tries of the most recently introduced one.
    introduced = list(session.new_types_introduced or [])
    # A skipped try counts too: otherwise one skipped new game blocked every other new activity.
    tried_here: dict[str, int] = {}
    for h in history:
        if h.outcome in ("success", "partial", "miss", "skipped"):
            tried_here[h.activity_type] = tried_here.get(h.activity_type, 0) + 1
    settled = not introduced or tried_here.get(introduced[-1], 0) >= NEW_CONCEPT_SETTLE
    if not settled and topic not in TOPICS:
        familiar = [a for a in candidates if attempted.get(a.type) or a.type in introduced]
        candidates = familiar or candidates

    focus = (session.plan or {}).get("focus_skill")
    core = set(LEVELS[child.current_level]["core_skills"])
    needed = set(skills_needed_for_unlock(child, states))  # steer practice toward the next level
    last_types = [h.activity_type for h in history[-2:]]
    weights: list[float] = []
    for a in candidates:
        st = states[a.skill]
        w = 0.35 + (1.0 - st.mastery)
        if a.skill == focus:
            w += 0.6
        if a.skill in needed:
            w += UNLOCK_NEED_BONUS * (1.5 if st.attempts < UNLOCK_MIN_ATTEMPTS else 1.0)
        if a.skill in core:
            w *= 1.3
        if last_types and a.type == last_types[-1]:
            w *= 0.25
        if len(last_types) == 2 and last_types[0] == last_types[1] == a.type:
            w *= 0.1
        if override == "easy":
            w = 0.2 + st.mastery  # build confidence with what the child knows best
        weights.append(max(w, 0.01))
    act = rng.choices(candidates, weights=weights, k=1)[0]

    difficulty = states[act.skill].difficulty
    if override == "easy":
        difficulty = max(1, difficulty - 1)
    if act.type == "play_song" and mode == "practice":
        songs = _practice_songs(db, child.id)
        spec = gen_play_song(difficulty, rng, song_id=songs[0] if songs and rng.random() < 0.7 else None)
    else:
        spec = act.generate(difficulty, rng)
    spec = age_adjust(act.type, spec, child.age)

    if not attempted.get(act.type) and act.type not in introduced:
        introduced.append(act.type)
        session.new_types_introduced = introduced
        events.append("new_activity")
    if override == "game":
        events.append("game_switch")
    return act, difficulty, spec, events


def list_activity_types() -> list[str]:
    return list(ACTIVITIES)
