from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from .. import memory
from ..db import get_db
from ..models import Child, Parent
from ..config import get_settings
from ..schemas import ChatIn, Strict
from ..teacher import llm
from ..security import client_ip, current_parent, owned_child, rate_limiter
from ..teacher.service import find_claude_cli, get_teacher, reset_teacher

router = APIRouter(prefix="/api", tags=["teacher"])


@router.get("/teacher/status")
def teacher_status() -> dict:
    return get_teacher().status()


@router.post("/teacher/test")
def teacher_test(request: Request, parent: Parent = Depends(current_parent)) -> dict:
    """Parent-only: make one real call to the configured AI brain (Claude Code CLI or API) and report back."""
    rate_limiter.check(f"teacher-test:{parent.id}:{client_ip(request)}", 6)
    out = get_teacher().self_test()
    if out.get("reply"):
        out["reply"] = out["reply"].replace("{name}", "friend")
    return out


@router.post("/children/{child_id}/chat")
def chat(body: ChatIn, request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    rate_limiter.check(f"chat:{child.id}:{client_ip(request)}", 20)
    from .. import parent_chat

    teacher = get_teacher()
    # the child's talk with Melo is kept too (on this computer): the AI gets the running summary + the last turns
    stored = parent_chat.recent_turns(db, child, "child")
    mem = memory.brief(db, child) if teacher.uses_ai(child) else None
    out = teacher.chat(child, body.message, stored or body.history, mem)
    parent_chat.record_turn(db, child, "child", "user", body.message)
    parent_chat.record_turn(db, child, "child", "melo", out["reply"])
    try:
        parent_chat.maybe_summarize(db, child, "child")
    except Exception:  # noqa: BLE001 - the summary is a bonus
        pass
    db.commit()
    out["reply"] = out["reply"].replace("{name}", child.name)  # name is filled locally, never sent to the AI
    return out


# --- choosing the AI brain (parent only) ----------------------------------------------------------------
class BrainIn(Strict):
    provider: str = Field(pattern="^(auto|claude_code|ollama|openai|offline)$")
    ollama_url: str | None = Field(default=None, max_length=200)
    ollama_model: str | None = Field(default=None, max_length=120)
    llm_base_url: str | None = Field(default=None, max_length=300)
    llm_model: str | None = Field(default=None, max_length=120)
    llm_api_key: str | None = Field(default=None, max_length=400)  # "" keeps the saved key


def _url_ok(url: str | None) -> bool:
    return not url or url.startswith(("http://", "https://"))


@router.get("/teacher/brains")
def brains(parent: Parent = Depends(current_parent)) -> dict:
    """What AI brains this computer has: Claude Code, Ollama (and its models), local OpenAI-compatible servers,
    plus the online services a parent can connect with their own key, and the current choice."""
    s = get_settings()
    saved = llm.load_brain(s.data_dir)
    ollama_url = saved.get("ollama_url") or s.ollama_url
    models = llm.ollama_models(ollama_url, timeout=1.2)
    local = []
    for name, url in llm.LOCAL_SERVERS:
        m = llm.openai_models(url, timeout=0.8)
        if m is not None:
            local.append({"name": name, "base_url": url, "models": m[:40]})
    return {
        "current": get_teacher().status(),
        "saved": {k: v for k, v in saved.items() if k != "llm_api_key"} | {"has_api_key": bool(saved.get("llm_api_key") or s.llm_api_key)},
        "claude_code": {"found": s.edition != "retail" and bool(find_claude_cli(s.claude_code_bin)), "offered": s.edition != "retail"},
        "ollama": {"running": models is not None, "url": ollama_url, "models": (models or [])[:40],
                   "suggested": llm.pick_ollama_model(models or []) if models else None},
        "local_servers": local,
        "online": [{"id": k, "name": n, "base_url": u, "model": m} for k, (n, u, m) in llm.ONLINE_PRESETS.items()],
    }


@router.put("/teacher/brain")
def set_brain(body: BrainIn, request: Request, parent: Parent = Depends(current_parent)) -> dict:
    """Save the brain choice for this Melo install (brain.json in the data folder) and test it at once."""
    rate_limiter.check(f"brain:{parent.id}:{client_ip(request)}", 10)
    if not (_url_ok(body.ollama_url) and _url_ok(body.llm_base_url)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Addresses must start with http:// or https://")
    if body.provider == "claude_code" and get_settings().edition == "retail":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Claude Code is not available in this edition: choose the offline teacher, Ollama or an online service with your own key")
    if body.provider == "openai" and not (body.llm_base_url and body.llm_model):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Give the server address and the model name")
    s = get_settings()
    old = llm.load_brain(s.data_dir)
    values = body.model_dump()
    if not body.llm_api_key and old.get("llm_api_key") and body.llm_base_url == old.get("llm_base_url"):
        values["llm_api_key"] = old["llm_api_key"]  # keep the saved key unless a new one is typed or the server changed
    llm.save_brain(s.data_dir, values)
    reset_teacher()
    out = get_teacher().self_test()
    if out.get("reply"):
        out["reply"] = out["reply"].replace("{name}", "friend")
    return out
