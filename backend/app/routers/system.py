"""System check for parents: what this computer has for Melo, and what is optional and how to add it.
The browser adds its own checks (voices, speech recognition, microphone) on the page."""
from __future__ import annotations

import os
import platform
import shutil
import sys

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field

from ..config import FROZEN, get_settings
from .. import licence, updates
from ..models import Parent
from ..schemas import Strict
from ..security import client_ip, current_parent, rate_limiter
from ..teacher import llm
from ..teacher.service import find_claude_cli, get_teacher

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/system/check")
def system_check(parent: Parent = Depends(current_parent)) -> dict:
    s = get_settings()
    checks = []

    def add(id_: str, name: str, ok: bool, required: bool, detail: str, fix: str | None = None, link: str | None = None) -> None:
        checks.append({"id": id_, "name": name, "ok": ok, "required": required, "detail": detail, "fix": None if ok else fix, "link": None if ok else link})

    try:
        free_mb = shutil.disk_usage(s.data_dir).free // (1024 * 1024)
    except OSError:
        free_mb = 0
    writable = os.access(s.data_dir, os.W_OK)
    add("data", "Data folder", writable, True, f"{s.data_dir} ({free_mb} MB free)", "Melo cannot write its data folder: check its permissions.")
    add("disk", "Disk space", free_mb >= 300, True, f"{free_mb} MB free", "Free some disk space: recordings and lessons need room.")
    add("app", "Melo app", True, True, f"{'installed app' if FROZEN else 'running from source'}, Python {platform.python_version()}, {platform.system()} {platform.release()}")
    st = get_teacher().status()
    claude = bool(find_claude_cli(s.claude_code_bin))
    add("claude", "Claude Code (optional AI brain)", claude, False, "found" if claude else "not found",
        "Install Claude Code, run `claude` once and log in, then choose it under AI brain.", "https://claude.com/claude-code")
    models = llm.ollama_models(s.ollama_url, timeout=1.0)
    add("ollama", "Ollama (optional free local AI brain)", models is not None and bool(models), False,
        f"running, {len(models)} model(s)" if models else ("running, but no model yet" if models is not None else "not running or not installed"),
        "Install Ollama, then in a terminal: ollama pull llama3.2" if models is None else "In a terminal: ollama pull llama3.2", "https://ollama.com/download")
    add("brain", "AI brain in use", st["provider"] != "offline", False, f"{st['provider']}{' · ' + str(st['model']) if st.get('model') else ''}",
        "Optional: choose an AI brain under Parent → AI brain. Melo teaches offline without one.")
    return {"checks": checks, "ok": all(c["ok"] for c in checks if c["required"]), "platform": sys.platform}


@router.get("/system/update")
def update_check(parent: Parent = Depends(current_parent)) -> dict:
    """Whether a newer Melo is out (cached for 12 hours; nothing personal is sent)."""
    return updates.check(get_settings().update_url)


class LicenceIn(Strict):
    key: str = Field(min_length=10, max_length=1000)


@router.get("/licence")
def licence_status(parent: Parent = Depends(current_parent)) -> dict:
    """This copy's plan (free or family), what the free plan includes, and the active key's details."""
    return licence.status(get_settings())


@router.put("/licence")
def licence_add(body: LicenceIn, request: Request, parent: Parent = Depends(current_parent)) -> dict:
    rate_limiter.check(f"licence:{client_ip(request)}", 10)
    if not licence.save_key(get_settings().data_dir, body.key):
        raise HTTPException(422, "That key isn't valid. Copy it again from your purchase email, all of it.")
    return licence.status(get_settings())


@router.delete("/licence")
def licence_remove(parent: Parent = Depends(current_parent)) -> dict:
    licence.remove_key(get_settings().data_dir)
    return licence.status(get_settings())
