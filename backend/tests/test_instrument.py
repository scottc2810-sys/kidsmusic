"""The child's own instrument: ranges, reading product text, safe link fetching, photos and the API."""
from app import instrument as ins
from tests.conftest import make_child, register

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


def test_range_keeps_middle_c_near_the_middle():
    r = ins.note_range("toy_keyboard", 37, "F")
    assert r["high"] - r["low"] == 36 and r["low"] % 12 == 5 and r["low"] <= 60 <= r["high"]
    r = ins.note_range("keyboard", 61, "C")
    assert (r["low"], r["high"]) == (36, 96)
    bars = ins.note_range("xylophone", 8, "C")
    assert bars["notes"] == [60, 62, 64, 65, 67, 69, 71, 72] and bars["diatonic"]


def test_heuristics_read_a_kids_keyboard_listing():
    g = ins.heuristics("VEBETO Electronic 37 Keys Piano for Kids with Microphone, Recording, 8 demo songs, numbered keys, beginners")
    assert g["kind"] == "toy_keyboard" and g["keys"] == 37 and g["mic"] and g["record"] and g["labels"] == "numbers"
    assert ins.heuristics("Wooden rainbow xylophone, 8 bars")["kind"] == "xylophone"


def test_links_to_this_computer_or_home_network_are_never_fetched():
    for url in ("http://127.0.0.1:8000/api/children", "http://localhost/", "http://192.168.1.1/", "file:///etc/passwd", "http://[::1]/"):
        r = ins.fetch_page(url)
        assert not r["found"] and r["reason"]


def test_profile_photos_and_analysis(client, monkeypatch):
    register(client)
    kid = make_child(client)
    cid = kid["id"]
    assert client.get(f"/api/children/{cid}/instrument").json() == {"set": False, "kind": "keyboard", "default": True}
    body = {"kind": "toy_keyboard", "name": "blue keyboard", "keys": 37, "first_key": "F", "labels": "numbers",
            "features": {"mic": True, "junk": 1}, "sources": ["https://shop.example/kids-piano"],
            "notes": "37 keys kids piano with microphone and recording", "summary": "your blue keyboard", "tips": []}
    r = client.put(f"/api/children/{cid}/instrument", json=body)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["set"] and p["keys"] == 37 and p["low"] % 12 == 5 and p["features"] == {"mic": True}
    assert client.get(f"/api/children/{cid}").json()["instrument"] == "toy_keyboard"
    # photos: only real images, served back to the owner
    bad = client.post(f"/api/children/{cid}/instrument/photos", files={"file": ("x.png", b"not an image", "image/png")})
    assert bad.status_code == 415
    ok = client.post(f"/api/children/{cid}/instrument/photos", files={"file": ("k.png", PNG, "image/png")})
    assert ok.status_code == 201 and len(ok.json()["photos"]) == 1
    photo = ok.json()["photos"][0]["url"]
    assert client.get(photo).content == PNG
    # analysis with the shop page blocked: text rules still read the parent's notes
    monkeypatch.setattr(ins, "fetch_page", lambda url, **k: {"url": url, "found": False, "title": "", "text": "", "reason": "The shop answered 503"})
    a = client.post(f"/api/children/{cid}/instrument/analyze").json()
    assert a["suggestion"]["keys"] == 37 and a["suggestion"]["mic"] and a["suggestion"]["record"]
    assert a["sources"][0]["found"] is False and not a["used_ai"]
    # back to the standard lessons
    assert client.delete(f"/api/children/{cid}/instrument").status_code == 204
    assert client.get(f"/api/children/{cid}/instrument").json()["set"] is False
    assert client.get(photo).status_code == 404


def test_another_parent_cannot_see_the_instrument(client):
    register(client)
    cid = make_child(client)["id"]
    client.put(f"/api/children/{cid}/instrument", json={"kind": "xylophone", "keys": 8})
    client.post("/api/auth/logout")
    register(client, email="other@example.com")
    assert client.get(f"/api/children/{cid}/instrument").status_code == 404


def test_unknown_kind_is_rejected(client):
    register(client)
    cid = make_child(client)["id"]
    assert client.put(f"/api/children/{cid}/instrument", json={"kind": "spaceship"}).status_code == 422
