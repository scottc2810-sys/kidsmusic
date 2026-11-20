"""Music Basics progression: topic tiers and exercises that grow with the child.

* Each topic has a tier (1-3) earned from the child's mastery of its skill. Higher tiers unlock
  more material in the app (upper/lower saptak, komal/tivra swars, faster rhythms, more taals).
* New sargam exercises are made for the child as they progress: by the AI brain (Claude Code /
  Claude API, when the parent allowed Cloud AI), by Claude Code over MCP (`add_exercise`), or by
  an offline pattern generator. Every exercise is validated against the child's tier range, and
  the words shown under the keys are always computed here from the notes (never AI text).
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .curriculum import TOPICS
from .models import Child, CustomExercise, SkillState
from .teacher.safety import clean_child_text

# skill backing each Basics topic (topics without a scored drill still earn tiers from their skill)
TOPIC_SKILL = {**{k: v["skill"] for k, v in TOPICS.items()}, "taal": "rhythm", "alankars": "melody"}
EXERCISE_TOPICS = ("swars", "alankars")

# (mastery, scored attempts) needed for tier 2 and tier 3
TIER_RULES = {2: (0.55, 5), 3: (0.75, 10)}
# ...or the child is already succeeding at this difficulty (they knew it, or learn fast)
TIER_DIFFICULTY = {2: 3, 3: 4}

# swar name -> midi, per tier (Sa = C4 = 60). "'" = taar (upper) saptak, "." prefix = mandra (lower).
_T1 = {"Sa": 60, "Re": 62, "Ga": 64, "Ma": 65, "Pa": 67, "Dha": 69, "Ni": 71, "Sa'": 72}
_T2 = {**_T1, ".Pa": 55, ".Dha": 57, ".Ni": 59, "Re'": 74, "Ga'": 76, "Ma'": 77, "Pa'": 79}
_T3 = {**_T2, "re(k)": 61, "ga(k)": 63, "Ma(t)": 66, "dha(k)": 68, "ni(k)": 70}
SWARS_FOR_TIER = {1: _T1, 2: _T2, 3: _T3}
_MIDI_TO_SWAR = {m: s for s, m in _T3.items()}
_HI = {"Sa": "सा", "Re": "रे", "Ga": "ग", "Ma": "म", "Pa": "प", "Dha": "ध", "Ni": "नि"}
_KOMAL = {"re(k)": "Re", "ga(k)": "Ga", "dha(k)": "Dha", "ni(k)": "Ni"}
BEAT_CHOICES = (0.5, 1, 1.5, 2, 3)
# Thaats (parent scales) used to introduce komal and tivra swars at tier 3
THAATS = {
    "Bilawal": [60, 62, 64, 65, 67, 69, 71, 72],
    "Yaman (Kalyan)": [60, 62, 64, 66, 67, 69, 71, 72],  # tivra Ma
    "Kafi": [60, 62, 63, 65, 67, 69, 70, 72],  # komal Ga, komal Ni
    "Bhairav": [60, 61, 64, 65, 67, 68, 71, 72],  # komal Re, komal Dha
}
MIN_NOTES, MAX_NOTES = 4, 32


def topic_tier(st: SkillState | None) -> int:
    if st is None:
        return 1
    tier = 1
    for t, (mastery, attempts) in sorted(TIER_RULES.items()):
        proven = st.difficulty >= TIER_DIFFICULTY[t] and st.mastery >= 0.5
        if (st.mastery >= mastery and st.attempts >= attempts) or proven:
            tier = t
    return tier


def tiers_for(db: Session, child: Child) -> dict[str, dict]:
    states = {s.skill: s for s in db.scalars(select(SkillState).where(SkillState.child_id == child.id))}
    out = {}
    for topic, skill in TOPIC_SKILL.items():
        st = states.get(skill)
        tier = topic_tier(st)
        nxt = TIER_RULES.get(tier + 1)
        out[topic] = {
            "tier": tier, "skill": skill, "mastery": round(st.mastery, 3) if st else 0.0, "attempts": st.attempts if st else 0,
            "next": {"tier": tier + 1, "mastery": nxt[0], "attempts": nxt[1]} if nxt else None,
        }
    return out


def swar_label(midi: int, lang: str) -> str:
    """Child-facing name: Latin sargam, or Devanagari for Hindi; ' = upper, . = lower, ♭ komal, ♯ tivra."""
    name = _MIDI_TO_SWAR.get(midi)
    if name is None:
        return "?"
    mark = "♭" if "(k)" in name else "♯" if "(t)" in name else ""
    base = _KOMAL.get(name) or name.replace("(t)", "").strip(".'")  # e.g. "Re", "Ma"
    if lang == "hi":
        word = _HI.get(base, base)
        if name.endswith("'"):
            word += "ं"  # सां, रें: taar (upper) saptak
        return ("." if name.startswith(".") else "") + word + mark  # .प = mandra (lower) saptak
    return ("." if name.startswith(".") else "") + base + ("'" if name.endswith("'") else "") + mark


@dataclass
class Exercise:
    title: str
    notes: list[list[float]]  # [[midi, beats], ...]
    phrases: list[int]
    intro: str | None
    bpm: int


def validate(swars: list[str] | None, midis: list[int] | None, beats: list[float] | None, phrase_length: int, tier: int,
             title: str, intro: str | None) -> Exercise:
    """Turn swar names (or MIDI) into a safe exercise inside the tier's range. Raises ValueError."""
    allowed = SWARS_FOR_TIER[max(1, min(3, tier))]
    if swars is not None:
        unknown = [s for s in swars if s not in allowed]
        if unknown:
            raise ValueError(f"swars not available at tier {tier}: {unknown[:5]} (allowed: {list(allowed)})")
        notes = [allowed[s] for s in swars]
    else:
        notes = [int(m) for m in (midis or [])]
        bad = [m for m in notes if m not in allowed.values()]
        if bad:
            raise ValueError(f"notes outside the tier {tier} range: {bad[:5]}")
    if not MIN_NOTES <= len(notes) <= MAX_NOTES:
        raise ValueError(f"an exercise needs {MIN_NOTES}-{MAX_NOTES} notes")
    bts = list(beats or [1] * len(notes))
    if len(bts) != len(notes):
        raise ValueError("beats must have one value per note")
    bts = [min(BEAT_CHOICES, key=lambda c: abs(c - float(b))) for b in bts]  # snap to child-friendly lengths
    pl = max(3, min(12, int(phrase_length or 8)))
    ends = list(range(pl, len(notes), pl)) + [len(notes)]
    if len(ends) > 1 and ends[-1] - ends[-2] < 2:  # no 1-note tail phrase
        ends.pop(-2)
    clean_title = clean_child_text(title, 60) or "Sargam exercise"  # the child sees the title
    clean_intro = clean_child_text(intro) if intro else None
    return Exercise(clean_title, [[n, b] for n, b in zip(notes, bts)], ends, clean_intro, 84 if tier == 1 else 92)


def offline_exercise(tier: int, rng: random.Random, number: int) -> Exercise:
    """Classic alankar shapes over the tier's range (no AI needed)."""
    prefix = ""
    if tier >= 3:
        # komal/tivra swars are taught through a thaat (parent scale), never as a chromatic run
        prefix, span = rng.choice(list(THAATS.items()))
        prefix += " "
    else:
        scale = sorted(m for m in SWARS_FOR_TIER[tier].values())
        span = scale[scale.index(60):] if tier == 1 else scale
    shape = rng.choice(["steps3", "skip", "pairs", "zigzag", "four"])
    up: list[int] = []
    n = len(span)
    if shape == "steps3":
        for i in range(min(n - 2, 6)):
            up += span[i:i + 3]
        name = "Steps of three"
    elif shape == "skip":
        for i in range(min(n - 2, 6)):
            up += [span[i], span[i + 2]]
        name = "Skipping swars"
    elif shape == "pairs":
        for m in span[:8]:
            up += [m, m]
        name = "Double swars"
    elif shape == "zigzag":
        for i in range(min(n - 1, 7)):
            up += [span[i + 1], span[i]]
        name = "Zig-zag"
    else:
        for i in range(min(n - 3, 5)):
            up += span[i:i + 4]
        name = "Steps of four"
    notes = (up + up[::-1])[:MAX_NOTES]
    plen = 3 if shape == "steps3" else 4 if shape in ("four", "skip", "zigzag") else 8
    return validate(None, notes, None, plen * 2 if plen < 6 else plen, 3, f"{prefix}{name} #{number}", None)


def exercise_count(db: Session, child: Child) -> int:
    return len(db.scalars(select(CustomExercise.id).where(CustomExercise.child_id == child.id)).all())


def save(db: Session, child: Child, topic: str, tier: int, ex: Exercise, source: str) -> CustomExercise:
    row = CustomExercise(child_id=child.id, topic=topic, tier=tier, title=ex.title, notes=ex.notes, phrases=ex.phrases,
                         intro=ex.intro, bpm=ex.bpm, source=source)
    db.add(row)
    db.flush()
    return row


def as_song(row: CustomExercise) -> dict:
    """Same shape as curriculum.SONGS entries, so the song school can teach it."""
    return {"title": row.title, "ease": row.tier, "tag": "claude" if row.source != "offline" else "alankar", "bpm": row.bpm,
            "notes": row.notes, "phrases": row.phrases, "note": row.intro, "source": row.source,
            "words": [swar_label(int(n), "en") for n, _ in row.notes], "words_hi": [swar_label(int(n), "hi") for n, _ in row.notes]}


def custom_songs(db: Session, child: Child) -> dict[str, dict]:
    rows = db.scalars(select(CustomExercise).where(CustomExercise.child_id == child.id).order_by(CustomExercise.created_at))
    return {f"x_{r.id}": as_song(r) for r in rows}
