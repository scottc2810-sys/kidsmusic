"""Free plan and family plan: owner-signed keys checked offline; limits only in families' copies (retail)."""
import base64
import json
from datetime import date

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from app import licence
from app.config import get_settings

from .conftest import make_child, register


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


@pytest.fixture()
def signer(monkeypatch):
    """A throwaway key pair standing in for the owner's (never the real private key)."""
    k = ed25519.Ed25519PrivateKey.generate()
    pub = k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    monkeypatch.setattr(licence, "PUBLIC_KEY", _b64(pub))

    def make(exp=None, plan="family", key=k):
        payload = json.dumps({"v": 1, "plan": plan, "id": "ab12cd34", "to": "Test family", "issued": "2026-11-24", "exp": exp},
                             separators=(",", ":"), sort_keys=True).encode()
        return f"MELO1-{_b64(payload)}.{_b64(key.sign(payload))}"
    return make


def test_only_genuine_unexpired_keys_pass(signer):
    good = signer()
    assert licence.verify(good) == {"plan": "family", "id": "ab12cd34", "to": "Test family", "expires": None}
    assert licence.verify(signer(exp="2027-01-01"), today=date(2026, 12, 31))["expires"] == "2027-01-01"
    assert licence.verify(signer(exp="2026-01-01")) is None  # expired
    assert licence.verify(signer(key=ed25519.Ed25519PrivateKey.generate())) is None  # someone else's key
    head, sig = good.split(".")
    forged = json.loads(base64.urlsafe_b64decode(head[6:] + "==")) | {"to": "Free for all"}
    assert licence.verify("MELO1-" + _b64(json.dumps(forged).encode()) + "." + sig) is None  # edited payload
    assert licence.verify(signer(plan="school")) is None and licence.verify("") is None and licence.verify("MELO1-x.y") is None


def test_free_plan_limits_in_families_copies_and_a_key_lifts_them(client, signer, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "edition", "retail")
    register(client)
    assert client.get("/api/licence").json()["plan"] == "free"
    cid = make_child(client)["id"]
    # one child on the free plan
    assert client.post("/api/children", json={"name": "Ravi", "age": 6, "language": "en"}).status_code == 402
    # the first songs are open, later ones locked
    songs = client.get(f"/api/children/{cid}/songs").json()
    assert [x["locked"] for x in songs[:licence.FREE["songs"]]] == [False] * licence.FREE["songs"] and songs[-1]["locked"]
    assert client.post(f"/api/children/{cid}/songs/{songs[0]['id']}/start").status_code == 201
    r = client.post(f"/api/children/{cid}/songs/{songs[-1]['id']}/start")
    assert r.status_code == 402 and "Family plan" in r.text
    # one language: the first started stays open, a second is locked
    assert client.post(f"/api/children/{cid}/learn/es/next", json={}).status_code == 201
    assert client.post(f"/api/children/{cid}/learn/es/next", json={}).status_code == 201
    assert client.post(f"/api/children/{cid}/learn/fr/next", json={}).status_code == 402
    # a bad key is refused; a genuine one unlocks everything, and can be removed
    assert client.put("/api/licence", json={"key": "MELO1-not.a-real-key"}).status_code == 422
    st = client.put("/api/licence", json={"key": signer()}).json()
    assert st["plan"] == "family" and st["licence"]["to"] == "Test family"
    assert client.post(f"/api/children/{cid}/learn/fr/next", json={}).status_code == 201
    assert not any(x["locked"] for x in client.get(f"/api/children/{cid}/songs").json())
    assert client.post("/api/children", json={"name": "Ravi", "age": 6, "language": "en"}).status_code == 201
    assert client.delete("/api/licence").json()["plan"] == "free"


def test_owner_copy_has_everything(client):
    register(client)
    st = client.get("/api/licence").json()
    assert st["plan"] == "family" and st["edition"] == "dev" and all(v is None for v in st["limits"].values())
