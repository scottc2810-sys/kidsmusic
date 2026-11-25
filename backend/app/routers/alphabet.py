"""Alphabets: every letter of every language, its sound, a word that starts with it, and its voice; each child's
progress per letter and skill (read, write, listen, speak); and the comparison of letters across languages."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field
from sqlalchemy.orm import Session

from .. import memory
from ..db import get_db
from ..lang import alphabet as abc
from ..lang.content import TARGETS
from ..models import Child, ChildPrefs, Parent
from ..schemas import Strict
from ..security import current_parent, owned_child

router = APIRouter(prefix="/api", tags=["alphabet"])
SKILLS = ("read", "write", "listen", "speak")
KEY = "alphabet"


def _lang(code: str) -> str:
    if code not in TARGETS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown language")
    return code


@router.get("/learn/alphabet/{code}")
def letters(code: str, parent: Parent = Depends(current_parent)) -> dict:
    code = _lang(code)
    t = TARGETS[code]
    return {"code": code, "name": t.name, "native": t.native, "locale": t.locale, "rtl": t.rtl, "flag": t.flag,
            "letters": [x.public() for x in abc.alphabet(code)]}


@router.get("/learn/alphabet-compare")
def compare(langs: str = Query(..., max_length=200), parent: Parent = Depends(current_parent)) -> dict:
    codes = list(dict.fromkeys(c for c in langs.split(",") if c))
    if not 1 <= len(codes) <= 20 or any(c not in TARGETS for c in codes):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose 1 to 20 known languages")
    return {"langs": [{"code": c, "name": TARGETS[c].name, "native": TARGETS[c].native, "flag": TARGETS[c].flag, "locale": TARGETS[c].locale}
                      for c in codes], "rows": abc.compare(codes)}


def _data(db: Session, child: Child) -> tuple[ChildPrefs, dict]:
    p = db.get(ChildPrefs, child.id)
    if p is None:
        p = ChildPrefs(child_id=child.id, data={})
        db.add(p)
    return p, dict((p.data or {}).get(KEY) or {})


@router.get("/children/{child_id}/alphabet/{code}")
def progress(code: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    code = _lang(code)
    _, data = _data(db, child)
    return {"letters": data.get(code, {})}


class Result(Strict):
    i: int = Field(ge=0, le=299)
    ok: bool


class RoundIn(Strict):
    skill: str = Field(pattern="^(read|write|listen|speak)$")
    results: list[Result] = Field(min_length=1, max_length=20)


@router.post("/children/{child_id}/alphabet/{code}/round")
def record_round(code: str, body: RoundIn, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    """Per letter and skill: tries, right answers and a streak; a letter-skill counts as learned after 2 right in a row."""
    code = _lang(code)
    n = len(abc.alphabet(code))
    if any(r.i >= n for r in body.results):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No such letter")
    p, data = _data(db, child)
    lang = {k: dict(v) for k, v in (data.get(code) or {}).items()}
    newly = []
    for r in body.results:
        cell = dict(lang.get(str(r.i), {}).get(body.skill) or {"tries": 0, "right": 0, "streak": 0})
        was = cell["streak"] >= 2
        cell["tries"] += 1
        cell["right"] += int(r.ok)
        cell["streak"] = cell["streak"] + 1 if r.ok else 0
        if cell["streak"] >= 2 and not was:
            newly.append(r.i)
        lang.setdefault(str(r.i), {})[body.skill] = cell
    data[code] = lang
    p.data = {**(p.data or {}), KEY: data}
    right = sum(r.ok for r in body.results)
    letters_ = abc.alphabet(code)
    learned = sorted({int(i) for i, v in lang.items() if any((c or {}).get("streak", 0) >= 2 for c in v.values())})
    memory._event(db, child.id, "alphabet",
                  f"{TARGETS[code].name} alphabet · {body.skill}: {right}/{len(body.results)} right"
                  + (f"; learned {' '.join(letters_[i].char for i in newly)}" if newly else "")
                  + f" ({len(learned)}/{n} letters known)", memory.nid_child(child.id))
    db.commit()
    return {"right": right, "total": len(body.results), "newly_learned": newly, "known": len(learned), "of": n,
            "stars": 3 if right == len(body.results) else 2 if right * 10 >= 7 * len(body.results) else 1 if right else 0}
