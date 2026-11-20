"""Whole-course checks: simulated children over several separate sessions (new days / lost tabs).

Difficulty must follow the child (up for a strong child, gently down and supported for a struggling one),
progress must persist between sessions, earned stages must never be taken away, and the child's learning
graph (what the AI brain is given) must hold music and languages together.
"""
import random

import pytest

from app import memory
from app.db import session_factory
from app.models import Child
from tests.conftest import make_child, register
from tests.sim_progression import language_course, music_course


@pytest.fixture()
def seeded(monkeypatch):
    rng = random.Random(1234)
    import app.routers.learn as learn_router
    import app.routers.lessons as lessons_router

    monkeypatch.setattr(learn_router.secrets, "randbits", lambda k: rng.getrandbits(k))
    monkeypatch.setattr(lessons_router.secrets, "randbits", lambda k: rng.getrandbits(k), raising=False)


def _avg(d: dict) -> float:
    return sum(v[0] for v in d.values()) / len(d)


def test_music_difficulty_follows_the_child_and_persists_between_sessions(client, seeded):
    register(client)
    strong = make_child(client, name="Asha", session_minutes=20)["id"]
    weak = make_child(client, name="Ravi", session_minutes=20)["id"]
    s_log = music_course(client, strong, 0.9, sessions=3, seed=1)
    w_log = music_course(client, weak, 0.3, sessions=3, seed=2)
    for log in (s_log, w_log):
        for a, b in zip(log, log[1:]):
            assert b["start_difficulty"] == a["end_difficulty"]  # nothing is forgotten in a new session
    assert _avg(s_log[-1]["end_difficulty"]) >= _avg(s_log[0]["start_difficulty"]) + 1.5 and s_log[-1]["level"] >= 3
    assert w_log[-1]["level"] <= 2 and _avg(w_log[-1]["end_difficulty"]) < _avg(s_log[-1]["end_difficulty"])
    assert any("easier" in r["events"] or "break_offer" in r["events"] for r in w_log)  # supported, not pushed
    # a teacher remembers what was hard last time and comes back to it gently
    assert any("tricky" in r["greeting"] or "hard" in r["greeting"] for r in w_log[1:]), [r["greeting"] for r in w_log]


def test_language_course_is_progressive_never_takes_stages_away_and_welcomes_back(client, seeded):
    register(client)
    logs = {}
    for label, p in (("strong", 0.9), ("average", 0.65), ("struggling", 0.3)):
        cid = make_child(client, name="Kid", language="en")["id"]
        logs[label] = (cid, language_course(client, cid, "hi", p, sessions=4, seed=5))
    for label, (_, log) in logs.items():
        for a, b in zip(log, log[1:]):
            assert b["stage_before"] >= a["stage_after"] and b["stage_after"] >= b["stage_before"], (label, log)  # stars never go down
            assert b["tier"] >= a["tier"], label  # opened words stay open
        for row in log[1:]:  # a new sitting: welcome back and warm up, never a cold start
            assert row["first_line"].startswith(("Welcome back", "Hello again")), (label, row["first_line"])
    strong, average, struggling = (logs[k][1] for k in ("strong", "average", "struggling"))
    assert strong[1]["stage_after"] >= 4 and strong[-1]["words_known"] >= 10
    assert average[-1]["stage_after"] > average[0]["stage_before"] and average[-1]["words_known"] >= average[0]["words_known"]
    # the struggling child gets errorless turns (answer glowing) and still moves forward
    assert any("*" in r["activities"] for r in struggling)
    assert max(struggling[-1]["skills_after"].values()) > max(struggling[0]["skills_after"].values()) or struggling[-1]["words_known"] > 0
    assert "empathetic" in {e for r in struggling for e in r["emotions"]}


def test_learning_graph_holds_languages_and_feeds_the_ai_brief(client, seeded):
    register(client)
    cid = make_child(client, name="Meera", language="en")["id"]
    language_course(client, cid, "ta", 0.35, sessions=2, seed=9)
    music_course(client, cid, 0.5, sessions=1, seed=9)
    assert client.post(f"/api/children/{cid}/memory/notes", json={"note": "Meera loves animal songs"}).status_code == 201
    db = session_factory()()
    child = db.get(Child, cid)
    ov = memory.overview(db, child)
    tamil = next(x for x in ov["languages"] if x["code"] == "ta")
    assert tamil["name"] == "Tamil" and tamil["skills"]["listen"] >= 1
    brief = memory.brief(db, child)
    assert brief["languages"][0]["name"] == "Tamil" and "finds_hard" in brief and brief["skills"]
    assert brief["days_since_last_lesson"] is not None
    assert any("loves animal songs" in n for n in brief["parent_notes"])
    assert "Meera" not in str(brief) and "{name} loves animal songs" in str(brief)  # the child's name never goes to an AI brain
    # the graph is derived: a full rebuild gives the same language picture
    before = memory.languages(db, child)
    memory.rebuild(db, child)
    db.commit()
    after = memory.languages(db, child)
    assert [(x["code"], x["stage"], x["words_known"]) for x in after] == [(x["code"], x["stage"], x["words_known"]) for x in before]
    db.close()
