from app import engine
from app.db import session_factory
from app.models import Attempt, Child, LessonSession, Parent
from app.scoring import ScoreResult


import pytest


@pytest.fixture()
def db(client):
    d = session_factory()()
    yield d
    d.rollback()
    d.close()


def _setup(db):
    p = Parent(email="e@x.io", password_hash="x")
    db.add(p)
    db.flush()
    c = Child(parent_id=p.id, name="K", age=4, language="en", session_minutes=5)
    db.add(c)
    db.flush()
    s = LessonSession(child_id=c.id, level=1, mode="screen", seed=42, plan={})
    db.add(s)
    db.flush()
    return c, s


def _attempt(db, c, s, skill="pitch", t="high_low"):
    a = Attempt(session_id=s.id, child_id=c.id, activity_type=t, skill=skill, level=1, difficulty=1, spec={})
    db.add(a)
    db.flush()
    return a


def test_child_who_already_knows_it_climbs_fast(db):
    # Placement: while a new skill has only successes, every success steps the difficulty up.
    c, s = _setup(db)
    events = []
    for _ in range(3):
        events += engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("success", 1.0)).events
    assert events.count("harder") == 3
    assert engine.skill_states(db, c)["pitch"].difficulty == 4


def test_after_a_miss_two_successes_in_a_row_raise_difficulty(db):
    c, s = _setup(db)
    st = engine.skill_states(db, c)["pitch"]
    engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("miss", 0.0))  # placement is over
    e1 = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("success", 1.0)).events
    e2 = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("partial", 0.6)).events  # keeps the streak
    e3 = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("success", 1.0)).events
    assert e1 == [] and e2 == [] and "harder" in e3 and st.difficulty == 2


def test_missed_item_comes_back_once_with_more_help(db):
    c, s = _setup(db)
    spec = {"keys": [60, 67], "target": 67, "tries": 2, "highlight": False}
    db.add(Attempt(session_id=s.id, child_id=c.id, activity_type="find_note", skill="pitch", level=1, difficulty=4, spec=spec, outcome="miss", score=0.0))
    db.flush()
    act, d, again, events = engine.choose_next(db, c, s)
    assert act.type == "find_note" and events == ["retry"] and d == 4
    assert again["target"] == 67 and again["highlight"] is True and again["tries"] == 3 and again["retry"] == 1
    db.add(Attempt(session_id=s.id, child_id=c.id, activity_type="find_note", skill="pitch", level=1, difficulty=4, spec=again, outcome="miss", score=0.0))
    db.flush()
    assert "retry" not in engine.choose_next(db, c, s)[3]  # only one repeat, then move on


def test_run_of_successes_earns_a_next_level_item_and_two_passes_open_the_level(db):
    c, s = _setup(db)
    for _ in range(3):
        db.add(Attempt(session_id=s.id, child_id=c.id, activity_type="high_low", skill="pitch", level=1, difficulty=1, spec={}, outcome="success", score=1.0))
    db.flush()
    act, d, spec, events = engine.choose_next(db, c, s)
    assert events == ["stretch"] and act.min_level == 2 and spec["stretch"] is True
    for _ in range(2):
        a = Attempt(session_id=s.id, child_id=c.id, activity_type=act.type, skill=act.skill, level=1, difficulty=1, spec=spec)
        db.add(a)
        db.flush()
        a.outcome, a.score = "success", 1.0
        db.flush()
        upd = engine.apply_outcome(db, c, s, a, ScoreResult("success", 1.0))
    assert "level_up" in upd.events and c.current_level == 2


def test_skill_proven_at_higher_difficulty_counts_without_repetition(db):
    c, s = _setup(db)
    st = engine.skill_states(db, c)["rhythm"]
    st.attempts, st.successes, st.mastery, st.difficulty = 2, 2, 0.51, 3
    assert engine.skill_demonstrated(st)


def test_youngest_children_get_wider_rhythm_timing():
    from app.curriculum import age_adjust
    spec = {"pattern": [0, 1, 2, 3], "bpm": 80, "tolerance_ms": 230}
    assert age_adjust("rhythm_tap", spec, 3)["tolerance_ms"] > age_adjust("rhythm_tap", spec, 5)["tolerance_ms"] > 230
    assert age_adjust("rhythm_tap", spec, 7)["tolerance_ms"] == 230


def test_two_misses_lower_difficulty_and_three_offer_break(db):
    c, s = _setup(db)
    st = engine.skill_states(db, c)["pitch"]
    st.difficulty = 3
    e1 = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("miss", 0.0)).events
    e2 = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("miss", 0.0)).events
    e3 = engine.apply_outcome(db, c, s, _attempt(db, c, s, "rhythm", "rhythm_tap"), ScoreResult("miss", 0.0)).events
    assert e1 == [] and "easier" in e2 and st.difficulty == 2
    assert "break_offer" in e3 and s.pending_override == "easy"


def test_uncertain_never_changes_mastery_and_prompts_mic_check(db):
    c, s = _setup(db)
    st = engine.skill_states(db, c)["pitch"]
    st.mastery = 0.5
    engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("uncertain", 0.0))
    ev = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("uncertain", 0.0)).events
    assert st.mastery == 0.5 and st.attempts == 0 and "check_mic" in ev


def test_skips_switch_to_game(db):
    c, s = _setup(db)
    engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("skipped", 0.0))
    ev = engine.apply_outcome(db, c, s, _attempt(db, c, s), ScoreResult("skipped", 0.0)).events
    assert "game_switch" in ev
    act, *_ = engine.choose_next(db, c, s)
    assert act.is_game


def test_level_unlock_requires_demonstrated_mastery(db):
    c, s = _setup(db)
    states = engine.skill_states(db, c)
    for sk in ("pitch", "dynamics", "rhythm"):
        states[sk].mastery, states[sk].attempts = 0.9, 5
    assert not engine.maybe_unlock_level(c, states)  # timbre not yet shown
    states["timbre"].mastery, states["timbre"].attempts = 0.8, 4
    assert engine.maybe_unlock_level(c, states) and c.current_level == 2


def test_selection_is_deterministic_and_respects_mode(db):
    c, s = _setup(db)
    s.mode = "listening"
    acts = [engine.choose_next(db, c, s)[0].type for _ in range(10)]
    assert all("listening" in engine.ACTIVITIES[a].modes for a in acts)


def test_new_concepts_introduced_one_at_a_time(db):
    c, s = _setup(db)
    order = []
    for _ in range(14):
        act, d, spec, events = engine.choose_next(db, c, s)
        a = Attempt(session_id=s.id, child_id=c.id, activity_type=act.type, skill=act.skill, level=1, difficulty=d, spec=spec, outcome="success", score=1.0)
        db.add(a)
        db.flush()
        if "new_activity" in events:
            order.append((act.type, len([x for x in s.attempts])))
    assert len(order) >= 3  # variety for a brand-new child, not the same game all lesson
    assert len({t for t, _ in order}) == len(order)


def test_no_second_new_concept_until_first_is_practised(db):
    c, s = _setup(db)
    seen_new = set()
    for _ in range(12):
        act, d, spec, events = engine.choose_next(db, c, s)
        if "new_activity" in events:
            seen_new.add(act.type)
    assert len(seen_new) == 1


def test_one_unlucky_miss_does_not_block_unlock(db):
    # Regression: EWMA mastery alone meant one miss (0.76 -> 0.53) re-locked the level.
    c, s = _setup(db)
    states = engine.skill_states(db, c)
    for sk in ("pitch", "dynamics", "rhythm", "timbre"):
        states[sk].mastery, states[sk].attempts, states[sk].successes = 0.9, 6, 5
    states["rhythm"].mastery = 0.53  # just missed the last one, but right 5 of 6 times
    assert engine.maybe_unlock_level(c, states) and c.current_level == 2


def test_poor_form_still_blocks_unlock(db):
    c, s = _setup(db)
    states = engine.skill_states(db, c)
    for sk in ("pitch", "dynamics", "rhythm", "timbre"):
        states[sk].mastery, states[sk].attempts, states[sk].successes = 0.9, 6, 5
    states["rhythm"].mastery, states["rhythm"].successes = 0.3, 2
    assert engine.skills_needed_for_unlock(c, states) == ["rhythm"]
    assert not engine.maybe_unlock_level(c, states)


def test_skipped_new_activity_does_not_block_further_new_ones(db):
    # Regression: skips did not count as tries, so a skipped new game froze all other new activities.
    c, s = _setup(db)
    seen_new = []
    for _ in range(12):
        act, d, spec, events = engine.choose_next(db, c, s)
        db.add(Attempt(session_id=s.id, child_id=c.id, activity_type=act.type, skill=act.skill, level=1, difficulty=d, spec=spec, outcome="skipped", score=0.0))
        db.flush()
        if "new_activity" in events:
            seen_new.append(act.type)
    assert len(seen_new) >= 2


def test_skill_missing_for_unlock_gets_offered(db):
    # Regression: a real child had 0 rhythm attempts after 3 lessons, so Level 2 could never unlock.
    c, s = _setup(db)
    states = engine.skill_states(db, c)
    for sk, t in (("pitch", "high_low"), ("dynamics", "loud_soft"), ("timbre", "instrument_guess")):
        states[sk].mastery, states[sk].attempts, states[sk].successes = 0.9, 8, 8
        db.add(Attempt(session_id=s.id, child_id=c.id, activity_type=t, skill=sk, level=1, difficulty=1, spec={}, outcome="success", score=1.0))
    db.add(Attempt(session_id=s.id, child_id=c.id, activity_type="find_note", skill="pitch", level=1, difficulty=1, spec={}, outcome="success", score=1.0))
    db.flush()
    total = rhythm = 0
    for seed in range(8):
        s2 = LessonSession(child_id=c.id, level=1, mode="screen", seed=seed, plan={})
        db.add(s2)
        db.flush()
        picks = []
        for _ in range(6):
            act, d, spec, _ = engine.choose_next(db, c, s2)
            db.add(Attempt(session_id=s2.id, child_id=c.id, activity_type=act.type, skill=act.skill, level=1, difficulty=d, spec=spec, outcome="success", score=1.0))
            db.flush()
            picks.append(act.skill)
            total += 1
        rhythm += picks.count("rhythm")
        assert "rhythm" in picks  # every lesson practises the missing skill
    assert rhythm / total >= 0.3
