import os

from app.audio.analysis import synth_wav
from app.curriculum import SONGS
from app.db import session_factory
from app.models import Attempt

from .conftest import make_child, register


def test_auth_flow_and_csrf(client):
    register(client)
    assert client.get("/api/auth/me").status_code == 200
    # state-changing call without the CSRF header is refused
    r = client.post("/api/children", json={"name": "A", "age": 4}, headers={"X-Requested-With": ""})
    assert r.status_code == 403
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "parent@example.com", "password": "nope-nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "PARENT@example.com", "password": "correct-horse-1"}).status_code == 200


def test_duplicate_email_and_weak_password(client):
    register(client)
    assert client.post("/api/auth/register", json={"email": "parent@example.com", "password": "another-pass"}).status_code == 409
    assert client.post("/api/auth/register", json={"email": "x@y.io", "password": "short"}).status_code == 422


def test_login_rate_limited(client):
    register(client)
    codes = [client.post("/api/auth/login", json={"email": "parent@example.com", "password": "bad-pass"}).status_code for _ in range(12)]
    assert 429 in codes


def test_children_are_isolated_between_parents(client):
    register(client, "a@example.com")
    child = make_child(client)
    client.post("/api/auth/logout")
    register(client, "b@example.com")
    assert client.get(f"/api/children/{child['id']}").status_code == 404
    assert client.get(f"/api/children/{child['id']}/progress").status_code == 404
    assert client.post(f"/api/children/{child['id']}/sessions", json={}).status_code == 404
    assert client.get("/api/children").json() == []


def test_real_mode_requires_microphone_consent(client):
    register(client)
    child = make_child(client)
    assert client.patch(f"/api/children/{child['id']}", json={"mode": "real"}).status_code == 400
    assert client.post(f"/api/children/{child['id']}/sessions", json={"mode": "real"}).status_code == 403
    client.put(f"/api/children/{child['id']}/consent", json={"microphone": True})
    assert client.post(f"/api/children/{child['id']}/sessions", json={"mode": "real"}).status_code == 201
    hist = client.get(f"/api/children/{child['id']}/consent-history").json()
    assert any(h["kind"] == "microphone" and h["granted"] for h in hist)


def _perfect_response(attempt_id):
    db = session_factory()()
    a = db.get(Attempt, attempt_id)
    spec, t = a.spec, a.activity_type
    db.close()
    if "answer" in spec:
        return {"choice": spec["answer"]}
    if t == "rhythm_tap":
        beat = 60000 / spec["bpm"]
        return {"taps": [p * beat for p in spec["pattern"]]}
    if t == "find_note":
        return {"source": "screen", "notes": [{"midi": spec["target"], "t": 0}]}
    if t in ("echo_melody", "play_song"):
        return {"source": "screen", "notes": [{"midi": m, "t": i * 300} for i, m in enumerate(spec["notes"])]}
    return {"source": "screen", "notes": [{"midi": m, "t": i * 300} for i, m in enumerate([60, 62, 64, 67])]}


def test_full_lesson_loop_adapts_and_tracks_progress(client):
    register(client)
    child = make_child(client, session_minutes=20)
    start = client.post(f"/api/children/{child['id']}/sessions", json={}).json()
    assert "Melo" in start["greeting"] and "Asha" in start["greeting"] and "{name}" not in start["greeting"]
    sid = start["session_id"]
    saw_harder = False
    for _ in range(14):
        nxt = client.post(f"/api/sessions/{sid}/next").json()
        assert nxt["done"] is False and "answer" not in nxt["spec"]
        res = client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer", json={"response": _perfect_response(nxt["attempt_id"])}).json()
        assert res["outcome"] == "success", res
        saw_harder |= "harder" in res["events"]
    assert saw_harder
    # answering twice is rejected
    assert client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer", json={"response": {"choice": 0}}).status_code == 409
    end = client.post(f"/api/sessions/{sid}/signal", json={"signal": "tired"}).json()
    assert end["done"] and end["stars"] >= 14
    prog = client.get(f"/api/children/{child['id']}/progress").json()
    assert prog["sessions"][0]["end_reason"] == "tired"
    assert any(v["mastery"] > 0.5 for v in prog["skills"].values())


def test_signal_frustrated_gives_easier_path(client):
    register(client)
    child = make_child(client)
    sid = client.post(f"/api/children/{child['id']}/sessions", json={}).json()["session_id"]
    r = client.post(f"/api/sessions/{sid}/signal", json={"signal": "frustrated"}).json()
    assert r["done"] is False and r["say"]


def test_recording_requires_consent_then_analyses_and_deletes(client):
    register(client)
    child = make_child(client)
    wav = synth_wav([tuple(n) for n in SONGS["twinkle"]["notes"]], bpm=100)
    files = {"file": ("take.wav", wav, "audio/wav")}
    assert client.post(f"/api/children/{child['id']}/recordings", files=files).status_code == 403
    client.put(f"/api/children/{child['id']}/consent", json={"recording": True})
    r = client.post(f"/api/children/{child['id']}/recordings", files=files, data={"title": "Twinkle try"})
    assert r.status_code == 202, r.text
    rid = r.json()["id"]
    rec = client.get(f"/api/children/{child['id']}/recordings/{rid}").json()  # background task ran
    assert rec["status"] == "analyzed"
    assert rec["analysis"]["song_match"]["song_id"] == "twinkle"
    assert "Asha" in rec["feedback"]["child_message"] and rec["feedback"]["lesson_steps"]
    audio = client.get(f"/api/children/{child['id']}/recordings/{rid}/audio")
    assert audio.status_code == 200 and audio.content == wav
    # stored encrypted on disk
    from app.config import get_settings

    stored = list(get_settings().recordings_dir.glob("*.bin"))
    assert stored and all(not p.read_bytes().startswith(b"RIFF") for p in stored)
    assert client.delete(f"/api/children/{child['id']}/recordings/{rid}").status_code == 204
    assert client.get(f"/api/children/{child['id']}/recordings/{rid}").status_code == 404


def test_rejects_bad_uploads(client):
    register(client)
    child = make_child(client, consent_recording=True)
    r = client.post(f"/api/children/{child['id']}/recordings", files={"file": ("x.mp3", b"ID3notawav", "audio/mpeg")})
    assert r.status_code == 415


def test_delete_child_removes_everything(client):
    register(client)
    child = make_child(client, consent_recording=True)
    wav = synth_wav([(60, 1), (62, 1), (64, 1), (65, 1), (67, 2)], bpm=100)
    client.post(f"/api/children/{child['id']}/recordings", files={"file": ("t.wav", wav, "audio/wav")})
    from app.config import get_settings

    before = len(list(get_settings().recordings_dir.glob("*.bin")))
    assert client.delete(f"/api/children/{child['id']}").status_code == 204
    after = len(list(get_settings().recordings_dir.glob("*.bin")))
    assert after == before - 1
    assert client.get(f"/api/children/{child['id']}").status_code == 404


def test_chat_offline_is_safe_and_on_topic(client):
    register(client)
    child = make_child(client, language="hi")
    r = client.post(f"/api/children/{child['id']}/chat", json={"message": "मैं थक गया"}).json()
    assert r["wants_rest"] is True and r["reply"]


def test_security_headers_and_health(client):
    r = client.get("/api/health")
    assert r.json()["status"] == "ok"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert client.get("/api/does-not-exist").status_code == 404


def test_secret_files_created_with_private_permissions(client):
    from app.config import get_settings

    p = get_settings().data_dir / ".secret_key"
    assert p.exists()
    if os.name == "posix":
        assert (p.stat().st_mode & 0o077) == 0


def test_teacher_test_endpoint_needs_login_and_reports_offline(client):
    assert client.post("/api/teacher/test").status_code == 401
    register(client, "brain@example.com")
    r = client.post("/api/teacher/test")
    assert r.status_code == 200 and r.json()["ok"] is False and r.json()["provider"] == "offline"


def test_song_school_learn_phrase_by_phrase(client):
    register(client, "songs@example.com")
    cid = client.post("/api/children", json={"name": "Asha", "age": 5}).json()["id"]
    songs = client.get(f"/api/children/{cid}/songs").json()
    ids = [s["id"] for s in songs]
    assert ids[0] == "happy_birthday" and "gayatri_mantra" in ids
    st = client.post(f"/api/children/{cid}/songs/happy_birthday/start")
    assert st.status_code == 201
    body = st.json()
    assert body["start_phrase"] == 0 and "Asha" in body["song"]["words"]  # name filled locally
    assert "Happy Birthday" in body["say"] and "Asha" in body["say"] and "{" not in body["say"]
    sid, song = body["session_id"], body["song"]

    def play(phrase, notes):
        return client.post(f"/api/sessions/{sid}/song-phrase", json={
            "phrase": phrase, "response": {"source": "screen", "notes": [{"midi": m, "t": i * 400} for i, m in enumerate(notes)]}}).json()

    first = song["notes"][:song["phrases"][0]]
    miss = play(0, [48, 50])
    assert miss["outcome"] == "miss" and miss["passed"] is False and miss["hint_index"] == 0
    assert " G" in miss["say"] and " C" in miss["say"] and "right" in miss["say"]  # specific: played C, needed G (to the right)
    ok = play(0, first)
    assert ok["outcome"] == "success" and ok["passed"] and ok["stars_earned"] == 1
    whole = play(-1, song["notes"])
    assert whole["outcome"] == "success" and "Happy Birthday" in whole["say"]
    prog = {s["id"]: s["progress"] for s in client.get(f"/api/children/{cid}/songs").json()}["happy_birthday"]
    assert prog["completed"] and prog["phrases_learned"] == [0, 1, 2, 3]
    # feeds progress + memory like any lesson
    assert client.get(f"/api/children/{cid}/progress").json()["skills"]["melody"]["attempts"] == 3
    labels = [n["label"] for n in client.get(f"/api/children/{cid}/memory/graph").json()["nodes"]]
    assert "Happy Birthday" in labels
    assert client.post(f"/api/sessions/{sid}/end").status_code == 200


def test_song_school_rejects_unknown_song_and_lesson_sessions(client):
    register(client, "songs2@example.com")
    cid = client.post("/api/children", json={"name": "Ravi", "age": 6}).json()["id"]
    assert client.post(f"/api/children/{cid}/songs/nope/start").status_code == 404
    lesson = client.post(f"/api/children/{cid}/sessions", json={}).json()["session_id"]
    r = client.post(f"/api/sessions/{lesson}/song-phrase", json={"phrase": 0, "response": {}})
    assert r.status_code == 409


def test_song_school_sargam_hints_and_welcome_back(client):
    register(client, "sargam@example.com")
    cid = client.post("/api/children", json={"name": "Meera", "age": 5, "language": "hinglish"}).json()["id"]
    body = client.post(f"/api/children/{cid}/songs/sargam/start").json()
    sid, song = body["session_id"], body["song"]
    note = lambda ms: {"source": "screen", "notes": [{"midi": m, "t": i * 400} for i, m in enumerate(ms)]}
    r = client.post(f"/api/sessions/{sid}/song-phrase", json={"phrase": 0, "response": note([60, 64, 64, 65])}).json()
    assert r["outcome"] in ("miss", "partial")
    if r["outcome"] == "miss":
        assert "Re" in r["say"] and "Ga" in r["say"]  # sargam names: played Ga where Re belongs
    ok = client.post(f"/api/sessions/{sid}/song-phrase", json={"phrase": 0, "response": note(song["notes"][:4])}).json()
    assert ok["passed"]
    client.post(f"/api/sessions/{sid}/end")
    again = client.post(f"/api/children/{cid}/songs/sargam/start").json()
    assert again["start_phrase"] == 1 and "1" in again["say"] and "Meera" in again["say"]


def test_note_names():
    from app.routers.songs import note_name
    assert note_name(60, "en") == "C" and note_name(62, "hinglish") == "Re" and note_name(67, "hi") == "प"


def test_support_level_rules():
    from app.routers.songs import support_for
    assert support_for({}, 0) == "full"  # brand new part: full explanation and help
    assert support_for({"0": {"passes": 1, "last": "success"}}, 0) == "guided"
    assert support_for({"0": {"passes": 3, "last": "success"}}, 0) == "light"
    assert support_for({"0": {"passes": 3, "last": "miss"}}, 0) == "guided"  # forgot it: help comes back
    assert support_for({}, -1) == "guided"
    assert support_for({"-1": {"passes": 2, "last": "success"}}, -1) == "memory"
    assert support_for({"-1": {"passes": 2, "last": "success"}, "1": {"passes": 2, "last": "success"}}, 1) == "memory"


def test_song_school_help_fades_and_returns(client):
    register(client, "fade@example.com")
    cid = client.post("/api/children", json={"name": "Asha", "age": 6}).json()["id"]
    body = client.post(f"/api/children/{cid}/songs/gayatri_mantra/start").json()
    sid, song = body["session_id"], body["song"]
    assert body["support"]["0"] == "full"
    first = song["notes"][:song["phrases"][0]]
    play = lambda ph, ms: client.post(f"/api/sessions/{sid}/song-phrase", json={
        "phrase": ph, "response": {"source": "screen", "notes": [{"midi": m, "t": i * 400} for i, m in enumerate(ms)]}}).json()
    assert play(0, first)["support"]["0"] == "guided"
    assert play(0, first)["support"]["0"] == "light"
    assert play(0, [48, 49, 50])["support"]["0"] == "guided"  # a miss brings the glowing keys back
    for _ in range(2):
        r = play(-1, song["notes"])
    assert r["support"]["-1"] == "memory"
    client.post(f"/api/sessions/{sid}/end")
    again = client.post(f"/api/children/{cid}/songs/gayatri_mantra/start").json()
    assert again["start_phrase"] == -1 and again["support"]["-1"] == "memory"  # knows it: play it all from memory


def test_music_basics_topic_practice(client):
    register(client, "basics@example.com")
    cid = client.post("/api/children", json={"name": "Asha", "age": 5}).json()["id"]
    for topic, types in (("rhythm", {"rhythm_tap"}), ("swars", {"find_note", "echo_melody"}), ("fast_slow", {"fast_slow"})):
        st = client.post(f"/api/children/{cid}/sessions", json={"topic": topic}).json()
        assert st["plan"]["topic"] == topic and "Asha" in st["greeting"] and "{" not in st["greeting"]
        seen = set()
        for _ in range(4):
            n = client.post(f"/api/sessions/{st['session_id']}/next").json()
            seen.add(n["type"])
            ans = {"choice": 0} if n["type"] == "fast_slow" else {"timed_out": True}
            client.post(f"/api/sessions/{st['session_id']}/attempts/{n['attempt_id']}/answer", json={"response": ans})
        assert seen <= types, (topic, seen)
        client.post(f"/api/sessions/{st['session_id']}/end")
    assert client.post(f"/api/children/{cid}/sessions", json={"topic": "nope"}).status_code == 422


def test_fast_slow_is_basics_only_and_scored():
    import random
    from app.curriculum import ACTIVITIES, level_activities
    from app.scoring import score_attempt
    assert all(a.type != "fast_slow" for lv in (1, 2, 3, 4) for a in level_activities(lv, "screen"))
    spec = ACTIVITIES["fast_slow"].generate(1, random.Random(3))
    assert spec["bpms"][spec["answer"]] == (max(spec["bpms"]) if spec["question"] == "faster" else min(spec["bpms"]))
    assert score_attempt("fast_slow", spec, {"choice": spec["answer"]}).outcome == "success"
    assert score_attempt("fast_slow", spec, {"choice": 1 - spec["answer"]}).outcome == "miss"


def test_alankars_in_song_school_not_in_lessons(client):
    from app.curriculum import SONGS, gen_play_song
    import random
    assert all(gen_play_song(5, random.Random(i))["song_id"] not in ("aaroh_avroh", "alankar_1", "alankar_2") for i in range(40))
    register(client, "alankar@example.com")
    cid = client.post("/api/children", json={"name": "Ravi", "age": 7, "language": "hi"}).json()["id"]
    tags = {s["id"]: s["tag"] for s in client.get(f"/api/children/{cid}/songs").json()}
    assert tags["aaroh_avroh"] == "alankar"
    song = client.post(f"/api/children/{cid}/songs/alankar_1/start").json()["song"]
    assert song["words"][:3] == ["सा", "रे", "ग"] and SONGS["alankar_1"]["phrases"][-1] == len(song["notes"])
