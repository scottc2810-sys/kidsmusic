"""Maths / science progress (difficulty moves like a teacher would) and per-subject teacher personas."""
from tests.conftest import make_child, register


def test_class_follows_age_until_a_parent_sets_it(client):
    register(client)
    cid = make_child(client, age=7)["id"]
    p = client.get(f"/api/children/{cid}/prefs").json()
    assert p == {"grade": 2, "grade_auto": True, "teachers": {}}
    r = client.put(f"/api/children/{cid}/prefs", json={"grade": 4, "teachers": {"maths": {"persona": "professor_pi", "rate": 0.9, "pitch": 1.1}}})
    assert r.status_code == 200
    p = client.get(f"/api/children/{cid}/prefs").json()
    assert p["grade"] == 4 and not p["grade_auto"] and p["teachers"]["maths"]["persona"] == "professor_pi"
    assert client.put(f"/api/children/{cid}/prefs", json={"teachers": {"maths": {"persona": "dragon"}}}).status_code == 422
    assert client.put(f"/api/children/{cid}/prefs", json={"teachers": {"cooking": {"persona": "melo"}}}).status_code == 422


def test_difficulty_climbs_after_a_strong_round_and_eases_after_a_weak_one(client):
    register(client)
    cid = make_child(client)["id"]
    url = f"/api/children/{cid}/subjects/maths/addition/round"
    r = client.post(url, json={"correct": 5, "total": 5, "difficulty": 1}).json()
    assert r["difficulty"] == 2 and r["earned"] == 3 and r["level_change"] == 1
    r = client.post(url, json={"correct": 1, "total": 5, "difficulty": 2}).json()
    assert r["difficulty"] == 1 and r["level_change"] == -1
    prog = client.get(f"/api/children/{cid}/subjects/maths").json()
    assert prog["topics"]["addition"]["rounds"] == 2 and prog["topics"]["addition"]["correct"] == 6
    assert client.get(f"/api/children/{cid}/subjects/history").status_code == 404
    assert client.post(f"/api/children/{cid}/subjects/maths/../x/round", json={"correct": 1, "total": 1, "difficulty": 1}).status_code in (404, 405)
