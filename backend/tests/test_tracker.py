"""Progress tracker: parameters measured after every activity, 80 % measured + 20 % assessed, spider charts,
outliers and end cases (no evidence, rushed taps, failed or wild AI assessments), and its use by the engine."""
import random
from datetime import timedelta

import pytest

from app import assessment
from app.db import session_factory
from app.models import Child, LangAttempt, LangSkillState, LessonSession, SkillState
from tests.conftest import make_child, register
from tests.sim_progression import age_everything, language_course, music_course


def _settle():
    """Wait for background AI reviews started by session ends (one per child at a time)."""
    import time

    for _ in range(100):
        if not assessment._running:
            return
        time.sleep(0.05)


def _child(cid):
    db = session_factory()()
    return db, db.get(Child, cid)


def _axis(t, area, axis):
    ar = next(a for a in t["areas"] if a["id"] == area)
    return next(x for x in ar["axes"] if x["id"] == axis)


def test_catalogue_covers_the_guide_and_every_measure_exists(client):
    cat = assessment.catalogue()
    groups = {p["group"] for p in cat}
    assert {"Common", "Reading", "Writing", "Speaking", "Listening", "Vocabulary", "Music knowledge", "Music performance",
            "Music expression", "Keyboard", "Cognitive", "Creativity"} <= groups and len(cat) >= 230
    assert len({(p["group"], p["name"]) for p in cat}) == len(cat)
    register(client)
    cid = make_child(client)["id"]
    db, child = _child(cid)
    measures = assessment._measure_all(db, child, [])
    missing = {p["measure"] for p in cat if p["measure"]} - set(measures)
    assert not missing, missing
    db.close()
    assert [assessment.band(x) for x in (0, 20, 21, 55, 80, 81, 100, None)] == \
        ["Introduction", "Introduction", "Exploring", "Developing", "Proficient", "Demonstrated mastery", "Demonstrated mastery", None]


def test_new_child_is_not_assessed_yet_never_zero(client):
    register(client)
    cid = make_child(client)["id"]
    t = client.get(f"/api/children/{cid}/tracker").json()
    assert t["weights"] == {"measured": 0.8, "assessed": 0.2}
    for area in t["areas"]:
        for ax in area["axes"]:
            assert ax["final"] is None and ax["source"] == "not assessed yet"
    assert t["coverage"]["measured"] >= 120 and all(p["score"] is None for p in t["parameters"])


def test_tracker_updates_after_every_activity_and_keeps_daily_history(client):
    register(client)
    cid = make_child(client, name="Asha", language="en")["id"]
    seen = []
    language_course(client, cid, "hi", 0.8, sessions=1, per_session=12, seed=1)
    for _ in range(3):
        t = client.get(f"/api/children/{cid}/tracker").json()
        seen.append(_axis(t, "lang:hi", "listen")["n"])
        nxt = client.post(f"/api/children/{cid}/learn/hi/next", json={"focus": "listen"}).json()
        db = session_factory()()
        row = db.get(LangAttempt, nxt["attempt_id"])
        spec = row.spec
        row.created_at = row.created_at - timedelta(seconds=3)  # a real answer takes a moment
        db.commit()
        db.close()
        client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"choice": spec["answer"]}})
    assert seen[0] < seen[1] < seen[2]  # every single answer moves the tracker
    t = client.get(f"/api/children/{cid}/tracker").json()
    hi = next(a for a in t["areas"] if a["id"] == "lang:hi")
    assert hi["title"] == "Hindi" and _axis(t, "lang:hi", "listen")["final"] is not None and _axis(t, "lang:hi", "listen")["band"]
    hist = client.get(f"/api/children/{cid}/tracker/history?area=lang:hi").json()
    assert len(hist) == 1 and hist[0]["axes"]["listen"] is not None
    params = {(p["group"], p["name"]): p for p in t["parameters"]}
    assert params[("Listening", "Word recognition from audio")]["score"] is not None
    assert params[("Common", "Response time")]["score"] is None  # shown in context, never scored


def test_rushed_taps_and_skip_runs_are_outliers_not_ability(client):
    register(client)
    cid = make_child(client)["id"]
    language_course(client, cid, "es", 0.9, sessions=1, per_session=10, seed=2)
    db, child = _child(cid)
    before, q = assessment.load_events(db, child.id)
    rows = list(db.query(LangAttempt).filter(LangAttempt.child_id == cid))
    for a in rows[:4]:  # four answers 0.2 s after the activity appeared: accidental taps
        a.answered_at = a.created_at + timedelta(seconds=0.2)
        a.outcome = "miss"
    db.commit()
    after, q2 = assessment.load_events(db, child.id)
    assert q2["rushed_excluded"] == 4 and len(after) == len(before) - 4
    db.close()


def test_eighty_twenty_with_a_teacher_assessment_and_correcting_it(client):
    register(client)
    cid = make_child(client, language="en")["id"]
    music_course(client, cid, 0.7, sessions=1, per_session=12, seed=3)
    t = client.get(f"/api/children/{cid}/tracker").json()
    ax = next(x for x in t["areas"][0]["axes"] if x["measured"] is not None)
    assert client.post(f"/api/children/{cid}/assessments", json={"area": "music", "axis": "nope", "score": 50}).status_code == 422
    a = client.post(f"/api/children/{cid}/assessments", json={"area": "music", "axis": ax["id"], "score": 100, "note": "plays well at home",
                                                              "source": "teacher"}).json()
    assert a["quality"]["human_review_status"] == "reviewed"
    t2 = client.get(f"/api/children/{cid}/tracker").json()
    ax2 = _axis(t2, "music", ax["id"])
    assert ax2["final"] == pytest.approx(round(0.8 * ax["measured"] + 0.2 * 100, 1), abs=0.11) and "teacher" in ax2["source"]
    client.patch(f"/api/children/{cid}/assessments/{a['id']}", json={"status": "rejected"})
    assert _axis(client.get(f"/api/children/{cid}/tracker").json(), "music", ax["id"])["final"] == ax["measured"]


def test_ai_assessment_is_validated_clipped_and_can_change_the_pace(client, monkeypatch):
    import app.teacher.service as svc

    register(client)
    cid = make_child(client, language="en")["id"]
    music_course(client, cid, 0.95, sessions=1, per_session=12, seed=4)
    _settle()
    db, child = _child(cid)
    t = assessment.tracker(db, child, with_catalogue=False)
    pitch = max((x for x in t["areas"][0]["axes"] if x["measured"] is not None and x["skill"]), key=lambda x: x["n"])  # the skill axis with most evidence
    name = pitch["id"]
    st = db.query(SkillState).filter_by(child_id=cid, skill=name).first()
    d_before = st.difficulty
    monkeypatch.setattr(svc.TeacherService, "uses_ai", lambda self, c: True)
    monkeypatch.setattr(svc.TeacherService, "assess_progress", lambda self, c, m, mem, axes: {
        "axes": [{"axis": f"music/{name}", "score": 100.0 if pitch["measured"] < 70 else 99.0, "confidence": 0.9, "observation": "Hears high and low well.",
                  "pace": "faster" if d_before < 5 else "same"},
                 {"axis": "music/nonsense", "score": 50, "confidence": 1, "observation": "", "pace": "same"},
                 {"axis": "music/rhythm", "score": 140, "confidence": 1, "observation": "", "pace": "same"}],
        "focus": ["music/rhythm"], "teacher_note": "Clap a slow beat together at bedtime."})
    out = assessment.run_ai_assessment(db, child, "test")
    db.commit()
    assert [a.axis for a in out] == [name]  # unknown axes and impossible scores are dropped
    a = out[0]
    if pitch["measured"] < 75:
        assert a.score == pytest.approx(pitch["measured"] + 25, abs=0.11) and a.meta["assessment_validity"] == "partially valid"
    assert a.meta["model_name"] and a.meta["human_review_status"] == "not reviewed" and a.meta["input_modality"] == "interaction"
    t2 = assessment.tracker(db, child, with_catalogue=False)
    p2 = _axis(t2, "music", name)
    assert p2["assessed"]["source"] == "ai" and p2["final"] != pitch["final"]
    db.refresh(st)
    if d_before < 5 and a.score >= 65 and a.confidence >= 0.6:
        assert st.difficulty == d_before + 1  # the AI teacher raised the pace, within the engine's bounds
    else:
        assert st.difficulty == d_before  # little evidence halves the AI's confidence: no pace change on its word alone
    if pitch["n"] < assessment.LIMITED_EVIDENCE:
        assert a.confidence == pytest.approx(0.45) and "limited evidence" in a.meta["limitations"]
    # no new answers: no second review (one review per 5 minutes and per new evidence)
    assert assessment.run_ai_assessment(db, child, "again") == []
    db.close()


def test_failed_ai_review_keeps_the_measured_tracker(client, monkeypatch):
    import app.teacher.service as svc

    register(client)
    cid = make_child(client, language="en")["id"]
    music_course(client, cid, 0.6, sessions=1, per_session=10, seed=5)
    _settle()
    db, child = _child(cid)
    before = assessment.tracker(db, child, with_catalogue=False)
    monkeypatch.setattr(svc.TeacherService, "uses_ai", lambda self, c: True)
    monkeypatch.setattr(svc.TeacherService, "assess_progress", lambda *a: None)  # timeout / token limit / refusal
    assert assessment.run_ai_assessment(db, child, "test") == []
    db.commit()
    fail = db.query(assessment.Assessment).filter_by(child_id=cid, source="system").one()
    assert fail.meta["assessment_validity"] == "invalid" and fail.meta["limitations"]
    after = assessment.tracker(db, child, with_catalogue=False)
    assert [x["final"] for x in after["areas"][0]["axes"]] == [x["final"] for x in before["areas"][0]["axes"]]
    db.close()


def test_child_feeling_is_separate_and_hard_twice_starts_gently(client):
    register(client)
    cid = make_child(client)["id"]
    for _ in range(2):
        assert client.post(f"/api/children/{cid}/feeling", json={"feeling": "hard"}).status_code == 201
    t = client.get(f"/api/children/{cid}/tracker").json()
    conf = next(p for p in t["parameters"] if p["name"] == "Confidence rating")
    assert conf["score"] == 25 and all(ax["final"] is None for ax in t["areas"][0]["axes"])  # never mixed into performance
    sid = client.post(f"/api/children/{cid}/sessions", json={}).json()["session_id"]
    db = session_factory()()
    assert db.get(LessonSession, sid).pending_override == "easy"
    db.close()


def test_the_engine_leans_on_the_weakest_axis(client):
    from app.lang import engine

    rng = random.Random(3)
    sk = {s: LangSkillState(child_id="c", lang="es", skill=s, mastery=0.5, difficulty=2, attempts=10, successes=5, streak=0, fail_streak=0)
          for s in engine.SKILLS}
    picks = [engine.choose("es", sk, {}, rng, need={"listen": 0.0, "read": 0.0, "write": 1.0}).skill for _ in range(300)]
    assert picks.count("write") > picks.count("listen") * 1.6


def test_ending_a_language_sitting_saves_the_tracker(client):
    register(client)
    cid = make_child(client, language="en")["id"]
    language_course(client, cid, "ta", 0.7, sessions=1, per_session=14, seed=6)
    r = client.post(f"/api/children/{cid}/learn/ta/end").json()
    assert r["saved"] and r["area"]["id"] == "lang:ta" and isinstance(r["ai_review"], bool)  # False when a review is already running
    age_everything(cid, 24 * 15)  # two weeks later the chart compares with this snapshot
    db = session_factory()()
    for s in db.query(assessment.ProgressSnapshot).filter_by(child_id=cid):
        s.day = "2000-01-01"
    db.commit()
    db.close()
    t = client.get(f"/api/children/{cid}/tracker").json()
    ta = next(a for a in t["areas"] if a["id"] == "lang:ta")
    assert t["compared_with"] == "2000-01-01" and any(x["before"] is not None for x in ta["axes"])
