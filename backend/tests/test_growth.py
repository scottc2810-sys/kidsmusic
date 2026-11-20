"""Raising the bar: challenge packs of harder sentences once a child masters a language."""
import pytest

from app.db import session_factory
from app.lang import growth, native_audio as na
from app.lang.content import WORDS
from app.lang.phrases import PHRASE_WORDS
from app.models import Child, LangItemState, LangSkillState
from tests.conftest import make_child, register


def _master(cid, lang="es", difficulty=5):
    db = session_factory()()
    for s in ("listen", "read", "write", "speak"):
        db.add(LangSkillState(child_id=cid, lang=lang, skill=s, mastery=0.9, difficulty=difficulty, attempts=30, successes=27, streak=0, fail_streak=0))
    for item in list(WORDS[lang]) + list(PHRASE_WORDS[lang]):
        db.add(LangItemState(child_id=cid, lang=lang, item=item, strength=0.9, seen=5, correct=5))
    db.commit()
    db.close()


@pytest.fixture()
def tatoeba(monkeypatch):
    """Two real-looking Spanish sentences with recordings: one made only of words a child knows, one not."""
    known = "El gato es azul"  # 4 words, all in the Spanish word list (a level-1 pack takes 3-5 words)
    unknown = "La hipoteca vence mañana temprano"
    index = {"11": [("1", "Ana", "CC BY 4.0", "")], "22": [("2", "Leo", "CC BY 4.0", "")], "33": [("3", "Mia", "CC BY 4.0", "")]}
    monkeypatch.setattr(na, "_tatoeba_audio_index", lambda d: index)
    monkeypatch.setattr(na, "_http_json", lambda url, params, *a, **k: {"data": [{"id": 11, "text": known}, {"id": 22, "text": unknown}, {"id": 33, "text": "El perro es azul"}]})
    monkeypatch.setattr(na, "find_sentence", lambda iso3, text: [])
    monkeypatch.setattr(na, "_fetch", lambda url, *a, **k: b"ID3" + bytes(100))
    return known, unknown


def test_mastery_makes_a_pack_and_offline_only_accepts_known_words(client, tatoeba):
    known, unknown = tatoeba
    register(client)
    cid = make_child(client, language="en")["id"]
    db = session_factory()()
    child = db.get(Child, cid)
    assert growth.status(db, child, "es")["due"] is False  # nothing learned yet: no harder pack
    _master(cid)
    st = growth.status(db, child, "es")
    assert st["due"] and st["mastered_base"] and st["base_known"] == 1.0
    vocab = growth.known_words(db, child, "es")
    assert {"gato", "pequeño", "azul"} <= vocab
    out = growth.grow(db, child, "es")
    db.commit()
    # offline (no AI brain): the sentence with unknown words ("hipoteca": a mortgage) is never shown to a child
    assert out["made"] and out["sentences"] == 2 and out["from_tatoeba"] == 2 and out["with_native_voice"] == 2
    packs = growth.packs(cid, "es")
    if out["made"]:
        from app.lang.phrases import ITEMS

        texts = [ITEMS["es"][i].text for i in packs[0]["items"]]
        assert unknown not in texts and packs[0]["title"] == "⭐ Challenge 1"
    db.close()


def test_with_an_ai_brain_sentences_are_vetted_and_written_harder(client, tatoeba, monkeypatch):
    import app.teacher.service as svc

    known, unknown = tatoeba
    register(client)
    cid = make_child(client, language="en")["id"]
    _master(cid)
    calls = []

    def ask(self, ai, prompt, schema, *a, **k):
        calls.append(prompt)
        if "Choose up to" in prompt:  # vetting the Tatoeba sentences: the mortgage one is refused
            return {"ok": [{"sid": "11", "meaning": "The cat is small and blue", "roman": "", "emoji": "🐱"}]}
        return {"sentences": [{"text": f"Mi perro grande corre rápido {i}", "roman": "", "meaning": "My big dog runs fast", "emoji": "🐶"} for i in range(5)]}

    monkeypatch.setattr(svc.TeacherService, "_ai_for", lambda self, c: object())
    monkeypatch.setattr(svc.TeacherService, "_ask", ask)
    db = session_factory()()
    child = db.get(Child, cid)
    out = growth.grow(db, child, "es")
    db.commit()
    assert out["made"] and out["sentences"] == 6 and out["from_tatoeba"] == 1 and out["from_ai"] == 5 and out["with_native_voice"] == 1
    assert "suitable for a" in calls[0] and "challenge level 1" in calls[1]
    refs = na.references(db.get(Child, cid) and __import__("app.config", fromlist=["x"]).get_settings().data_dir, "es",
                         growth.packs(cid, "es")[0]["items"][0])
    assert refs and refs[0]["origin"] == "tatoeba"
    # the next pack is longer: level 2 asks for 4-6 words
    _master_pack = [i for i in growth.packs(cid, "es")[0]["items"]]
    for i in _master_pack:
        db.add(LangItemState(child_id=cid, lang="es", item=i, strength=0.9, seen=4, correct=4))
    db.commit()
    assert growth.status(db, child, "es")["due"]
    growth.grow(db, child, "es")
    db.commit()
    assert "4-6 words" in calls[-1] and [p["title"] for p in growth.packs(cid, "es")] == ["⭐ Challenge 1", "⭐ Challenge 2"]
    db.close()
    # once mastered, normal lessons mix in the newest pack
    topics = set()
    for _ in range(16):
        nxt = client.post(f"/api/children/{cid}/learn/es/next", json={}).json()
        db = session_factory()()
        from app.models import LangAttempt

        topics.add(db.get(LangAttempt, nxt["attempt_id"]).spec.get("item", "")[:1])
        db.close()
    assert "c" in topics  # challenge items (ids start with "c") come up without the child choosing them
    st = client.get(f"/api/children/{cid}/learn/es/growth").json()
    assert st["packs"] == 2 and st["list"][1]["title"] == "⭐ Challenge 2"
