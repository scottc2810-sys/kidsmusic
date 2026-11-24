"""Sign-up needs a parent or guardian who accepts the privacy policy and terms; the accepted versions are kept."""
from sqlalchemy import select

from app.db import session_factory
from app.legal import PRIVACY_VERSION, TERMS_VERSION
from app.models import Agreement


def test_sign_up_needs_the_parents_agreement_and_records_it(client):
    body = {"email": "mum@example.com", "password": "correct-horse-1"}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 422 and "parent or guardian" in r.text
    assert client.post("/api/auth/register", json={**body, "agree": False}).status_code == 422
    r = client.post("/api/auth/register", json={**body, "agree": True})
    assert r.status_code == 201
    with session_factory()() as db:
        got = {(a.document, a.version) for a in db.scalars(select(Agreement).where(Agreement.parent_id == r.json()["id"]))}
    assert got == {("privacy", PRIVACY_VERSION), ("terms", TERMS_VERSION)}
    # deleting the account deletes the record too
    assert client.delete("/api/auth/account").status_code == 204
    with session_factory()() as db:
        assert db.scalars(select(Agreement)).all() == []


def test_app_and_server_show_the_same_policy_versions():
    """The page parents read (Legal.tsx) and the version recorded at sign-up (legal.py) must match."""
    from pathlib import Path

    page = (Path(__file__).parents[2] / "frontend" / "src" / "pages" / "Legal.tsx").read_text(encoding="utf-8")
    assert f'PRIVACY_VERSION = "{PRIVACY_VERSION}"' in page and f'TERMS_VERSION = "{TERMS_VERSION}"' in page
