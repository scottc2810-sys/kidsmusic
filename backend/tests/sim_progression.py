"""Simulated children going through Melo over several sessions: how difficulty and stage move.

Run:  .venv/Scripts/python.exe -m tests.sim_progression
Each child answers right with a fixed chance (strong 90%, average 65%, struggling 30%). Between sessions
the clock is moved forward, so every session is a fresh sitting (like a new day or a lost tab).
Used by tests/test_progression.py; printing the trajectories is the human-readable check.
"""
from __future__ import annotations

import random
from datetime import timedelta

from app.db import session_factory
from app.models import Attempt, LangAttempt, LessonSession, SkillState


def _wrong(spec: dict, t: str) -> dict:
    if "answer" in spec and isinstance(spec["answer"], int) and "options" in spec:
        return {"choice": (spec["answer"] + 1) % len(spec["options"])}
    if "answer" in spec and isinstance(spec["answer"], int):
        return {"choice": 1 - spec["answer"] if spec["answer"] in (0, 1) else 0}
    if t == "rhythm_tap":
        return {"taps": [0, 50, 90]}
    return {"source": "screen", "notes": [{"midi": 30, "t": 0}, {"midi": 31, "t": 300}]}


def music_response(attempt_id: str, right: bool) -> dict:
    db = session_factory()()
    a = db.get(Attempt, attempt_id)
    spec, t = a.spec, a.activity_type
    a.created_at = a.created_at - timedelta(seconds=3)  # a real child answers a few seconds after the question
    db.commit()
    db.close()
    if not right:
        return _wrong(spec, t)
    if "answer" in spec:
        return {"choice": spec["answer"]}
    if t == "rhythm_tap":
        beat = 60000 / spec["bpm"]
        return {"taps": [p * beat for p in spec["pattern"]]}
    if t == "find_note":
        return {"source": "screen", "notes": [{"midi": spec["target"], "t": 0}]}
    if t in ("echo_melody", "play_song"):
        return {"source": "screen", "notes": [{"midi": m, "t": i * 300} for i, m in enumerate(spec["notes"])]}
    return {"source": "screen", "notes": [{"midi": m, "t": i * 300} for i, m in enumerate([60, 62, 64, 67])]}


def lang_response(attempt_id: str, right: bool) -> dict:
    db = session_factory()()
    a = db.get(LangAttempt, attempt_id)
    spec, t = a.spec, a.activity
    a.created_at = a.created_at - timedelta(seconds=3)  # a real child answers a few seconds after the question
    db.commit()
    db.close()
    if t in ("listen_pick", "read_pick", "letter_sound", "reply_pick"):
        return {"choice": spec["answer"] if right else (spec["answer"] + 1) % len(spec["options"])}
    if t == "say_word":
        return {"heard": [spec["answer"] if right else "banana"]}
    if t == "trace":
        return {"strokes": 2, "coverage": 0.9 if right else 0.1, "spill": 0.05}
    return {"text": spec["answer"] if right else "zzz"}


def age_everything(child_id: str, hours: float) -> None:
    """Move the child's history back in time: the next request is a new sitting / a new day."""
    db = session_factory()()
    d = timedelta(hours=hours)
    for model, col in ((Attempt, "created_at"), (LangAttempt, "created_at"), (LessonSession, "started_at")):
        for row in db.query(model).filter(model.child_id == child_id):
            setattr(row, col, getattr(row, col) - d)
            if model is LessonSession and row.ended_at:
                row.ended_at = row.ended_at - d
            if model is LangAttempt and row.answered_at:
                row.answered_at = row.answered_at - d
    db.commit()
    db.close()


def skills_of(child_id: str) -> dict:
    db = session_factory()()
    out = {s.skill: (s.difficulty, round(s.mastery, 2)) for s in db.query(SkillState).filter(SkillState.child_id == child_id)}
    db.close()
    return out


def music_course(client, child_id: str, p_right: float, sessions: int = 4, per_session: int = 12, seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    log = []
    for s in range(sessions):
        start = client.post(f"/api/children/{child_id}/sessions", json={}).json()
        sid = start["session_id"]
        before = skills_of(child_id)
        events, outcomes = [], []
        for _ in range(per_session):
            nxt = client.post(f"/api/sessions/{sid}/next").json()
            if nxt.get("done"):
                break
            res = client.post(f"/api/sessions/{sid}/attempts/{nxt['attempt_id']}/answer",
                              json={"response": music_response(nxt["attempt_id"], rng.random() < p_right)}).json()
            outcomes.append(res["outcome"])
            events += [e for e in res["events"] if e in ("harder", "easier", "level_up", "break_offer", "game_switch")]
            if "break_offer" in res["events"]:
                break
        client.post(f"/api/sessions/{sid}/end")
        child = client.get(f"/api/children/{child_id}").json()
        log.append({"session": s + 1, "start_difficulty": before, "end_difficulty": skills_of(child_id), "level": child["current_level"],
                    "events": events, "right": outcomes.count("success"), "n": len(outcomes), "greeting": start["greeting"]})
        age_everything(child_id, 24)
    return log


def exposures(child_id: str, lang: str, attempt_id: str) -> int:
    """How many times the child has already met this word or letter (with its answer shown afterwards)."""
    db = session_factory()()
    item = (db.get(LangAttempt, attempt_id).spec or {}).get("item")
    n = db.query(LangAttempt).filter(LangAttempt.child_id == child_id, LangAttempt.lang == lang, LangAttempt.outcome.is_not(None)).all()
    db.close()
    return sum(1 for a in n if (a.spec or {}).get("item") == item)


def language_course(client, child_id: str, lang: str, p_right: float, sessions: int = 4, per_session: int = 15, seed: int = 0,
                    learn_rate: float = 0.08) -> list[dict]:
    rng = random.Random(seed)
    log = []
    for s in range(sessions):
        before = client.get(f"/api/children/{child_id}/learn/{lang}").json()
        kinds, emotions, first = [], [], None
        for i in range(per_session):
            nxt = client.post(f"/api/children/{child_id}/learn/{lang}/next", json={}).json()
            if i == 0:
                first = nxt["say"]
            kinds.append(f"{nxt['skill'][0]}{nxt['difficulty']}")
            guided = nxt["spec"].get("glow") is not None  # a real child taps the glowing answer
            # and a real child learns: every time a word comes back it is a little easier (slow learners too)
            chance = 0.9 if guided else min(0.95, p_right + learn_rate * exposures(child_id, lang, nxt["attempt_id"]))
            res = client.post(f"/api/children/{child_id}/learn/attempts/{nxt['attempt_id']}/answer",
                              json={"response": lang_response(nxt["attempt_id"], rng.random() < chance)}).json()
            emotions.append(res["emotion"])
            kinds[-1] += "*" if guided else ""
        after = res["status"]
        log.append({"session": s + 1, "stage_before": before["stage"], "stage_after": after["stage"],
                    "skills_after": {k: v["stage"] for k, v in after["skills"].items()}, "words_known": after["words_known"],
                    "tier": after["tier"], "activities": " ".join(kinds), "emotions": emotions, "first_line": first})
        age_everything(child_id, 24)
    return log


if __name__ == "__main__":
    import os
    import sys
    import tempfile

    sys.stdout.reconfigure(encoding="utf-8")
    tmp = tempfile.mkdtemp(prefix="melo-sim-")
    os.environ.update(KM_DATA_DIR=tmp, KM_ENV="test", KM_AI_PROVIDER="offline", KM_FRONTEND_DIST=os.path.join(tmp, "none"))
    from fastapi.testclient import TestClient

    from app.db import init_engine
    from app.main import create_app

    init_engine(f"sqlite:///{tmp}/sim.db")
    with TestClient(create_app()) as c:
        c.headers.update({"X-Requested-With": "melo"})
        c.post("/api/auth/register", json={"email": "sim@example.test", "password": "simulate-123-x", "agree": True})
        for label, p in (("strong", 0.9), ("average", 0.65), ("struggling", 0.3)):
            cid = c.post("/api/children", json={"name": "Kid", "age": 5, "language": "en", "session_minutes": 20}).json()["id"]
            print(f"\n=== {label} child ({int(p * 100)}% right): music ===")
            for row in music_course(c, cid, p, seed=7):
                print(f" S{row['session']} level {row['level']} right {row['right']}/{row['n']} | start {row['start_difficulty']} -> end {row['end_difficulty']}")
                print(f"    events {row['events']} | greeting: {row['greeting'][:90]}")
            print(f"--- {label}: Hindi language ---")
            for row in language_course(c, cid, "hi", p, seed=3):
                print(f" S{row['session']} stage {row['stage_before']}->{row['stage_after']} skills {row['skills_after']} words {row['words_known']} tier {row['tier']}")
                print(f"    {row['activities']}")
                print(f"    first line: {row['first_line'][:100]} | emotions: {' '.join(sorted(set(row['emotions'])))}")
