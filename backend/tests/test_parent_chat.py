"""Parent chat: the parent talks to the AI teacher, approves changes, and the app (and the AI) follow them.
Also: the Mahamrityunjaya mantra lesson, the market conversation topic, AI-made topics, stored chat history
with a running summary (context survives new sessions and token limits)."""
import pytest

from app import memory, parent_chat
from app.curriculum import SONGS
from app.db import session_factory
from app.lang.phrases import ITEMS, PHRASE_WORDS, TOPIC_OF, topic_pool
from app.models import Child, LessonSession
from tests.conftest import make_child, register


def _types(r):
    return [a["type"] for a in r["actions"]]


def test_mantra_song_and_market_topic_exist_everywhere(client):
    s = SONGS["mahamrityunjaya_mantra"]
    assert len(s["notes"]) == len(s["words"]) == len(s["words_hi"]) == s["phrases"][-1] == 33
    for code in ITEMS:
        market = topic_pool(code, "market")
        assert len(market) == 10 and all(w.text for w in market), code
    assert {TOPIC_OF[p] for p in ("p_price", "p_money")} == {"market"} and PHRASE_WORDS["hi"]["p_price"].roman
    register(client)
    cid = make_child(client)["id"]
    songs = client.get(f"/api/children/{cid}/songs").json()
    assert any(x["id"] == "mahamrityunjaya_mantra" for x in (songs["songs"] if isinstance(songs, dict) else songs))
    cmp = client.get("/api/learn/compare?langs=hi,sa,ta,en&topic=market").json()
    assert len(cmp["rows"]) == 10 and cmp["rows"][0]["cells"]["sa"]["text"]


def test_offline_parent_chat_understands_common_requests(client):
    register(client)
    cid = make_child(client, name="Asha", language="hinglish")["id"]
    r = client.post(f"/api/children/{cid}/parent-chat", json={"message": "Please add a music lesson for the Mahamrityunjaya mantra"}).json()
    assert r["source"] == "offline" and "open_song" in _types(r)
    song = next(a for a in r["actions"] if a["type"] == "open_song")
    assert song["params"]["song_id"] == "mahamrityunjaya_mantra"
    r2 = client.post(f"/api/children/{cid}/parent-chat", json={"message": "She gets frustrated and cries. 10 minute lessons, and add market conversation in Hindi"}).json()
    t = _types(r2)
    assert {"set_tactic", "set_minutes", "practice_topic", "note"} <= set(t)
    topic = next(a for a in r2["actions"] if a["type"] == "practice_topic")
    assert topic["params"] == {"lang": "hi", "topic": "market"}
    r3 = client.post(f"/api/children/{cid}/parent-chat", json={"message": "Our goal: she should play Happy Birthday by Diwali and improve her rhythm"}).json()
    assert {"set_goal", "set_focus", "open_song"} <= set(_types(r3))


def test_applying_changes_changes_lessons_and_the_ai_context(client):
    register(client)
    cid = make_child(client, name="Asha")["id"]
    r = client.post(f"/api/children/{cid}/parent-chat", json={"message": "He is frustrated, go slower. Goal: play Twinkle by next month. Work on rhythm."}).json()
    applied = {}
    for a in r["actions"]:
        out = client.post(f"/api/children/{cid}/parent-chat/apply", json={"action": a})
        assert out.status_code == 200, out.text
        applied[a["type"]] = out.json()
    assert applied["set_tactic"]["plan"]["tactics"][0]["id"] == "gentle"
    assert applied["set_goal"]["plan"]["goals"][0]["text"].startswith("He is frustrated")
    assert applied["set_focus"]["plan"]["focus"] == "rhythm"
    # a gentle tactic really changes the next lesson: it starts easy
    sid = client.post(f"/api/children/{cid}/sessions", json={}).json()["session_id"]
    db = session_factory()()
    assert db.get(LessonSession, sid).pending_override == "easy"
    brief = memory.brief(db, db.get(Child, cid))
    assert brief["teaching_tactics"] and brief["parent_goals"] and brief["focus_override"] == "rhythm"
    db.close()
    # a goal can be removed again; a made-up change is refused
    plan = client.delete(f"/api/children/{cid}/parent-plan/goals/0").json()
    assert plan["goals"] == []
    bad = client.post(f"/api/children/{cid}/parent-chat/apply", json={"action": {"type": "set_minutes", "params": {"minutes": 99}}})
    assert bad.status_code == 422
    bad2 = client.post(f"/api/children/{cid}/parent-chat/apply", json={"action": {"type": "open_song", "params": {"song_id": "nope"}}})
    assert bad2.status_code == 422


def test_chat_history_is_stored_and_summarised_for_new_sessions(client):
    register(client)
    cid = make_child(client, name="Asha")["id"]
    for i in range(5):  # 10 turns (parent + Melo) > SUMMARIZE_EVERY
        client.post(f"/api/children/{cid}/parent-chat", json={"message": f"Asha loves elephants and drums, note {i}"})
    plan = client.get(f"/api/children/{cid}/parent-plan").json()
    assert len(plan["history"]) == 10 and plan["history"][0]["from"] == "user"
    assert "elephants" in plan["summary"] and "Asha" not in plan["summary"]  # the name never goes into the summary
    db = session_factory()()
    brief = memory.brief(db, db.get(Child, cid))
    assert "elephants" in brief["earlier_conversations"]["parent"]
    db.close()
    # the child's own chat with Melo is kept and summarised too
    for _ in range(5):
        client.post(f"/api/children/{cid}/chat", json={"message": "I like the drum song", "history": []})
    db = session_factory()()
    assert len(parent_chat.recent_turns(db, db.get(Child, cid), "child", 50)) == 10
    assert "drum" in parent_chat.chat_summary(db, db.get(Child, cid), "child")
    db.close()


def test_ai_made_conversation_topic_needs_a_brain_and_then_teaches(client, monkeypatch):
    import app.teacher.service as svc

    register(client)
    cid = make_child(client, name="Asha", language="en")["id"]
    action = {"type": "add_phrases", "label": "At the doctor", "params": {"topic_title": "At the doctor", "emoji": "🩺",
                                                                        "phrases": ["My tummy hurts.", "Thank you, doctor."], "langs": ["hi"]}}
    off = client.post(f"/api/children/{cid}/parent-chat/apply", json={"action": action})
    assert off.status_code == 422 and "AI brain" in off.json()["detail"]
    monkeypatch.setattr(svc.TeacherService, "_ai_for", lambda self, c: object())
    monkeypatch.setattr(svc.TeacherService, "_ask", lambda self, ai, prompt, schema, *a, **k: {"phrases": [
        {"english": "My tummy hurts.", "emoji": "🤕", "texts": {"en": "My tummy hurts.", "hi": "मेरे पेट में दर्द है।|mere pet mein dard hai."}},
        {"english": "Thank you, doctor.", "emoji": "👩‍⚕️", "texts": {"en": "Thank you, doctor.", "hi": "धन्यवाद, डॉक्टर।|dhanyavaad, doctor."}}]})
    out = client.post(f"/api/children/{cid}/parent-chat/apply", json={"action": action}).json()
    assert out["ok"] and "topic=c_" in out["link"]
    topic = out["link"].split("topic=")[1]
    status = client.get(f"/api/children/{cid}/learn/hi").json()
    assert any(t["id"] == topic and t.get("custom") for t in status["topics"])
    nxt = client.post(f"/api/children/{cid}/learn/hi/next", json={"topic": topic}).json()
    assert nxt["attempt_id"] and nxt["spec"]
    # another child cannot use this family's topic
    other = make_child(client, name="Ravi")["id"]
    assert client.post(f"/api/children/{other}/learn/hi/next", json={"topic": topic}).status_code == 422


def test_system_check_lists_required_and_optional(client):
    assert client.get("/api/system/check").status_code == 401
    register(client)
    r = client.get("/api/system/check").json()
    ids = {c["id"]: c for c in r["checks"]}
    assert {"data", "disk", "app", "claude", "ollama", "brain"} <= set(ids) and r["ok"] is True
    assert ids["data"]["required"] and not ids["ollama"]["required"]
    assert all(c["fix"] for c in r["checks"] if not c["ok"])  # everything missing says how to add it
