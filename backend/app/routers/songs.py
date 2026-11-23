"""Song school: learn a whole tune (Happy Birthday, Gayatri Mantra, Twinkle ...) phrase by phrase.

Unlike lessons, the child picks the song. Melo plays one phrase, the child echoes it with the
keys lit up, and once every phrase is learned they play the whole song. Every try is a normal
`play_song` attempt, so it feeds melody mastery, stars and the learning-graph memory.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import basics, coach, engine, memory
from ..languages import note_name as _lang_note_name
from ..curriculum import LEVELS, SONGS
from ..db import get_db
from ..models import Attempt, Child, LessonSession
from ..scoring import NotesResponse, score_sequence
from ..security import owned_child
from ..teacher.service import get_teacher
from .lessons import EVENT_ORDER, _rng, owned_session

router = APIRouter(prefix="/api", tags=["songs"])

SONG_SCHOOL = "song_school"


class PhraseIn(BaseModel):
    phrase: int = Field(ge=-1, le=20)  # -1 = the whole song
    response: dict = Field(default_factory=dict)


def note_name(midi: int, lang: str) -> str:
    """Sargam (Sa Re Ga), solfege (Do Re Mi) or letter names, by the child's language. Sa = Do = C."""
    return _lang_note_name(midi, lang)


def _note_hint(target: list[int], played: list[int], idx: int, mic: bool, lang: str, rng) -> str:
    """A specific, musical correction for the first wrong note, like a real teacher would give."""
    teacher = get_teacher()
    expected = target[idx]
    if idx >= len(played):
        return teacher.say("hint.note_missing", lang, rng, expected=note_name(expected, lang))
    got = played[idx]
    diff = ((expected - got) % 12 + 12) % 12 if mic else expected - got
    if mic and diff > 6:
        diff -= 12  # nearest way round for octave-free mic notes
    key = "hint.note_up" if diff > 0 else "hint.note_down"
    return teacher.say(key, lang, rng, expected=note_name(expected, lang), played=note_name(got, lang))


def _all_songs(db: Session, child: Child) -> dict[str, dict]:
    """The built-in library plus exercises made for this child as they progress (ids start with x_)."""
    return {**SONGS, **basics.custom_songs(db, child)}


def _song_or_404(song_id: str, db: Session | None = None, child: Child | None = None) -> dict:
    song = SONGS.get(song_id)
    if song is None and db is not None and child is not None and song_id.startswith("x_"):
        song = basics.custom_songs(db, child).get(song_id)
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")
    return song


def _bounds(song: dict, phrase: int) -> tuple[int, int]:
    ends = song["phrases"]
    if phrase == -1:
        return 0, ends[-1]
    if phrase >= len(ends):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No such phrase")
    return (ends[phrase - 1] if phrase else 0), ends[phrase]


# --- Fading help ("scaffolding"): a real teacher steps back as the child learns ----------------
# full    : Melo explains how to follow, plays the part, every key glows, names + words shown
# guided  : Melo plays the part, keys glow; no explanation
# light   : no automatic demo (the child can ask), only the first key glows, note names hidden
# memory  : play from memory: no glow, no note path; help comes back after a miss
SUPPORT_LEVELS = ("full", "guided", "light", "memory")


def support_for(stats: dict, phrase: int) -> str:
    """How much help to give for one part (or the whole song, phrase == -1).

    Steps down one level per clean pass of that part, and back up one level when the most
    recent try of that part was a miss, so a child who has forgotten gets help straight back.
    """
    s = stats.get(str(phrase), {"passes": 0, "last": None})
    if phrase == -1:
        level = 1 + min(s["passes"], 2)  # the whole song starts guided, then light, then from memory
    else:
        level = min(s["passes"], 2)  # parts: full, guided, light (memory comes from the whole song)
        whole = stats.get("-1", {"passes": 0})
        if whole["passes"] >= 2 and s["passes"] >= 2:
            level = 3  # knows the whole song well: parts from memory too
    if s.get("last") == "miss":
        level -= 1
    return SUPPORT_LEVELS[max(0, min(3, level))]


def _progress(db: Session, child_id: str, library: dict[str, dict] | None = None) -> dict[str, dict]:
    library = library if library is not None else SONGS
    rows = db.scalars(select(Attempt).where(
        Attempt.child_id == child_id, Attempt.activity_type == "play_song",
        Attempt.outcome.in_(["success", "partial", "miss"])).order_by(Attempt.created_at))
    out: dict[str, dict] = {}
    for a in rows:
        spec = a.spec or {}
        sid = spec.get("song_id")
        if sid not in library:
            continue
        p = out.setdefault(sid, {"phrases_learned": [], "completed": False, "plays": 0, "stats": {}})
        ph = spec.get("phrase")
        key = "-1" if spec.get("full_song") and ph in (None, -1) else str(ph) if isinstance(ph, int) else None
        if key is not None:
            st = p["stats"].setdefault(key, {"passes": 0, "last": None})
            st["last"] = a.outcome
            if a.outcome in ("success", "partial"):
                st["passes"] += 1
        if a.outcome == "miss":
            continue
        p["plays"] += 1
        if spec.get("full_song") and a.outcome == "success":
            p["completed"] = True
        if isinstance(ph, int) and ph >= 0 and ph not in p["phrases_learned"]:
            p["phrases_learned"].append(ph)
    for sid, p in out.items():
        p["phrases_learned"].sort()
        if p["completed"]:
            p["phrases_learned"] = list(range(len(library[sid]["phrases"])))
    return out


def _empty_progress() -> dict:
    return {"phrases_learned": [], "completed": False, "plays": 0, "stats": {}}


def _support_map(song: dict, prog: dict) -> dict[str, str]:
    stats = prog.get("stats", {})
    return {str(i): support_for(stats, i) for i in [*range(len(song["phrases"])), -1]}


def _public_song(sid: str, song: dict, child: Child) -> dict:
    words = song.get("words_hi") if child.language == "hi" and song.get("words_hi") else song.get("words")
    return {
        "id": sid, "title": song["title"], "tag": song.get("tag", "nursery"), "ease": song["ease"],
        "bpm": song.get("bpm", 84), "note": (song.get("note") or "").replace("{name}", child.name) or None,
        "source": song.get("source", "library"),
        "notes": [n for n, _ in song["notes"]], "beats": [b for _, b in song["notes"]],
        "phrases": song["phrases"],
        # the child's name is put in locally (it is never sent to the AI)
        "words": [w.replace("{name}", child.name) for w in words] if words else None,
    }


@router.get("/children/{child_id}/songs")
def list_songs(child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> list[dict]:
    library = _all_songs(db, child)
    prog = _progress(db, child.id, library)
    order = {"celebration": 0, "indian": 1, "nursery": 2, "alankar": 3, "claude": 4}
    items = sorted(library.items(), key=lambda kv: (order.get(kv[1].get("tag", "nursery"), 3), kv[1]["ease"], kv[1]["title"]))
    return [{
        "id": sid, "title": s["title"], "tag": s.get("tag", "nursery"), "ease": s["ease"], "phrase_count": len(s["phrases"]),
        "progress": {k: v for k, v in prog.get(sid, _empty_progress()).items() if k != "stats"},
    } for sid, s in items]


@router.post("/children/{child_id}/songs/{song_id}/start", status_code=201)
def start_song(song_id: str, child: Child = Depends(owned_child), db: Session = Depends(get_db)) -> dict:
    song = _song_or_404(song_id, db, child)
    # close any song/lesson left open (tab closed)
    for s in db.scalars(select(LessonSession).where(LessonSession.child_id == child.id, LessonSession.ended_at.is_(None))):
        s.ended_at, s.end_reason = datetime.now(timezone.utc), "abandoned"
    session = LessonSession(child_id=child.id, level=child.current_level, mode="practice", seed=secrets.randbelow(2**31),
                            plan={SONG_SCHOOL: song_id, "focus_skill": "melody", "source": "song_school"})
    db.add(session)
    db.commit()
    prog = _progress(db, child.id, _all_songs(db, child)).get(song_id, _empty_progress())
    learned = set(prog["phrases_learned"])
    start_at = next((i for i in range(len(song["phrases"])) if i not in learned), -1)
    teacher = get_teacher()
    # keep {name} as a placeholder here; it is filled in locally just below
    if learned and not prog["completed"]:
        intro = teacher.say("song_school.welcome_back", child.language, _rng(session, 1), song=song["title"], name="{name}", count=len(learned))
    else:
        intro = teacher.say("song_school.intro", child.language, _rng(session, 1), song=song["title"], name="{name}")
    support = _support_map(song, prog)
    if prog["completed"] and support["-1"] in ("light", "memory"):
        start_at = -1  # knows the song: go straight to playing it all, with less help
    public_prog = {k: v for k, v in prog.items() if k != "stats"}
    return {"session_id": session.id, "song": _public_song(song_id, song, child), "progress": public_prog,
            "start_phrase": start_at, "support": support, "say": intro.replace("{name}", child.name)}


@router.post("/sessions/{session_id}/song-phrase")
def song_phrase(body: PhraseIn, session: LessonSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    song_id = (session.plan or {}).get(SONG_SCHOOL)
    if not song_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "This is not a song-school session")
    if session.ended_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This song practice has ended")
    child = db.get(Child, session.child_id)
    assert child is not None
    song = _song_or_404(song_id, db, child)
    lo, hi = _bounds(song, body.phrase)
    target = [n for n, _ in song["notes"][lo:hi]]
    try:
        resp = NotesResponse.model_validate(body.response)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid response: {exc.errors()[:2]}") from None
    if resp.source == "mic" and not child.consent_microphone:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Microphone input is not allowed for this child")
    result = score_sequence(target, resp)
    whole = body.phrase == -1
    attempt = Attempt(session_id=session.id, child_id=child.id, activity_type="play_song", skill="melody",
                      level=child.current_level, difficulty=engine.skill_states(db, child)["melody"].difficulty,
                      spec={"song_id": song_id, "title": song["title"], "phrase": body.phrase, "notes": target,
                            "full_song": whole, "song_school": True},
                      response=body.response, outcome=result.outcome, score=result.score,
                      answered_at=datetime.now(timezone.utc))
    db.add(attempt)
    db.flush()
    upd = engine.apply_outcome(db, child, session, attempt, result)
    db.flush()
    memory.record_attempt(db, child, session, attempt, upd.events)
    db.commit()
    from .. import assessment

    if assessment.ai_due(db, child):  # song practice is reviewed every 12 answers too (it was not before)
        assessment.request_ai_assessment(child.id, "regular review during song practice")

    teacher = get_teacher()
    rng = _rng(session, len(session.attempts) * 17)
    lang = child.language
    passed = result.outcome in ("success", "partial")
    if whole and result.outcome == "success":
        parts = [teacher.say("song_school.whole_done", lang, rng, song=song["title"])]
        # a concept completed: the AI teacher reviews now, and the next, harder exercise is made automatically
        from . import basics as basics_router
        from .. import assessment

        assessment.request_ai_assessment(child.id, f"completed the whole song '{song['title']}'", force=True)
        basics_router.auto_next_exercises(child.id)
    elif passed:
        parts = [teacher.say(result.outcome, lang, rng), teacher.say("song_school.phrase_done", lang, rng)]
    elif result.outcome == "miss":
        parts = [teacher.say("miss", lang, rng)]
        played_now = result.detail.get("played") or []
        wrong = next((i for i, n in enumerate(target) if i >= len(played_now) or played_now[i] % 12 != n % 12), None)
        if wrong is not None:
            parts.append(_note_hint(target, played_now, wrong, resp.source == "mic", lang, rng))
        parts.append(teacher.say("song_school.try_again", lang, rng))
    else:  # uncertain / skipped: never a judgement
        parts = [teacher.say(result.outcome, lang, rng)]
    # How it was played: timing, hesitations, held notes, what the camera saw of the hands.
    coaching = coach.observe(target, [b for _, b in song["notes"][lo:hi]], song.get("bpm", 84), result.detail.get("events") or [],
                             mic=resp.source == "mic", keep_beat=resp.keep_beat,
                             camera=resp.camera.model_dump() if resp.camera else None, passed=passed)
    if coaching.tip and result.outcome in ("success", "partial", "miss"):
        tip = coaching.tip
        named = note_name(target[tip.index], lang) if tip.index is not None else ""
        line = teacher.say(f"coach.{tip.key}", lang, rng, note=named, **tip.params)
        if result.outcome == "miss" and tip.key != "hesitation":
            pass  # after a miss the wrong-note hint is enough; one idea at a time
        elif result.outcome == "miss":
            parts.insert(-1, line)
        else:
            parts.insert(1, line)
    drill = coaching.drill if (not passed or (coaching.tip and coaching.tip.key == "hesitation")) else None
    if drill and not whole:
        names = " ".join(note_name(n, lang) for n in target[drill["start"]:drill["end"] + 1])
        drill = {**drill, "say": teacher.say("drill.intro", lang, rng, notes=names)}
    else:
        drill = None  # spot practice belongs to learning a part; the whole song just goes again
    parts += [teacher.say(e, lang, rng, level=LEVELS[child.current_level]["name"])
              for e in EVENT_ORDER if e in upd.events and e in ("level_up", "check_mic")]
    played = result.detail.get("played") or []
    first_wrong = next((i for i, n in enumerate(target) if i >= len(played) or played[i] % 12 != n % 12), None) if not passed else None
    support = _support_map(song, _progress(db, child.id, _all_songs(db, child)).get(song_id, _empty_progress()))
    return {
        "support": support,  # updated help levels: less after a pass, more after a miss
        "outcome": result.outcome, "score": result.score, "passed": passed, "stars_earned": upd.stars_earned,
        "stars": session.stars, "level": child.current_level, "events": [e for e in EVENT_ORDER if e in upd.events],
        "say": " ".join(p for p in parts if p).replace("{name}", child.name),
        "hint_index": first_wrong,  # first note to practise (index inside the phrase) after a miss
        "tip": coaching.tip.key if coaching.tip else None,
        "drill": drill,  # {"start", "end"}: notes inside the phrase to practise on their own before trying again
        "stats": coaching.stats,
    }
