"""Other AI brains: Ollama and any OpenAI-compatible endpoint, against small fake servers on real sockets."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.config import Settings
from app.teacher import llm
from app.teacher.service import TeacherService, _obj
from tests.conftest import make_child, register

SCHEMA = _obj({"reply": {"type": "string"}, "mood": {"type": "string", "enum": ["happy", "calm"]}})


class Fake:
    """A tiny Ollama + OpenAI-compatible server. `mode` changes how it answers."""

    def __init__(self):
        self.requests: list[tuple[str, dict, dict]] = []
        self.mode = "good"
        self.focus = "pitch"
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, code, body):
                data = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                if self.path == "/api/tags":
                    return self._send(200, {"models": [{"name": "nomic-embed-text"}, {"name": "llama3.2:3b"}, {"name": "qwen2.5:7b"}]})
                if self.path == "/v1/models":
                    return self._send(200, {"data": [{"id": "local-model"}]})
                self._send(404, {})

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                fake.requests.append((self.path, body, dict(self.headers)))
                if fake.mode == "slow":
                    import time

                    time.sleep(1.2)
                reply = {"reply": "Hello {name}, let's play!", "mood": "happy"}
                if "Plan today's" in json.dumps(body):
                    reply = {"focus_skill": fake.focus, "theme": "jungle", "greeting": "Hi {name}!", "reason_for_parent": "Rhythm was hard."}
                if fake.mode == "bad":
                    reply = {"reply": 5}
                text = json.dumps(reply)
                if fake.mode == "chatty":
                    text = "<think>hmm</think>Sure! Here it is:\n```json\n" + text + "\n```"
                if self.path == "/api/chat":
                    return self._send(200, {"message": {"role": "assistant", "content": text}})
                if self.path == "/v1/chat/completions":
                    if fake.mode == "no_schema" and body.get("response_format", {}).get("type") == "json_schema":
                        return self._send(400, {"error": {"message": "response_format json_schema is not supported"}})
                    if fake.mode == "auth":
                        return self._send(401, {"error": {"message": "invalid api key"}})
                    return self._send(200, {"choices": [{"message": {"content": text}}]})
                self._send(404, {})

        self.server = HTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()


@pytest.fixture()
def fake():
    f = Fake()
    yield f
    f.close()


def test_json_helpers():
    assert llm.extract_json('<think>x</think> ok ```json\n{"a": 1}\n``` bye') == {"a": 1}
    assert llm.extract_json('Answer: {"a": {"b": 2}} done') == {"a": {"b": 2}} and llm.extract_json("no json") is None
    assert llm.conforms({"reply": "x", "mood": "calm"}, SCHEMA)
    assert not llm.conforms({"reply": "x", "mood": "angry"}, SCHEMA) and not llm.conforms({"reply": "x"}, SCHEMA)
    assert not llm.conforms({"reply": 3, "mood": "calm"}, SCHEMA)
    assert llm.pick_ollama_model(["nomic-embed-text", "mistral:7b", "llama3.2:3b"]) == "llama3.2:3b"  # chat model, preferred family
    assert llm.pick_ollama_model(["nomic-embed-text"]) is None


def test_ollama_provider_with_schema_and_model_auto_pick(fake):
    p = llm.OllamaProvider(fake.url, None, 5, "system")
    assert p.structured("Say hi", SCHEMA) == {"reply": "Hello {name}, let's play!", "mood": "happy"}
    path, body, _ = fake.requests[-1]
    assert path == "/api/chat" and body["model"] == "qwen2.5:7b" and body["format"] == SCHEMA and body["stream"] is False
    assert body["messages"][0]["content"] == "system" and "JSON schema" in body["messages"][1]["content"]
    fake.mode = "chatty"
    assert p.structured("Say hi", SCHEMA)["mood"] == "happy"  # <think> and ``` fences are tolerated
    fake.mode = "bad"
    assert p.structured("Say hi", SCHEMA) is None and "expected shape" in p.last_error  # never trust a drifting model
    down = llm.OllamaProvider("http://127.0.0.1:9", None, 1, "s")
    assert down.structured("x", SCHEMA) is None and "not running" in down.last_error


def test_openai_compatible_provider_steps_down_when_schema_is_unsupported(fake):
    p = llm.OpenAICompatProvider(fake.url + "/v1", "local-model", "sk-test", 5, "system")
    assert p.is_local
    fake.mode = "no_schema"
    assert p.structured("hi", SCHEMA)["reply"].startswith("Hello")
    formats = [r[1].get("response_format", {}).get("type") for r in fake.requests]
    assert formats == ["json_schema", "json_object"] and p._format_level == 1  # remembered for the next call
    assert fake.requests[-1][2]["Authorization"] == "Bearer sk-test"
    fake.mode = "auth"
    assert p.structured("hi", SCHEMA) is None and "API key" in p.last_error
    assert not llm.OpenAICompatProvider("https://api.openai.com/v1", "m", None, 1, "s").is_local
    with pytest.raises(llm.LLMError):
        llm._http("file:///etc/passwd")


def test_auto_finds_ollama_when_claude_code_is_missing(fake, monkeypatch, tmp_path):
    import app.teacher.service as svc

    monkeypatch.setattr(svc, "find_claude_cli", lambda *_: None)
    t = TeacherService(Settings(ai_provider="auto", data_dir=tmp_path, ollama_url=fake.url, anthropic_api_key=None))
    st = t.status()
    assert st["provider"] == "ollama" and st["local"] is True and st["endpoint"] == fake.url
    test = t.self_test()
    assert test["ok"] and test["model"] == "qwen2.5:7b"
    nothing = TeacherService(Settings(ai_provider="auto", data_dir=tmp_path, ollama_url="http://127.0.0.1:9", anthropic_api_key=None))
    assert nothing.status()["provider"] == "offline"


def test_parent_picks_a_brain_in_the_app_and_it_is_used_with_the_childs_memory(client, fake, monkeypatch):
    import app.teacher.service as svc

    monkeypatch.setattr(svc, "find_claude_cli", lambda *_: None)
    assert client.get("/api/teacher/brains").status_code == 401  # parents only
    register(client)
    found = client.get("/api/teacher/brains").json()
    assert {"claude_code", "ollama", "local_servers", "online", "current"} <= set(found)
    assert any(o["id"] == "openrouter" for o in found["online"])
    bad = client.put("/api/teacher/brain", json={"provider": "openai", "llm_base_url": "ftp://x", "llm_model": "m"})
    assert bad.status_code == 422
    ok = client.put("/api/teacher/brain", json={"provider": "openai", "llm_base_url": fake.url + "/v1", "llm_model": "local-model",
                                                "llm_api_key": "sk-secret"}).json()
    assert ok["ok"] and ok["provider"] == "openai" and ok["reply"] == "Hello friend, let's play!"
    again = client.get("/api/teacher/brains").json()
    assert again["saved"]["has_api_key"] and "sk-secret" not in json.dumps(again)  # the key is never sent back
    # saving again without a key keeps the saved key
    client.put("/api/teacher/brain", json={"provider": "openai", "llm_base_url": fake.url + "/v1", "llm_model": "local-model"})
    assert fake.requests[-1][2]["Authorization"] == "Bearer sk-secret"
    # a child with the AI brain allowed: the lesson plan prompt carries the child's memory, never the name
    cid = make_child(client, name="Zoya")["id"]
    client.patch(f"/api/children/{cid}", json={"cloud_ai_allowed": True})
    client.post(f"/api/children/{cid}/memory/notes", json={"note": "Zoya is shy about singing"})
    fake.requests.clear()
    client.post(f"/api/children/{cid}/sessions", json={})
    prompts = [r[1]["messages"][1]["content"] for r in fake.requests]
    plan = next(x for x in prompts if "Plan today's" in x)
    assert "learning memory" in plan and "{name} is shy about singing" in plan and "Zoya" not in plan
    # back to offline
    off = client.put("/api/teacher/brain", json={"provider": "offline"}).json()
    assert off["provider"] == "offline" and not off["ok"]


def test_slow_local_brain_never_makes_the_child_wait(client, fake, monkeypatch):
    """A local model that needs longer than a child should wait: the lesson starts with the offline plan,
    and the AI's focus is slotted in for the next activities when it arrives."""
    import time

    import app.teacher.service as svc
    from app.config import get_settings
    from app.db import session_factory
    from app.models import LessonSession

    monkeypatch.setattr(svc, "find_claude_cli", lambda *_: None)
    monkeypatch.setenv("KM_LLM_INTERACTIVE_TIMEOUT_SECONDS", "0.3")
    get_settings.cache_clear()
    register(client)
    client.put("/api/teacher/brain", json={"provider": "ollama", "ollama_url": fake.url, "ollama_model": "qwen2.5:7b"})
    cid = make_child(client, name="Kabir")["id"]
    client.patch(f"/api/children/{cid}", json={"cloud_ai_allowed": True})
    allowed = client.get(f"/api/children/{cid}").json()
    fake.mode, fake.focus = "slow", "rhythm"
    t0 = time.monotonic()
    start = client.post(f"/api/children/{cid}/sessions", json={}).json()
    assert time.monotonic() - t0 < 1.1 and start["plan"]["source"] == "offline"  # no waiting for the slow brain
    for _ in range(40):
        time.sleep(0.1)
        db = session_factory()()
        plan = db.get(LessonSession, start["session_id"]).plan
        db.close()
        if plan.get("source") == "ai-late":
            break
    assert plan["source"] == "ai-late" and plan["focus_skill"] == "rhythm" and allowed["id"] == cid
    get_settings.cache_clear()


def test_retail_edition_never_uses_or_offers_claude_code(client, fake, monkeypatch, tmp_path):
    """Families' installed copies: a personal Claude Code subscription is never the brain, even when installed."""
    import app.teacher.service as svc
    from app.config import get_settings

    monkeypatch.setattr(svc, "find_claude_cli", lambda *_: "C:/fake/claude.exe")
    retail = TeacherService(Settings(ai_provider="auto", edition="retail", data_dir=tmp_path, ollama_url=fake.url, anthropic_api_key=None))
    assert retail.status()["provider"] == "ollama" and retail.status()["claude_code_found"] is False
    forced = TeacherService(Settings(ai_provider="claude_code", edition="retail", data_dir=tmp_path, anthropic_api_key=None))
    assert forced.status()["provider"] == "offline"
    dev = TeacherService(Settings(ai_provider="auto", edition="dev", data_dir=tmp_path, anthropic_api_key=None))
    assert dev.status()["provider"] == "claude_code"
    # in the app: not offered, and choosing it is refused
    monkeypatch.setattr(get_settings(), "edition", "retail")
    register(client)
    assert client.get("/api/teacher/brains").json()["claude_code"] == {"found": False, "offered": False}
    assert client.put("/api/teacher/brain", json={"provider": "claude_code"}).status_code == 422
