import json

from app.audio.analysis import synth_wav
from app.curriculum import SONGS

from .conftest import make_child, register
from .test_api import _perfect_response

MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def _play_lesson(client, child_id, n=8):
    sid = client.post(f"/api/children/{child_id}/sessions", json={}).json()["session_id"]
    for _ in range(n):
        nxt = client.post(f"/api/sessions/{sid}/next").json()
        client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer", json={"response": _perfect_response(nxt["attempt_id"])})
    client.post(f"/api/sessions/{sid}/end")
    return sid


def test_graph_memory_tracks_lessons_recordings_and_notes(client):
    register(client)
    child = make_child(client, session_minutes=20, consent_recording=True)
    _play_lesson(client, child["id"])
    wrong = [(m if m != 65 else 64, b) for m, b in SONGS["twinkle"]["notes"]]
    client.post(f"/api/children/{child['id']}/recordings", files={"file": ("t.wav", synth_wav(wrong, bpm=100), "audio/wav")})
    client.post(f"/api/children/{child['id']}/memory/notes", json={"note": "Loves the drum game", "about_skill": "rhythm"})

    ov = client.get(f"/api/children/{child['id']}/memory").json()
    assert ov["child"]["name"] == "Asha"
    assert sum(v["attempts"] for v in ov["skills"].values()) == 8
    assert any(s["kind"] == "mistake" and "F" in s["label"] for s in ov["struggles"])
    kinds = {e["kind"] for e in ov["recent"]}
    assert {"session", "recording", "note"} <= kinds
    assert ov["graph"]["nodes"] > 8 and ov["graph"]["edges"] > 8

    g = client.get(f"/api/children/{child['id']}/memory/graph", params={"relation": "PRACTICED"}).json()
    assert g["edges"] and all(e["rel"] == "PRACTICED" for e in g["edges"])

    before = ov["graph"]
    after = client.post(f"/api/children/{child['id']}/memory/rebuild").json()
    assert after["nodes"] == before["nodes"] and after["edges"] == before["edges"]  # rebuild is faithful & idempotent


def test_focus_override_steers_next_lesson_plan(client):
    register(client)
    child = make_child(client)
    assert client.put(f"/api/children/{child['id']}/memory/focus", json={"skill": "violin"}).status_code == 400
    assert client.put(f"/api/children/{child['id']}/memory/focus", json={"skill": "rhythm"}).status_code == 200
    plan = client.post(f"/api/children/{child['id']}/sessions", json={}).json()["plan"]
    assert plan["focus_skill"] == "rhythm"


def _rpc(client, method, params=None, token=None, rid=1):
    headers = dict(MCP_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}})


def _init(client, token):
    r = _rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}, token)
    assert r.status_code == 200, r.text
    return r


def _tool(client, token, name, args=None):
    r = _rpc(client, "tools/call", {"name": name, "arguments": args or {}}, token, rid=2)
    assert r.status_code == 200, r.text
    body = r.json()
    return json.loads(body["result"]["content"][0]["text"])


def test_mcp_http_requires_token_and_is_parent_scoped(client):
    register(client, "a@example.com")
    child = make_child(client, session_minutes=20)
    _play_lesson(client, child["id"], 5)
    assert _rpc(client, "tools/list").status_code == 401
    assert _rpc(client, "tools/list", token="melo_not-a-real-token").status_code == 401

    tok = client.post("/api/integrations/tokens", json={"name": "laptop"}).json()
    assert tok["token"].startswith("melo_") and "claude mcp add --transport http melo" in tok["commands"]["http"]
    assert "KM_MCP_TOKEN=" in tok["commands"]["stdio"] and "melo_mcp.py" in tok["commands"]["stdio"]
    raw = tok["token"]
    _init(client, raw)
    tools = _rpc(client, "tools/list", token=raw).json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert {"list_children", "child_overview", "learning_graph", "progress_timeline", "recording_feedback", "add_note"} <= names

    kids = _tool(client, raw, "list_children")
    assert [k["name"] for k in kids] == ["Asha"]
    ov = _tool(client, raw, "child_overview", {"child": "asha"})
    assert sum(v["attempts"] for v in ov["skills"].values()) == 5
    graph = _tool(client, raw, "learning_graph", {"child": "Asha", "depth": 2})
    assert any(n["kind"] == "activity" for n in graph["nodes"])

    # read-only token cannot write
    assert "read-only" in _tool(client, raw, "add_note", {"child": "Asha", "note": "hi"})["error"]

    # another parent's token cannot see Asha
    client.post("/api/auth/logout")
    register(client, "b@example.com")
    other = client.post("/api/integrations/tokens", json={"name": "x", "allow_write": True}).json()["token"]
    _init(client, other)
    assert _tool(client, other, "list_children") == []
    assert "No child" in _tool(client, other, "child_overview", {"child": "Asha"})["error"]

    # write token works for own child; revoked token stops working
    make_child(client, name="Ravi")
    assert _tool(client, other, "add_note", {"child": "Ravi", "note": "Practised with grandma"})["ok"] is True
    tid = client.get("/api/integrations/tokens").json()[0]["id"]
    assert client.delete(f"/api/integrations/tokens/{tid}").status_code == 204
    assert _rpc(client, "tools/list", token=other).status_code == 401


def test_deleting_child_erases_memory_graph(client):
    register(client)
    child = make_child(client, session_minutes=20)
    _play_lesson(client, child["id"], 3)
    from app.db import session_factory
    from app.memory import MemoryEdge, MemoryEvent, MemoryNode

    db = session_factory()()
    assert db.query(MemoryNode).filter_by(child_id=child["id"]).count() > 0
    db.close()
    assert client.delete(f"/api/children/{child['id']}").status_code == 204
    db = session_factory()()
    for model in (MemoryNode, MemoryEdge, MemoryEvent):
        assert db.query(model).filter_by(child_id=child["id"]).count() == 0
    db.close()


def test_tokens_stored_hashed(client):
    register(client)
    raw = client.post("/api/integrations/tokens", json={}).json()["token"]
    from app.db import session_factory
    from app.models import ApiToken

    db = session_factory()()
    t = db.query(ApiToken).one()
    assert raw not in (t.token_hash, t.prefix) and len(t.token_hash) == 64
    db.close()
