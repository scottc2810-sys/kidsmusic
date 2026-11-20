import random

import pytest

from app import basics
from app.db import session_factory
from app.models import SkillState
from tests.conftest import register
from tests.test_memory_mcp import _init, _tool


def test_tiers_grow_with_mastery():
    st = SkillState(child_id="c", skill="pitch", mastery=0.3, difficulty=1, attempts=4, successes=1, streak=0, fail_streak=0)
    assert basics.topic_tier(None) == 1 and basics.topic_tier(st) == 1
    st.mastery, st.attempts = 0.6, 9
    assert basics.topic_tier(st) == 2
    st.mastery, st.attempts = 0.8, 20
    assert basics.topic_tier(st) == 3
    # a child already succeeding at a harder difficulty moves up without many repetitions
    quick = SkillState(child_id="c", skill="pitch", mastery=0.6, difficulty=3, attempts=3, successes=3, streak=0, fail_streak=0)
    assert basics.topic_tier(quick) == 2
    quick.difficulty = 4
    assert basics.topic_tier(quick) == 3


def test_exercise_validation_keeps_to_the_tier():
    ex = basics.validate(["Sa", "Re", "Ga", "Re", "Ga", "Ma"], None, [1, 1, 2, 0.4, 7, 1], 3, 1, "Little steps", "Hi {name}!")
    assert [n for n, _ in ex.notes] == [60, 62, 64, 62, 64, 65] and ex.phrases == [3, 6]
    assert [b for _, b in ex.notes] == [1, 1, 2, 0.5, 3, 1]  # snapped to child-friendly lengths
    with pytest.raises(ValueError):
        basics.validate(["Sa", "Pa'"], None, None, 8, 1, "too high", None)  # upper saptak is tier 2
    with pytest.raises(ValueError):
        basics.validate(["Sa", "Re"], None, None, 8, 2, "too short", None)
    assert basics.validate(["Sa", "Re", "Ga", "Pa'", ".Ni"], None, None, 8, 2, "wide", None).notes[3][0] == 79
    assert basics.validate(["Sa", "Re", "Ga", "Ma(t)", "Pa"], None, None, 8, 3, "Yaman", None).notes[3][0] == 66
    assert basics.validate(["Sa", "Re", "Ga", "Ma"], None, None, 8, 1, "stupid title", None).title == "Sargam exercise"  # safety filter


def test_offline_exercises_stay_in_range_and_tier3_uses_a_thaat():
    for tier in (1, 2, 3):
        for seed in range(10):
            ex = basics.offline_exercise(tier, random.Random(seed), 1)
            allowed = set(basics.SWARS_FOR_TIER[tier].values())
            assert all(n in allowed for n, _ in ex.notes) and 4 <= len(ex.notes) <= 32
            if tier == 3:
                assert any(ex.title.startswith(name) for name in basics.THAATS)
                assert set(n for n, _ in ex.notes) <= set(next(v for k, v in basics.THAATS.items() if ex.title.startswith(k)))
    assert basics.swar_label(72, "en") == "Sa'" and basics.swar_label(55, "en") == ".Pa" and basics.swar_label(66, "en") == "Ma♯"
    assert basics.swar_label(72, "hi") == "सां" and basics.swar_label(61, "hi") == "रे♭"


def test_exercise_api_grows_with_progress(client):
    register(client, "grow@example.com")
    cid = client.post("/api/children", json={"name": "Asha", "age": 6, "language": "hinglish"}).json()["id"]
    st = client.get(f"/api/children/{cid}/basics").json()
    assert st["tiers"]["swars"]["tier"] == 1 and st["tiers"]["alankars"]["next"]["tier"] == 2 and st["exercises"] == []
    assert st["brain"] == "offline"
    ex = client.post(f"/api/children/{cid}/basics/alankars/exercise").json()
    assert ex["song_id"].startswith("x_") and ex["source"] == "offline" and ex["tier"] == 1 and not ex["reused"]
    again = client.post(f"/api/children/{cid}/basics/alankars/exercise").json()
    assert again["song_id"] == ex["song_id"] and again["reused"]  # finish this one first
    # taught by the song school, with sargam words computed from the notes
    song = client.post(f"/api/children/{cid}/songs/{ex['song_id']}/start").json()["song"]
    assert song["source"] == "offline" and all(w in ("Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa'") for w in song["words"])
    assert ex["song_id"] in [s["id"] for s in client.get(f"/api/children/{cid}/songs").json()]
    # the child progresses: melody mastery -> tier 2 -> wider range exercises
    db = session_factory()()
    s = next(x for x in db.query(SkillState).filter_by(child_id=cid, skill="melody"))
    s.mastery, s.attempts = 0.7, 12
    db.commit()
    db.close()
    st = client.get(f"/api/children/{cid}/basics").json()
    assert st["tiers"]["alankars"]["tier"] == 2
    new = client.post(f"/api/children/{cid}/basics/alankars/exercise", json={"force": True}).json()
    assert new["tier"] == 2 and new["song_id"] != ex["song_id"]
    assert client.post(f"/api/children/{cid}/basics/rhythm/exercise").status_code == 404


def test_claude_designed_exercise_is_validated(client, monkeypatch):
    from app.teacher.service import TeacherService
    register(client, "claude-ex@example.com")
    cid = client.post("/api/children", json={"name": "Asha", "age": 6, "cloud_ai_allowed": True}).json()["id"]
    good = {"title": "Bird hops", "intro": "Hi {name}! Hop up two swars.", "swars": ["Sa", "Ga", "Re", "Ma", "Ga", "Pa"], "beats": [1] * 6, "phrase_length": 3}
    monkeypatch.setattr(TeacherService, "make_exercise", lambda self, *a, **k: good)
    ex = client.post(f"/api/children/{cid}/basics/swars/exercise").json()
    assert ex["source"] == "claude" and ex["title"] == "Bird hops" and ex["intro"] == "Hi Asha! Hop up two swars."
    song = client.post(f"/api/children/{cid}/songs/{ex['song_id']}/start").json()["song"]
    assert song["note"] == "Hi Asha! Hop up two swars." and song["phrases"] == [3, 6]
    # out-of-range AI output is never used: offline generator instead
    monkeypatch.setattr(TeacherService, "make_exercise", lambda self, *a, **k: {**good, "swars": ["Sa", "Pa'", "Ga", "Ma"]})
    bad = client.post(f"/api/children/{cid}/basics/swars/exercise", json={"force": True}).json()
    assert bad["source"] == "offline"


def test_mcp_add_exercise(client):
    register(client, "mcp-ex@example.com")
    client.post("/api/children", json={"name": "Ravi", "age": 7})
    ro = client.post("/api/integrations/tokens", json={"name": "ro"}).json()["token"]
    rw = client.post("/api/integrations/tokens", json={"name": "rw", "allow_write": True}).json()["token"]
    _init(client, rw)
    status = _tool(client, rw, "basics_status", {"child": "Ravi"})
    assert status["tiers"]["alankars"]["tier"] == 1 and "Pa'" not in status["allowed_swars"]["alankars"]
    assert "read-only" in _tool(client, ro, "add_exercise", {"child": "Ravi", "title": "x", "swars": ["Sa", "Re", "Ga", "Ma"]})["error"]
    assert "not available" in _tool(client, rw, "add_exercise", {"child": "Ravi", "title": "x", "swars": ["Sa", "Re", "Ga", "Pa'"]})["error"]
    out = _tool(client, rw, "add_exercise", {"child": "Ravi", "title": "Ravi's ladder", "swars": ["Sa", "Re", "Ga", "Ma", "Ma", "Ga", "Re", "Sa"],
                                              "phrase_length": 4, "intro": "Climb up and down, {name}!"})
    assert out["ok"] and out["parts"] == 2
    assert _tool(client, rw, "basics_status", {"child": "Ravi"})["exercises"][0]["source"] == "claude-code"
