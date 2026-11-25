"""Note Rain (falling-notes game) results, life-skills story rounds, and the prefs that must survive each other."""
from app import licence
from app.config import get_settings
from app.routers.songs import NoteRainIn, note_rain_accuracy, note_rain_stars

from tests.conftest import make_child, register


def _play(client, cid, **kw):
    body = {"song_id": "twinkle", "hits": 28, "total": 28, "wrong": 0, "mode": "play", "speed": "normal", **kw}
    return client.post(f"/api/children/{cid}/note-rain", json=body)


def test_stars_use_the_same_bands_as_every_round():
    assert [note_rain_stars(a) for a in (1, 0.9, 0.89, 0.7, 0.4, 0.39)] == [3, 3, 2, 2, 1, 0]
    # wait mode: every note is caught in the end, wrong keys on the way are what count
    assert note_rain_accuracy(NoteRainIn(song_id="x", hits=10, total=10, wrong=0, mode="wait", speed="turtle")) == 1
    assert note_rain_accuracy(NoteRainIn(song_id="x", hits=10, total=10, wrong=10, mode="wait", speed="turtle")) == 0.5
    # a child mashing keys cannot sink below the floor forever (capped at 4 wrong per note)
    assert note_rain_accuracy(NoteRainIn(song_id="x", hits=10, total=10, wrong=999, mode="wait", speed="turtle")) == 0.2
    assert note_rain_accuracy(NoteRainIn(song_id="x", hits=14, total=28, wrong=3, mode="play", speed="rocket")) == 0.5


def test_best_stars_are_kept_per_song_and_go_to_the_learning_graph(client):
    register(client)
    cid = make_child(client)["id"]
    r = _play(client, cid, hits=20).json()  # 20/28 = 71 %
    assert r == {"stars": 2, "best": 2, "accuracy": 0.714, "new_best": True}
    r = _play(client, cid, hits=5).json()
    assert r["stars"] == 0 and r["best"] == 2 and not r["new_best"]  # a weak game never lowers the best
    r = _play(client, cid, speed="rabbit").json()
    assert r["stars"] == 3 and r["new_best"]
    best = client.get(f"/api/children/{cid}/note-rain").json()["songs"]["twinkle"]
    assert best == {"stars": 3, "best_accuracy": 1.0, "plays": 3, "fastest": "rabbit"}
    events = client.get(f"/api/children/{cid}/memory").json()
    assert "Note Rain · Twinkle" in str(events)


def test_bad_results_are_refused(client):
    register(client)
    cid = make_child(client)["id"]
    assert _play(client, cid, song_id="no_such_song").status_code == 404
    assert _play(client, cid, mode="cheat").status_code == 422
    assert _play(client, cid, speed="warp").status_code == 422
    assert _play(client, cid, total=0).status_code == 422
    other = client.post("/api/auth/logout")
    assert other.status_code in (200, 204)
    assert _play(client, cid).status_code == 401


def test_free_plan_song_locks_apply_to_the_game(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "edition", "retail")
    register(client)
    cid = make_child(client)["id"]
    songs = client.get(f"/api/children/{cid}/songs").json()
    assert _play(client, cid, song_id=songs[0]["id"]).status_code == 200
    locked = next(s["id"] for s in songs[licence.FREE["songs"]:] if s["locked"])
    assert _play(client, cid, song_id=locked).status_code == 402


def test_saving_the_teachers_keeps_the_game_stars(client):
    register(client)
    cid = make_child(client)["id"]
    _play(client, cid)
    client.put(f"/api/children/{cid}/prefs", json={"grade": 2, "teachers": {"maths": {"persona": "professor_pi"}}})
    assert client.get(f"/api/children/{cid}/note-rain").json()["songs"]["twinkle"]["stars"] == 3
    assert client.get(f"/api/children/{cid}/prefs").json()["grade"] == 2


def test_catalog_has_tempo_and_tag_for_the_game(client):
    songs = client.get("/api/catalog").json()["songs"]
    assert songs["happy_birthday"]["bpm"] == 96 and songs["twinkle"]["bpm"] is None
    assert songs["gayatri_mantra"]["tag"] == "indian" and songs["twinkle"]["tag"] == "nursery"


def test_story_rounds_are_life_skills_evidence(client):
    """Stories record as Vedas & wisdom, strand "life": the choice is a real-life application question."""
    register(client)
    cid = make_child(client)["id"]
    r = client.post(f"/api/children/{cid}/subjects/vedas/story_red_truck/round",
                    json={"correct": 2, "total": 2, "difficulty": 1, "strand": "life", "apply_correct": 1, "apply_total": 1,
                          "title": "Story: Kabir's Red Truck (Sharing and taking turns)"})
    assert r.status_code == 200 and r.json()["earned"] == 3
    topics = client.get(f"/api/children/{cid}/subjects/vedas").json()["topics"]
    assert topics["story_red_truck"]["rounds"] == 1
