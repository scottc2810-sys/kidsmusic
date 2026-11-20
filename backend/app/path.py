"""The learning path: an ordered set of chapters, so the child always has a clear "what's next".

Each chapter is finished by showing the skill, not by spending time. Chapters the child already
masters (from earlier lessons, the song school, or because they knew it before) are marked done
straight away, so a child who has already learned something moves on to new material.
The first chapter that is not done is "current"; the app's home screen offers it.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import engine
from .curriculum import ACTIVITIES, LEVELS, SONGS
from .languages import lang as lang_info
from .models import Attempt, Child, SkillState

DONE_SUCCESSES = 3  # successes at an activity that finish its chapter...
DONE_DIFFICULTY = 3  # ...or the skill is already at this difficulty with one success at the activity


@dataclass(frozen=True)
class Chapter:
    id: str
    level: int
    title: str  # English; the app translates it
    icon: str
    kind: str  # topic | song | compose | lesson
    target: str  # topic id, song id, or skill
    activity: str | None = None  # activity type whose successes finish the chapter


def _chapters(indian: bool) -> list[Chapter]:
    first_song = "sargam" if indian else "hot_cross_buns"
    return [
        Chapter("high_low", 1, "High and low sounds", "🐦", "topic", "high_low", "high_low"),
        Chapter("loud_soft", 1, "Loud and soft", "🦁", "topic", "loud_soft", "loud_soft"),
        Chapter("instruments", 1, "Instrument voices", "🎺", "topic", "instruments", "instrument_guess"),
        Chapter("beat", 1, "Feel the beat", "🥁", "topic", "rhythm", "rhythm_tap"),
        Chapter("find_notes", 1, "Find the notes on the keys", "🎹", "topic", "swars", "find_note"),
        Chapter("first_song", 2, "Your first tune", "🎵", "song", first_song),
        Chapter("ears", 2, "Music ears: same or different", "👂", "topic", "ear", "same_different"),
        Chapter("echo", 2, "Echo my tune", "🔁", "lesson", "melody", "echo_melody"),
        Chapter("fast_slow", 2, "Fast and slow", "🐇", "topic", "fast_slow", "fast_slow"),
        Chapter("song_2", 2, "A song with words", "⭐", "song", "twinkle"),
        Chapter("scale", 3, "Up and down the whole scale", "🪜", "song", "aaroh_avroh"),
        Chapter("compose", 3, "Make your own tune", "🎨", "compose", "creativity", "free_play"),
        Chapter("song_3", 3, "A longer song", "🎂", "song", "happy_birthday"),
        Chapter("patterns", 4, "Note patterns", "🎼", "song", "alankar_1"),
        Chapter("song_4", 4, "A grown-up melody", "🎻", "song", "ode_to_joy"),
    ]


def learning_path(db: Session, child: Child) -> dict:
    states = {s.skill: s for s in db.scalars(select(SkillState).where(SkillState.child_id == child.id))}
    wins = dict(db.execute(select(Attempt.activity_type, func.count()).where(
        Attempt.child_id == child.id, Attempt.outcome == "success").group_by(Attempt.activity_type)).all())
    songs_done: set[str] = set()
    for spec in db.scalars(select(Attempt.spec).where(Attempt.child_id == child.id, Attempt.activity_type == "play_song",
                                                      Attempt.outcome == "success")):
        if spec and spec.get("full_song"):
            songs_done.add(spec.get("song_id"))

    def done(ch: Chapter) -> bool:
        if ch.level < child.current_level and ch.kind != "song":
            return True  # the level was passed (or the parent placed the child above it)
        if ch.kind == "song":
            return ch.target in songs_done
        st = states.get(ACTIVITIES[ch.activity].skill) if ch.activity else None
        n = wins.get(ch.activity, 0)
        return n >= DONE_SUCCESSES or bool(st and st.difficulty >= DONE_DIFFICULTY and n >= 1)

    chapters = _chapters(lang_info(child.language).notes == "sargam")
    out, current = [], None
    for ch in chapters:
        is_done = done(ch)
        status = "done" if is_done else "current" if current is None else "upcoming"
        if status == "current":
            current = ch.id
        out.append({"id": ch.id, "level": ch.level, "title": ch.title, "icon": ch.icon, "kind": ch.kind, "target": ch.target,
                    "status": status, "song_title": SONGS[ch.target]["title"] if ch.kind == "song" else None})
    needed = engine.skills_needed_for_unlock(child, engine.skill_states(db, child))
    return {"level": child.current_level, "level_name": LEVELS[child.current_level]["name"], "current": current,
            "done": sum(c["status"] == "done" for c in out), "total": len(out), "chapters": out, "skills_to_show": needed}
