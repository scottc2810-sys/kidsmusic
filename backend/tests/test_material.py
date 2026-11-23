"""Language personalisation: lessons from the family's own material, and the reason behind every answer."""
import pytest

from app.routers.learn import why_line
from app.teacher.service import get_teacher
from tests.conftest import make_child, register

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


@pytest.fixture()
def brain(monkeypatch):
    t = get_teacher()
    seen = {}

    def look(child, prompt, schema, images, n=2000):
        seen["images"] = len(images)
        return {"title": "School words", "emoji": "🏫", "phrases": ["good morning", "my bag", "thank you teacher"]}

    def translate(ai, prompt, schema, n=2000, interactive=False):
        rows = [("Good morning", "Bonjour", "🌞"), ("My bag", "Mon sac", "🎒"), ("Thank you, teacher", "Merci, maîtresse", "🙏")]
        return {"phrases": [{"english": e, "emoji": m, "texts": {"en": e, "fr": f}} for e, f, m in rows]}

    monkeypatch.setattr(t, "uses_ai", lambda c: True)
    monkeypatch.setattr(t, "_ai_for", lambda c: object())
    monkeypatch.setattr(t, "ask_with_images", look)
    monkeypatch.setattr(t, "_ask", translate)
    return seen


def test_material_becomes_a_personal_topic(client, brain):
    register(client)
    cid = make_child(client)["id"]
    r = client.post(f"/api/children/{cid}/learn/material", data={"langs": "fr", "notes": "words from school"},
                    files=[("files", ("page.png", PNG, "image/png"))])
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["title"] == "School words" and len(out["phrases"]) == 3 and brain["images"] == 1
    topic = out["link"].split("topic=")[1]
    status = client.get(f"/api/children/{cid}/learn/fr").json()
    assert any(t["id"] == topic for t in status["topics"])


def test_material_needs_the_ai_brain_and_real_images(client, monkeypatch):
    register(client)
    cid = make_child(client)["id"]
    r = client.post(f"/api/children/{cid}/learn/material", data={"langs": "fr", "notes": "hello"})
    assert r.status_code == 409
    monkeypatch.setattr(get_teacher(), "uses_ai", lambda c: True)
    r = client.post(f"/api/children/{cid}/learn/material", data={"langs": "fr"}, files=[("files", ("x.png", b"nope", "image/png"))])
    assert r.status_code == 415


def test_why_line_gives_meaning_and_reason():
    assert why_line("fr", "en", {}, "cat") == "“chat” means “cat” 🐱."
    assert "kutta" in why_line("es", "hinglish", {}, "dog")
    assert why_line("en", "en", {}, "cat") is None  # same language: nothing to translate
    reply = why_line("fr", "en", {"question_item": "p_how"}, "p_fine")
    assert reply and reply.startswith("When someone asks")
