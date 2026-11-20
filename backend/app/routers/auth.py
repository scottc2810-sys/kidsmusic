from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Parent, Recording
from ..schemas import Credentials, LoginIn, ParentOut
from ..security import (
    clear_session_cookie,
    client_ip,
    create_session_token,
    current_parent,
    dummy_verify,
    hash_password,
    rate_limiter,
    set_session_cookie,
    verify_password,
)
from ..storage import get_store

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=ParentOut, status_code=201)
def register(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)) -> ParentOut:
    rate_limiter.check(f"register:{client_ip(request)}", get_settings().login_rate_per_minute)
    parent = Parent(email=body.email, password_hash=hash_password(body.password))
    db.add(parent)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists") from None
    set_session_cookie(response, create_session_token(parent.id), request)
    return ParentOut(id=parent.id, email=parent.email)


@router.post("/login", response_model=ParentOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> ParentOut:
    s = get_settings()
    email = body.email.strip().lower()
    rate_limiter.check(f"login-ip:{client_ip(request)}", s.login_rate_per_minute)
    rate_limiter.check(f"login-email:{email}", s.login_rate_per_minute)
    parent = db.scalar(select(Parent).where(Parent.email == email))
    if parent is None:
        dummy_verify()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    if not verify_password(body.password, parent.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    set_session_cookie(response, create_session_token(parent.id), request)
    return ParentOut(id=parent.id, email=parent.email)


@router.post("/logout", status_code=204)
def logout(response: Response) -> Response:
    clear_session_cookie(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=ParentOut)
def me(parent: Parent = Depends(current_parent)) -> ParentOut:
    return ParentOut(id=parent.id, email=parent.email)


@router.delete("/account", status_code=204)
def delete_account(response: Response, parent: Parent = Depends(current_parent), db: Session = Depends(get_db)) -> Response:
    """Delete the parent account and *all* children, progress and recordings."""
    child_ids = [c.id for c in parent.children]
    names = list(db.scalars(select(Recording.storage_name).where(Recording.child_id.in_(child_ids)))) if child_ids else []
    db.delete(parent)
    db.commit()
    store = get_store()
    for n in names:
        store.delete(n)
    clear_session_cookie(response)
    response.status_code = 204
    return response
