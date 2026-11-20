"""Native-speaker recordings: choosing female/male references, serving them safely, family recordings,
comparing the child's spoken word with them, and using that as a second opinion and a tracked parameter."""
import numpy as np
import pytest

from app.config import get_settings
from app.db import session_factory
from app.lang import native_audio as na
from app.models import LangAttempt
from tests.conftest import make_child, register

R = 16000


def word(formants, f0=150, dur=0.6, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(R * dur)) / R
    src = np.sign(np.sin(2 * np.pi * f0 * t)) + 0.05 * rng.standard_normal(len(t))
    out = np.zeros_like(t)
    seg = len(t) // len(formants)
    for k, (f1, f2) in enumerate(formants):
        s = slice(k * seg, (k + 1) * seg)
        out[s] = src[s] * (np.sin(2 * np.pi * f1 * t[s]) + 0.6 * np.sin(2 * np.pi * f2 * t[s]))
    return (out * 0.3).astype(np.float32)


SHAPES = {"p_hello": [(700, 1200), (300, 2300), (500, 900)], "p_bye": [(300, 800), (650, 1100), (400, 2000)],
          "p_thanks": [(450, 1700), (800, 1300), (350, 600)], "p_please": [(600, 2500), (350, 1000), (750, 1500)]}


@pytest.fixture()
def refs(client):
    """A tiny fake Lingua Libre download for Spanish: female + male recordings of four phrases."""
    d = get_settings().data_dir
    data = {"es": {}}
    (na.audio_dir(d) / "es").mkdir(parents=True, exist_ok=True)
    for item, shape in SHAPES.items():
        data["es"][item] = []
        for k, (g, f0) in enumerate((("female", 220), ("male", 110))):
            name = f"{item}-{k}-{g[0]}.wav"
            (na.audio_dir(d) / "es" / name).write_bytes(na.encode_wav(word(shape, f0, seed=k + 1)))
            data["es"][item].append({"file": f"es/{name}", "speaker": f"Speaker{k}", "gender": g, "license": "CC BY-SA 4.0",
                                     "source": "https://commons.wikimedia.org/wiki/File:x.wav", "text": "x"})
    na._save_manifest(d, data)
    yield d
    na._save_manifest(d, {}, merge=False)


def test_choose_mixes_female_and_male_and_distinct_speakers():
    recs = [{"speaker_id": "a", "gender": "male"}, {"speaker_id": "a", "gender": "male"}, {"speaker_id": "b", "gender": "male"},
            {"speaker_id": "c", "gender": "female"}, {"speaker_id": "d", "gender": "unknown"}]
    picked = na.choose(recs)
    assert [r["gender"] for r in picked][:2] == ["female", "male"] and len({r["speaker_id"] for r in picked}) == 3
    assert na.variants("¡Hola!")[:2] == ["¡Hola!", "Hola"] and "hello" in na.variants("Hello!")


def test_lessons_get_native_recordings_and_files_are_served_safely(client, refs):
    register(client)
    cid = make_child(client, language="en")["id"]
    nxt = client.post(f"/api/children/{cid}/learn/es/next", json={"topic": "greetings"}).json()
    item = __import__("app.db", fromlist=["x"]).session_factory()().get(LangAttempt, nxt["attempt_id"]).spec["item"]
    if item in SHAPES:
        assert {r["gender"] for r in nxt["native"]} == {"female", "male"} and nxt["native"][0]["license"]
    r = client.get("/api/learn/native/es/p_hello").json()
    assert len(r) == 2 and r[0]["url"].startswith("/api/learn/native-file/d/es/")
    f = client.get(r[0]["url"])
    assert f.status_code == 200 and f.headers["content-type"] == "audio/wav" and f.content[:4] == b"RIFF"
    assert client.get("/api/learn/native-file/d/es/..%2F..%2Fmelo.db").status_code == 404
    assert client.get("/api/learn/native-file/x/es/p_hello-0-f.wav").status_code == 404


def test_child_voice_is_compared_with_native_speakers(client, refs):
    register(client)
    cid = make_child(client, language="en")["id"]
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    db = session_factory()()
    # a speaking activity for p_hello
    nxt = client.post(f"/api/children/{cid}/learn/es/practice", json={"item": "p_hello", "skill": "speak"}).json()
    good = na.encode_wav(word(SHAPES["p_hello"], 300, 0.8, seed=9))  # a child's higher voice, a bit slower
    r = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/voice", files={"file": ("v.wav", good, "audio/wav")}).json()
    assert r["score"] >= 75 and r["references"] == 2
    # the speech recogniser heard nothing (common with small children): the native comparison is the second opinion
    ans = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"heard": []}}).json()
    assert ans["outcome"] == "success" and ans["reveal"]["pronunciation"] == r["score"] and ans["reveal"]["native"]
    stored = db.get(LangAttempt, nxt["attempt_id"])
    db.refresh(stored)
    assert stored.response["pronunciation"]["score"] == r["score"] and "voice" not in str(stored.response)  # the audio is not kept
    # a different word scores low and is not upgraded
    nxt2 = client.post(f"/api/children/{cid}/learn/es/practice", json={"item": "p_hello", "skill": "speak"}).json()
    bad = na.encode_wav(word(SHAPES["p_bye"], 300, 0.8, seed=9))
    r2 = client.post(f"/api/children/{cid}/learn/attempts/{nxt2['attempt_id']}/voice", files={"file": ("v.wav", bad, "audio/wav")}).json()
    assert r2["score"] < 50
    ans2 = client.post(f"/api/children/{cid}/learn/attempts/{nxt2['attempt_id']}/answer", json={"response": {"heard": []}}).json()
    assert ans2["outcome"] == "uncertain"
    db.close()


def test_voice_needs_microphone_consent_and_a_speaking_activity(client, refs):
    register(client)
    cid = make_child(client, language="en")["id"]
    nxt = client.post(f"/api/children/{cid}/learn/es/practice", json={"item": "p_hello", "skill": "listen"}).json()
    wav = na.encode_wav(word(SHAPES["p_hello"]))
    assert client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/voice", files={"file": ("v.wav", wav, "audio/wav")}).status_code == 403
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    assert client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/voice", files={"file": ("v.wav", wav, "audio/wav")}).status_code == 404


def test_family_member_records_a_missing_word(client, refs):
    register(client)
    cid = make_child(client, language="en")["id"]
    wav = na.encode_wav(np.concatenate([np.zeros(1600, np.float32), word(SHAPES["p_please"], 200), np.zeros(1600, np.float32)]))
    r = client.post(f"/api/children/{cid}/learn/sa/native/p_hello", files={"file": ("w.wav", wav, "audio/wav")},
                    data={"gender": "female", "speaker": "Nani"}).json()
    assert r["saved"] and r["refs"][0]["family"] and r["refs"][0]["speaker"] == "Nani"
    cov = client.get("/api/learn/native-coverage").json()["languages"]["sa"]
    assert cov["family"] == 1 and cov["items"] == 1 and all(m["item"] != "p_hello" for m in cov["missing"])
    bad = client.post(f"/api/children/{cid}/learn/sa/native/p_hello", files={"file": ("w.wav", b"not audio", "audio/wav")}, data={"gender": "female"})
    assert bad.status_code == 422
    assert client.post(f"/api/children/{cid}/learn/sa/native/p_hello", files={"file": ("w.wav", wav, "audio/wav")}, data={"gender": "x"}).status_code == 422


def test_pronunciation_is_a_tracked_parameter(client, refs):
    register(client)
    cid = make_child(client, language="en")["id"]
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    for i in range(4):
        nxt = client.post(f"/api/children/{cid}/learn/es/practice", json={"item": "p_hello", "skill": "speak"}).json()
        db = session_factory()()
        a = db.get(LangAttempt, nxt["attempt_id"])
        a.created_at = a.created_at.replace(microsecond=0) - __import__("datetime").timedelta(seconds=3)
        db.commit()
        db.close()
        client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/voice",
                    files={"file": ("v.wav", na.encode_wav(word(SHAPES["p_hello"], 280, 0.7, seed=i)), "audio/wav")})
        client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"heard": ["hola"]}})
    t = client.get(f"/api/children/{cid}/tracker").json()
    p = next(x for x in t["parameters"] if x["name"] == "Pronunciation compared with native speakers")
    assert p["score"] is not None and p["score"] >= 70 and p["n"] == 4


def test_sentences_come_from_tatoeba_exact_matches_kept_unmodified(client, monkeypatch):
    d = get_settings().data_dir
    mp3 = b"ID3\x03\x00" + bytes(200)
    index = {"373320": [("1", "CK", "CC BY-NC-ND 3.0", "http://x"), ("2", "Amy", "CC BY 4.0", ""), ("3", "CK", "CC BY 4.0", "")],
             "999": [("4", "Bob", "CC BY 4.0", ""), ("5", "Cy", "CC BY 4.0", "")]}
    monkeypatch.setattr(na, "_tatoeba_audio_index", lambda data_dir: index)
    monkeypatch.setattr(na, "_http_json", lambda url, params, *a, **k: {"data": [
        {"id": 373320, "text": "How are you?"}, {"id": 999, "text": "How are you?!"}, {"id": 5, "text": "How are you two?"}]}
        if params.get("q") == '"How are you?"' else {"data": []})
    fetched = []
    monkeypatch.setattr(na, "_fetch", lambda url, *a, **k: fetched.append(url) or mp3)
    na._save_manifest(d, {}, merge=False)
    stats = na.download_sentences(d, ["en"])
    refs = na.references(d, "en", "p_how")
    assert len(refs) == 3 and len({r["speaker"] for r in refs}) == 3  # different contributors, at most 3
    assert all(r["origin"] == "tatoeba" and r["file"].endswith(".mp3") for r in refs)
    assert refs[0]["noncommercial"] is True and refs[0]["license"] == "CC BY-NC-ND 3.0"
    assert (na.audio_dir(d) / refs[0]["file"]).read_bytes() == mp3  # stored byte for byte, as the licence asks
    assert "how-are-you-two" not in str(fetched) and stats["en"]["new_files"] == 3
    assert na.load_reference(d, refs[0]) is None  # MP3s are played, not decoded for comparison
    na._save_manifest(d, {}, merge=False)
