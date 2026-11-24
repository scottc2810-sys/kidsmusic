"""Free plan and family plan. A family plan key is signed by the owner (scripts/licence_keys.py) and checked here
with the public key, offline: no account or server needed. Only families' copies (edition "retail") are limited;
the owner's copy and source runs (edition "dev") have everything.

To change what the free plan includes, edit FREE: the app reads it from /api/licence.
"""
from __future__ import annotations

import base64
import json
from datetime import date
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ed25519

PUBLIC_KEY = "4ZVG4O34KwGqm7eUBRtwoBxYyquYVL5ElbBvjHqho1o"  # made by `python scripts/licence_keys.py init` (base64url of the raw Ed25519 public key)

# What the free plan includes. None = no limit (the family plan).
FREE = {
    "children": 1,           # child profiles
    "songs": 5,              # the first songs in Song school (music basics are all free)
    "languages": 1,          # languages a child can study (the first one they start)
    "topics_per_strand": 2,  # in maths, science, money and Vedas: the first topics of every strand
}
FAMILY = {k: None for k in FREE}


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify(key: str, today: date | None = None, public_key: str | None = None) -> dict | None:
    """The key's details when it is genuine and not expired, else None."""
    pub = public_key if public_key is not None else PUBLIC_KEY
    key = (key or "").strip()
    if not pub or not key.startswith("MELO1-") or key.count(".") != 1 or len(key) > 1000:
        return None
    try:
        payload_b64, sig_b64 = key[len("MELO1-"):].split(".")
        payload = _unb64(payload_b64)
        ed25519.Ed25519PublicKey.from_public_bytes(_unb64(pub)).verify(_unb64(sig_b64), payload)
        body = json.loads(payload)
    except (ValueError, InvalidSignature, json.JSONDecodeError):
        return None
    if not isinstance(body, dict) or body.get("v") != 1 or body.get("plan") != "family":
        return None
    exp = body.get("exp")
    if exp and (today or date.today()).isoformat() > exp:
        return None
    return {"plan": "family", "id": str(body.get("id", "")), "to": str(body.get("to", ""))[:80], "expires": exp}


def _path(data_dir: Path) -> Path:
    return Path(data_dir) / "licence.json"


def save_key(data_dir: Path, key: str) -> dict | None:
    info = verify(key)
    if info:
        _path(data_dir).write_text(json.dumps({"key": key.strip()}), encoding="utf-8")
    return info


def remove_key(data_dir: Path) -> None:
    _path(data_dir).unlink(missing_ok=True)


def status(settings) -> dict:
    """{plan, edition, limits, licence}: what this copy may use."""
    if settings.edition != "retail":
        return {"plan": "family", "edition": settings.edition, "limits": FAMILY, "licence": None}
    try:
        key = json.loads(_path(settings.data_dir).read_text(encoding="utf-8")).get("key", "")
    except (OSError, ValueError):
        key = ""
    info = verify(key) if key else None
    return {"plan": "family" if info else "free", "edition": settings.edition,
            "limits": FAMILY if info else FREE, "licence": info}


def limit(settings, what: str) -> int | None:
    return status(settings)["limits"].get(what)


NEEDS_FAMILY = "Family plan: this is part of Melo's family plan. A parent can add a licence key under Parent → ⭐ Plan."


def require(settings, ok: bool) -> None:
    """402 when the free plan does not include this (only ever raised in families' copies)."""
    if not ok:
        from fastapi import HTTPException

        raise HTTPException(402, NEEDS_FAMILY)
