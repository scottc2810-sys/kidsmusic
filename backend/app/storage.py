"""Encrypted-at-rest storage for practice recordings."""
from __future__ import annotations

import os
import re
import secrets
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

_NAME_RE = re.compile(r"^[a-f0-9]{32}\.bin$")


class RecordingStore:
    def __init__(self, root: Path | None = None, key: bytes | None = None) -> None:
        s = get_settings()
        self.root = root or s.recordings_dir
        self.root.mkdir(parents=True, exist_ok=True)
        self._fernet = Fernet(key or s.resolved_recording_key())

    def _path(self, name: str) -> Path:
        if not _NAME_RE.match(name):  # never build paths from untrusted input
            raise ValueError("invalid storage name")
        return self.root / name

    def save(self, data: bytes) -> str:
        name = secrets.token_hex(16) + ".bin"
        path = self._path(name)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(self._fernet.encrypt(data))
        os.replace(tmp, path)
        return name

    def load(self, name: str) -> bytes:
        try:
            return self._fernet.decrypt(self._path(name).read_bytes())
        except (InvalidToken, FileNotFoundError) as exc:
            raise FileNotFoundError("recording unavailable") from exc

    def delete(self, name: str) -> None:
        try:
            self._path(name).unlink(missing_ok=True)
        except ValueError:
            pass


_store: RecordingStore | None = None


def get_store() -> RecordingStore:
    global _store
    if _store is None:
        _store = RecordingStore()
    return _store


def reset_store() -> None:
    global _store
    _store = None
