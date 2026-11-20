"""One child, end to end: every activity must update the child's learning graph (memory) and spider charts,
difficulty must move in music (instrument skills) and in language listening / reading / writing / speaking,
the charts must filter by skill, and the teacher summary must plan the next activities.

Run as a script for a readable report:  .venv/Scripts/python.exe -m tests.test_one_kid
"""
import random

import pytest

from app.db import session_factory
from app.models import LangSkillState, SkillState
from tests.conftest import make_child, register
from tests.sim_progression import lang_response, music_response

SKILLS = ("listen", "read", "write", "speak")


@pytest.fixture()
def seeded(monkeypatch):
    rng = random.Random(77)
    import app.routers.learn as learn_router
    import app.routers.lessons as lessons_router

    monkeypatch.setattr(learn_router.secrets, "randbits", lambda k: rng.getrandbits(k))
    monkeypatch.setattr(lessons_router.secrets, "randbits", lambda k: rng.getrandbits(k), raising=False)


def _graph_touched(cid):
    """When the child's learning graph was last written (any node or edge), plus how many timeline events it has."""
    from sqlalchemy import func

    from app.memory import MemoryEdge, MemoryNode

    db = session_factory()()
    t = max(db.query(func.max(MemoryNode.updated_at)).filter(MemoryNode.child_id == cid).scalar() or "",
            db.query(func.max(MemoryEdge.updated_at)).filter(MemoryEdge.child_id == cid).scalar() or "", key=str)
    db.close()
    return str(t)


def _difficulties(cid):
    db = session_factory()()
    music = {s.skill: s.difficulty for s in db.query(SkillState).filter_by(child_id=cid)}
    lang = {s.skill: s.difficulty for s in db.query(LangSkillState).filter_by(child_id=cid, lang="hi")}
    db.close()
    return music, lang


def journey(client, report=print):
    register(client)
    cid = make_child(client, name="Asha", age=6, language="en", session_minutes=20)["id"]
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})  # speaking needs the parent's permission
    rng = random.Random(5)
    graph = lambda: {**client.get(f"/api/children/{cid}/memory").json()["graph"], "touched": _graph_touched(cid)}  # noqa: E731
    tracker = lambda: client.get(f"/api/children/{cid}/tracker").json()  # noqa: E731
    start_music, start_lang = _difficulties(cid)
    log = {"graph": [graph()], "updates": 0, "activities": 0}

    def check_moved(before_graph, before_tracker, area):
        """After one activity: the learning graph and that area's spider chart have both changed."""
        g, t = graph(), tracker()
        ar = next(a for a in t["areas"] if a["id"] == area)
        old = next(a for a in before_tracker["areas"] if a["id"] == area) if any(a["id"] == area for a in before_tracker["areas"]) else None
        moved = old is None or [x["n"] for x in ar["axes"]] != [x["n"] for x in old["axes"]]
        log["activities"] += 1
        # the graph was written by this activity (nodes, edges or weights): counts alone can stay flat or shrink
        log["updates"] += int(moved and g["touched"] > before_graph["touched"])
        return g, t

    # three music lessons (a child who learns well: 85 % right)
    for lesson in range(3):
        sid = client.post(f"/api/children/{cid}/sessions", json={}).json()["session_id"]
        for _ in range(10):
            g0, t0 = graph(), tracker()
            nxt = client.post(f"/api/sessions/{sid}/next").json()
            if nxt.get("done"):
                break
            client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer",
                        json={"response": music_response(nxt["attempt_id"], rng.random() < 0.85)})
            check_moved(g0, t0, "music")
        client.post(f"/api/sessions/{sid}/end")
    # Hindi: every skill in turn, including speaking (microphone allowed, speech available)
    for round_ in range(4):
        for skill in SKILLS:
            for _ in range(4):
                g0, t0 = graph(), tracker()
                nxt = client.post(f"/api/children/{cid}/learn/hi/next", json={"focus": skill, "speech": True}).json()
                client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer",
                            json={"response": lang_response(nxt["attempt_id"], rng.random() < 0.85)})
                check_moved(g0, t0, "lang:hi")
    client.post(f"/api/children/{cid}/learn/hi/end")
    end_music, end_lang = _difficulties(cid)
    stages = {k: v["stage"] for k, v in client.get(f"/api/children/{cid}/learn/hi").json()["skills"].items()}
    t = tracker()
    report(f"activities: {log['activities']}, each one updated the learning graph + spider chart: {log['updates']}/{log['activities']}")
    report(f"learning graph: { {k: v for k, v in log['graph'][0].items() if k != 'touched'} } -> { {k: v for k, v in graph().items() if k != 'touched'} }")
    report(f"music difficulty (1-5): {start_music} -> {end_music}")
    report(f"Hindi working difficulty (1-5): {start_lang} -> {end_lang}; stage reached: {stages}")
    for area in t["areas"]:
        report(f"spider {area['title']}: " + ", ".join(f"{x['label']} {x['final'] if x['final'] is not None else '-'}" for x in area["axes"]))
    lenses = {}
    for lens in ("read", "write", "speak", "listen", "music"):
        lv = client.get(f"/api/children/{cid}/tracker?lens={lens}").json()["lens_view"]
        lenses[lens] = lv
        report(f"filter {lv['title']}: axes {[(x['label'], x['final']) for x in lv['axes']]}, {len(lv['parameters'])} parameters")
    plan = client.post(f"/api/children/{cid}/tracker/summary", json={"lens": None}).json()
    report(f"teacher summary ({plan['source']}): {plan['summary']}")
    for a in plan["next_activities"]:
        report(f"  next: {a['activity']} ({a['minutes']} min): {a['why']}")
    return {"cid": cid, "log": log, "start": (start_music, start_lang), "end": (end_music, end_lang), "stages": stages, "tracker": t, "lenses": lenses, "plan": plan,
            "graph_end": graph()}


def test_one_child_end_to_end(client, seeded):
    r = journey(client, report=lambda *_: None)
    log = r["log"]
    assert log["updates"] == log["activities"] >= 60  # every single activity moved the graph and the spider chart
    g0, g1 = log["graph"][0], r["graph_end"]
    assert g1["nodes"] > g0["nodes"] + 10 and g1["edges"] > g0["edges"] + 10
    (m0, l0), (m1, l1) = r["start"], r["end"]
    assert sum(m1.values()) > sum(m0.values()) and max(m1.values()) >= 3  # instrument skills got harder
    stages = r["stages"]
    for s in SKILLS:
        # every language skill moved up, speaking included: the stage reached (never taken away) is 3+, and the working
        # difficulty is above the start (it may dip a step after two misses: that is the engine adapting)
        assert stages[s] >= 3 and l1[s] >= 2, (s, stages, l1)
    hi = next(a for a in r["tracker"]["areas"] if a["id"] == "lang:hi")
    assert all(x["final"] is not None for x in hi["axes"] if x["id"] in SKILLS)
    # filters: a lens shows only its own skill, across areas, with only its parameters
    read = r["lenses"]["read"]
    assert read["axes"] and all(x["skill"] == "read" for x in read["axes"]) and {p["group"] for p in read["parameters"]} == {"Reading"}
    assert {p["group"] for p in r["lenses"]["music"]["parameters"]} <= {"Music knowledge", "Music performance", "Music expression", "Keyboard"}
    assert r["lenses"]["speak"]["axes"][0]["final"] is not None
    # the teacher's plan: always available (offline here), concrete next activities with reasons
    p = r["plan"]
    assert p["source"] == "offline" and p["summary"] and p["understands"] and 1 <= len(p["next_activities"]) <= 4
    assert all(a["why"] and a["activity"] for a in p["next_activities"])


def test_summary_for_a_lens_and_with_an_ai_brain(client, seeded, monkeypatch):
    import app.teacher.service as svc

    r = journey(client, report=lambda *_: None)
    cid = r["cid"]
    read_plan = client.post(f"/api/children/{cid}/tracker/summary", json={"lens": "read"}).json()
    assert all("Reading" in u or "read" in u.lower() for u in read_plan["understands"] + read_plan["working_on"])
    monkeypatch.setattr(svc.TeacherService, "uses_ai", lambda self, c: True)
    monkeypatch.setattr(svc.TeacherService, "summarize_progress", lambda self, c, t, mem, draft: {
        "summary": "Asha reads Hindi words well.", "next_activities": [{"activity": "Languages → Hindi → Writing", "why": "spelling", "minutes": 5}]})
    ai = client.post(f"/api/children/{cid}/tracker/summary", json={"lens": "write"}).json()
    assert ai["source"] == "ai" and ai["summary"] == "Asha reads Hindi words well." and ai["home_tip"]  # AI text, offline fields kept


if __name__ == "__main__":
    import os
    import sys
    import tempfile

    sys.stdout.reconfigure(encoding="utf-8")
    tmp = tempfile.mkdtemp(prefix="melo-onekid-")
    os.environ.update(KM_DATA_DIR=tmp, KM_ENV="test", KM_AI_PROVIDER="offline", KM_FRONTEND_DIST=os.path.join(tmp, "none"))
    from fastapi.testclient import TestClient

    from app.db import init_engine
    from app.main import create_app

    init_engine(f"sqlite:///{tmp}/one.db")
    with TestClient(create_app()) as c:
        c.headers.update({"X-Requested-With": "melo"})
        journey(c)
