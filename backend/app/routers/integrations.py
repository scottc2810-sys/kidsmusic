"""Claude Code connection (tokens + ready-to-paste terminal commands) and learning-graph memory API."""
from __future__ import annotations

import sys
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import memory
from ..config import BACKEND_DIR, get_settings
from ..curriculum import ACTIVITIES
from ..db import get_db
from ..mcp_server import create_token
from ..models import ApiToken, Child, Parent
from ..schemas import Strict
from ..security import current_parent, owned_child

router = APIRouter(prefix="/api", tags=["integrations"])
MAX_TOKENS = 10


class TokenIn(Strict):
    name: str = Field(default="Claude Code", min_length=1, max_length=60)
    allow_write: bool = False


class NoteIn(Strict):
    note: str = Field(min_length=1, max_length=1000)
    about_skill: str | None = Field(default=None, max_length=20)


class FocusIn(Strict):
    skill: str | None = Field(default=None, max_length=20)


def _iso(dt):
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat() if dt else None


def _q(s: str) -> str:
    return f'"{s}"' if " " in s else s


def connect_commands(base_url: str, token: str) -> dict:
    py = sys.executable
    launcher = str(BACKEND_DIR / "melo_mcp.py")
    data_dir = str(get_settings().data_dir.resolve())
    return {
        "http": f'claude mcp add --transport http melo {base_url}/mcp/ --header "Authorization: Bearer {token}"',
        "stdio": f"claude mcp add melo --env KM_MCP_TOKEN={token} --env KM_DATA_DIR={_q(data_dir)} -- {_q(py)} {_q(launcher)}",
        "verify": "claude mcp list",
        "try": 'claude "Use the melo tools: how is my child doing this week, and what should we practise next?"',
    }


@router.get("/integrations/tokens")
def list_tokens(parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> list[dict]:
    toks = db.scalars(select(ApiToken).where(ApiToken.parent_id == parent.id, ApiToken.revoked.is_(False)).order_by(ApiToken.created_at.desc()))
    return [{"id": t.id, "name": t.name, "prefix": t.prefix, "allow_write": t.allow_write, "created_at": _iso(t.created_at),
             "last_used_at": _iso(t.last_used_at)} for t in toks]


@router.post("/integrations/tokens", status_code=201)
def new_token(body: TokenIn, request: Request, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> dict:
    active = db.query(ApiToken).filter(ApiToken.parent_id == parent.id, ApiToken.revoked.is_(False)).count()
    if active >= MAX_TOKENS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Up to {MAX_TOKENS} active tokens; revoke one first")
    tok, raw = create_token(db, parent.id, body.name, body.allow_write)
    base = str(request.base_url).rstrip("/")
    return {"id": tok.id, "token": raw, "prefix": tok.prefix, "allow_write": tok.allow_write, "commands": connect_commands(base, raw),
            "note": "Copy the token now - it is shown only once."}


@router.delete("/integrations/tokens/{token_id}", status_code=204)
def revoke_token(token_id: str, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> Response:
    tok = db.get(ApiToken, token_id)
    if tok is None or tok.parent_id != parent.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    tok.revoked = True
    db.commit()
    return Response(status_code=204)


# --- memory (parent dashboard) -------------------------------------------------------------------
@router.get("/children/{child_id}/memory")
def memory_overview(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    out = memory.overview(db, child)
    db.commit()
    return out


@router.get("/children/{child_id}/memory/graph")
def memory_graph(node: str | None = None, depth: int = 1, relation: str | None = None,
                 child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    return memory.subgraph(db, child, node, depth, relation)


@router.get("/children/{child_id}/memory/timeline")
def memory_timeline(days: int = 30, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[dict]:
    return memory.timeline(db, child, days)


@router.post("/children/{child_id}/memory/notes", status_code=201)
def memory_note(body: NoteIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    n = memory.add_note(db, child, body.note.strip(), body.about_skill)
    db.commit()
    return {"id": n.id}


@router.put("/children/{child_id}/memory/focus")
def memory_focus(body: FocusIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    allowed = sorted({a.skill for a in ACTIVITIES.values() if a.min_level <= child.current_level})
    if body.skill is not None and body.skill not in allowed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Skill must be one of {allowed}")
    memory.set_focus_override(db, child, body.skill)
    db.commit()
    return {"focus_skill": body.skill}


@router.post("/children/{child_id}/memory/rebuild")
def memory_rebuild(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    stats = memory.rebuild(db, child)
    db.commit()
    return stats
