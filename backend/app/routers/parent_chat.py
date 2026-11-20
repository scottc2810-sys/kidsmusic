"""Parent chat API: talk to the AI teacher about a child; it proposes changes, the parent applies them."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from .. import parent_chat
from ..db import get_db
from ..models import Child
from ..schemas import Strict
from ..security import client_ip, owned_child, rate_limiter

router = APIRouter(prefix="/api", tags=["parent-chat"])


class ChatIn(Strict):
    message: str = Field(min_length=1, max_length=1000)
    history: list[dict] = Field(default_factory=list, max_length=20)


class ApplyIn(Strict):
    action: dict


@router.get("/children/{child_id}/parent-plan")
def get_plan(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    out = {**parent_chat.plan(db, child), "history": parent_chat.recent_turns(db, child, "parent", 30),
           "summary": parent_chat.chat_summary(db, child, "parent")}
    db.commit()
    return out


@router.post("/children/{child_id}/parent-chat")
def chat(body: ChatIn, request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    rate_limiter.check(f"parent-chat:{child.id}:{client_ip(request)}", 20)
    out = parent_chat.chat(db, child, body.message.strip(), body.history)
    db.commit()
    return out


@router.post("/children/{child_id}/parent-chat/apply")
def apply(body: ApplyIn, request: Request, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    rate_limiter.check(f"parent-apply:{child.id}:{client_ip(request)}", 30)
    try:
        out = parent_chat.apply(db, child, body.action)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
    db.commit()
    return {**out, "plan": parent_chat.plan(db, child)}


@router.delete("/children/{child_id}/parent-plan/{kind}/{index}")
def remove(kind: str, index: int, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Remove a goal or tactic the parent no longer wants."""
    if kind not in ("goals", "tactics"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown kind")
    items = parent_chat.plan(db, child)[kind]
    if not 0 <= index < len(items):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    parent_chat._set_props(db, child, **{kind: items[:index] + items[index + 1:]})
    db.commit()
    return parent_chat.plan(db, child)
