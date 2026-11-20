"""Password hashing, session tokens, auth dependencies, rate limiting."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Child, Parent

COOKIE_NAME = "melo_session"
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "melo"

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_b64, dk_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), **_SCRYPT)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except (ValueError, TypeError):
        return False


# Used to equalise timing when the email does not exist.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def dummy_verify() -> None:
    verify_password("not-the-password", _DUMMY_HASH)


def create_session_token(parent_id: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": parent_id, "iat": now, "exp": now + timedelta(hours=s.session_ttl_hours), "typ": "session"}
    return jwt.encode(payload, s.resolved_secret_key(), algorithm="HS256")


def set_session_cookie(response: Response, token: str, request: Request | None = None) -> None:
    s = get_settings()
    secure = s.cookie_secure if s.cookie_secure is not None else bool(request and request.url.scheme == "https")
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=s.session_ttl_hours * 3600,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def current_parent(request: Request, db: Session = Depends(get_db)) -> Parent:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        payload = jwt.decode(token, get_settings().resolved_secret_key(), algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from None
    if payload.get("typ") != "session":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    parent = db.get(Parent, payload["sub"])
    if parent is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    return parent


def owned_child(child_id: str, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> Child:
    """Resolve a child that belongs to the signed-in parent (404 otherwise — no IDOR, no enumeration)."""
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


class RateLimiter:
    """Small in-process sliding-window limiter (per key). Adequate for single-host deployments."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: float = 60.0) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Please wait a minute.")
            q.append(now)
            if len(self._hits) > 10_000:  # bound memory
                for k in [k for k, v in self._hits.items() if not v][:5000]:
                    self._hits.pop(k, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
