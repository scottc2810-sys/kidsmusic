"""The teacher that listens: coaching on how a phrase was played, the learning path, specific feedback."""
from app import coach
from app.db import session_factory
from app.languages import LANGUAGES, note_name
from app.models import Attempt
from tests.conftest import make_child, register

TARGET = [60, 62, 64, 65, 67]


def ev(midis, gaps, conf=1.0):
    t, out = 0, []
    for m, g in zip(midis, [0, *gaps]):
        t += g
        out.append({"midi": m, "t": t, "conf": conf})
    return out


def test_alignment_ignores_warmup_and_octave():
    assert coach.align(TARGET, [48, 72, 74, 76, 77, 79]) == [1, 2, 3, 4, 5]
    assert coach.align(TARGET, [60, 62, 61, 65, 67]) == [0, 1, None, 3, 4]


def test_even_playing_is_praised_specifically():
    c = coach.observe(TARGET, [1] * 5, 80, ev(TARGET, [750, 760, 740, 750]), passed=True)
    assert c.tip.key == "steady" and c.drill is None and c.stats["evenness"] > 0.9


def test_one_long_stop_is_a_hesitation_with_spot_practice():
    c = coach.observe(TARGET, [1] * 5, 80, ev(TARGET, [700, 720, 2600, 710]), passed=True)
    assert c.tip.key == "hesitation" and c.tip.index == 3
    assert c.drill == {"start": 2, "end": 3}  # practise Ga -> Ma on its own


def test_wrong_note_gets_spot_practice_around_it():
    c = coach.observe(TARGET, [1] * 5, 80, ev([60, 62, 61, 65, 67], [700] * 4), passed=False)
    assert c.drill == {"start": 1, "end": 3}


def test_long_note_cut_short():
    c = coach.observe([60, 62, 64, 60], [1, 1, 2, 1], 80, ev([60, 62, 64, 60], [750, 750, 600]), passed=True)
    assert c.tip.key == "hold_long" and c.tip.index == 2 and c.tip.params == {"beats": 2}


def test_rushing_only_matters_when_playing_with_the_beat():
    fast = ev(TARGET, [300, 310, 290, 300])
    assert coach.observe(TARGET, [1] * 5, 80, fast, keep_beat=True).tip.key == "rushing"
    assert coach.observe(TARGET, [1] * 5, 80, fast, keep_beat=False).tip is None  # "wait for me": the child's own pace is fine


def test_quiet_instrument_and_camera_tips():
    quiet = ev(TARGET, [700, 900, 500, 1100], conf=0.62)
    assert coach.observe(TARGET, [1] * 5, 80, quiet, mic=True).tip.key in ("uneven", "louder")
    steadyish = ev(TARGET, [700, 900, 620, 800], conf=0.62)
    assert coach.observe(TARGET, [1] * 5, 80, steadyish, mic=True).tip.key == "louder"
    seen = {"frames": 60, "seen": 0.9, "flat": 0.8, "one_finger": 0.0}
    assert coach.observe(TARGET, [1] * 5, 80, steadyish, camera=seen).tip.key == "cam_curve"
    assert coach.observe(TARGET, [1] * 5, 80, steadyish, camera={**seen, "seen": 0.1}).tip.key == "cam_hands"
    assert coach.observe(TARGET, [1] * 5, 80, steadyish, camera={**seen, "frames": 3}).tip.key == "steady"  # too little video to judge the hands


def test_note_names_per_language():
    assert [note_name(64, c) for c in ("en", "hinglish", "hi", "es", "ar")] == ["E", "Ga", "ग", "Mi", "مي"]
    assert set(LANGUAGES) >= {"en", "hi", "hinglish", "es", "fr", "zh", "ar"}


def _notes(midis, gaps=None, source="screen"):
    gaps = gaps or [700] * (len(midis) - 1)
    return {"source": source, "notes": [{"midi": e["midi"], "t": e["t"]} for e in ev(midis, gaps)]}


def test_song_school_coaches_and_offers_spot_practice(client):
    register(client)
    child = make_child(client)
    start = client.post(f"/api/children/{child['id']}/songs/twinkle/start").json()
    sid, song = start["session_id"], start["song"]
    part = song["notes"][: song["phrases"][0]]
    # a wrong third note: Melo names the fix and gives the notes around it to practise
    wrong = list(part)
    wrong[2] = part[2] + 2
    miss = client.post(f"/api/sessions/{sid}/song-phrase", json={"phrase": 0, "response": _notes(wrong[:3])}).json()
    assert miss["outcome"] == "miss" and miss["drill"]["start"] == 1 and miss["drill"]["end"] == 3
    assert "Sa" in miss["drill"]["say"] or "Pa" in miss["drill"]["say"]
    # right notes with one long search before the 5th: passes, and Melo says where the child stopped
    ok = client.post(f"/api/sessions/{sid}/song-phrase", json={"phrase": 0, "response": _notes(part, [700, 700, 700, 2800, 700, 700])}).json()
    assert ok["passed"] and ok["tip"] == "hesitation" and "Dha" in ok["say"]
    # steady playing gets specific praise
    good = client.post(f"/api/sessions/{sid}/song-phrase", json={"phrase": 0, "response": _notes(part)}).json()
    assert good["tip"] == "steady" and good["drill"] is None and good["stats"]["matched"] == len(part)


def test_lesson_reteaches_after_a_miss_and_says_what_to_listen_for(client):
    register(client)
    child = make_child(client, session_minutes=20, language="en")
    sid = client.post(f"/api/children/{child['id']}/sessions", json={"topic": "high_low"}).json()["session_id"]
    first = client.post(f"/api/sessions/{sid}/next").json()
    db = session_factory()()
    answer = db.get(Attempt, first["attempt_id"]).spec["answer"]
    db.close()
    res = client.post(f"/api/sessions/{sid}/attempts/{first['attempt_id']}/answer", json={"response": {"choice": 1 - answer}}).json()
    assert res["outcome"] == "miss" and f"Sound {answer + 1} was the" in res["say"] and res["reveal"]["correct"] == answer
    again = client.post(f"/api/sessions/{sid}/next").json()
    assert again["retry"] is True and again["spec"]["notes"] == first["spec"]["notes"] and again["spec"]["retry"] is True


def test_ears_need_consent_and_parent_can_set_level(client):
    register(client)
    child = make_child(client)
    cid = child["id"]
    assert client.post(f"/api/children/{cid}/sessions", json={"ears": True}).json()["ears"] is False  # no consent: not listening
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    assert client.post(f"/api/children/{cid}/sessions", json={"ears": True}).json()["ears"] is True
    assert client.patch(f"/api/children/{cid}", json={"current_level": 3}).json()["current_level"] == 3
    assert client.patch(f"/api/children/{cid}", json={"current_level": 9}).status_code == 422
    assert client.patch(f"/api/children/{cid}", json={"language": "es"}).json()["language"] == "es"
    assert client.patch(f"/api/children/{cid}", json={"language": "klingon"}).status_code == 422


def test_learning_path_skips_what_the_child_already_knows(client):
    register(client)
    child = make_child(client, session_minutes=20)
    cid = child["id"]
    path = client.get(f"/api/children/{cid}/path").json()
    assert path["current"] == "high_low" and path["done"] == 0 and path["chapters"][0]["status"] == "current"
    assert path["chapters"][5]["target"] == "sargam"  # Hinglish learner: first tune is Sa Re Ga Ma
    # the parent says the child already plays: every level-1 chapter is done, the next is the first tune
    client.patch(f"/api/children/{cid}", json={"current_level": 2})
    path = client.get(f"/api/children/{cid}/path").json()
    assert path["current"] == "first_song" and all(c["status"] == "done" for c in path["chapters"][:5])
    # playing the whole tune finishes that chapter
    start = client.post(f"/api/children/{cid}/songs/sargam/start").json()
    client.post(f"/api/sessions/{start['session_id']}/song-phrase", json={"phrase": -1, "response": _notes(start["song"]["notes"])})
    path = client.get(f"/api/children/{cid}/path").json()
    assert path["chapters"][5]["status"] == "done" and path["current"] == "ears"
    other = make_child(client, name="Tom", language="en")
    assert client.get(f"/api/children/{other['id']}/path").json()["chapters"][5]["target"] == "hot_cross_buns"


def test_greeting_recalls_the_last_lesson(client):
    register(client)
    child = make_child(client, session_minutes=20, language="en")
    cid = child["id"]
    sid = client.post(f"/api/children/{cid}/sessions", json={"topic": "instruments"}).json()["session_id"]
    nxt = client.post(f"/api/sessions/{sid}/next").json()
    db = session_factory()()
    answer = db.get(Attempt, nxt["attempt_id"]).spec["answer"]
    db.close()
    client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer", json={"response": {"choice": answer}})
    client.post(f"/api/sessions/{sid}/end")
    greeting = client.post(f"/api/children/{cid}/sessions", json={}).json()["greeting"]
    assert "Last time you earned 1 stars" in greeting
