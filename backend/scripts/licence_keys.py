"""Owner's tool for Melo licence keys (never shipped). Keys are signed with a private key only the owner holds;
the app checks them with the matching public key in app/licence.py, offline.

    python scripts/licence_keys.py init                         # once: make the key pair (refuses to overwrite)
    python scripts/licence_keys.py issue --to "Asha's family"   # a family plan key, no end date
    python scripts/licence_keys.py issue --to "a@b.com" --days 365
    python scripts/licence_keys.py check MELO1-...              # what a key says, and whether it is valid

The private key lives in ~/.melo/licence_private.key (outside the project). BACK IT UP: without it no new keys
can be issued for apps already sold; anyone who has it can make keys.
"""
from __future__ import annotations

import argparse
import base64
import json
import secrets
import sys
from datetime import date, timedelta
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import licence  # noqa: E402

PRIVATE = Path.home() / ".melo" / "licence_private.key"


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def init() -> None:
    if PRIVATE.exists():
        sys.exit(f"{PRIVATE} already exists: not overwriting (keys already sold depend on it)")
    PRIVATE.parent.mkdir(parents=True, exist_ok=True)
    k = ed25519.Ed25519PrivateKey.generate()
    PRIVATE.write_bytes(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    pub = k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    print(f"private key: {PRIVATE}  (back it up somewhere safe)")
    print(f'put this in backend/app/licence.py:  PUBLIC_KEY = "{_b64(pub)}"')


def issue(to: str, days: int | None, plan: str = "family") -> str:
    k = serialization.load_pem_private_key(PRIVATE.read_bytes(), password=None)
    body = {"v": 1, "plan": plan, "id": secrets.token_hex(4), "to": to[:80], "issued": date.today().isoformat(),
            "exp": (date.today() + timedelta(days=days)).isoformat() if days else None}
    payload = json.dumps(body, separators=(",", ":"), sort_keys=True).encode()
    return f"MELO1-{_b64(payload)}.{_b64(k.sign(payload))}"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init")
    i = sub.add_parser("issue")
    i.add_argument("--to", required=True, help="who it is for (shown in the app)")
    i.add_argument("--days", type=int, default=None, help="valid for this many days (default: no end)")
    c = sub.add_parser("check")
    c.add_argument("key")
    a = ap.parse_args()
    if a.cmd == "init":
        init()
    elif a.cmd == "issue":
        key = issue(a.to, a.days)
        print(key)
        print(licence.verify(key))
    else:
        print(licence.verify(a.key))
