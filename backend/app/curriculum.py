"""Curriculum: levels, activity catalogue, song library and activity-instance generators.

Each generator returns a *full* spec (includes the answer, stored server-side) and the
`public_keys` that may be sent to the browser. Notes are MIDI numbers (C4 = 60).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Callable

SKILLS = ("pitch", "dynamics", "timbre", "rhythm", "melody", "creativity")
MODES = ("screen", "real", "listening", "practice")
TIMBRES = ("piano", "flute", "drum", "bell", "guitar")
# Harder to tell apart: introduced in the instrument game from difficulty 4 (all are synthesised in the app).
TIMBRES_MORE = ("violin", "sitar", "xylophone", "tabla", "santoor", "kalimba")

LEVELS: dict[int, dict] = {
    1: {"name": "Discover Music", "core_skills": ("pitch", "dynamics", "rhythm", "timbre")},
    2: {"name": "Play and Repeat", "core_skills": ("pitch", "rhythm", "melody")},
    3: {"name": "Create Music", "core_skills": ("melody", "rhythm", "creativity")},
    4: {"name": "Play Independently", "core_skills": ("melody", "rhythm")},
}
MAX_LEVEL = max(LEVELS)

# --- Song library (public-domain children's melodies; [midi, beats]) -------------------------
SONGS: dict[str, dict] = {
    "sargam": {
        "title": "Sa Re Ga Ma",
        "ease": 1,
        "notes": [[60, 1], [62, 1], [64, 1], [65, 1], [67, 1], [69, 1], [71, 1], [72, 2]],
        "phrases": [4, 8],
    },
    "hot_cross_buns": {
        "title": "Hot Cross Buns",
        "ease": 1,
        "notes": [[64, 1], [62, 1], [60, 2], [64, 1], [62, 1], [60, 2],
                  [60, 0.5], [60, 0.5], [60, 0.5], [60, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [62, 0.5],
                  [64, 1], [62, 1], [60, 2]],
        "phrases": [3, 6, 14, 17],
    },
    "mary_lamb": {
        "title": "Mary Had a Little Lamb",
        "ease": 2,
        "notes": [[64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [64, 1], [64, 2],
                  [62, 1], [62, 1], [62, 2], [64, 1], [67, 1], [67, 2],
                  [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [64, 1], [64, 1], [64, 1],
                  [62, 1], [62, 1], [64, 1], [62, 1], [60, 4]],
        "phrases": [7, 13, 21, 26],
    },
    "twinkle": {
        "title": "Twinkle Twinkle Little Star",
        "ease": 2,
        "notes": [[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
                  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
                  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
                  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2]],
        "phrases": [7, 14, 21, 28],
    },
    "ode_to_joy": {
        "title": "Ode to Joy",
        "ease": 3,
        "notes": [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
                  [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2]],
        "phrases": [8, 15],
    },
    "jingle_bells": {
        "title": "Jingle Bells",
        "ease": 3,
        "notes": [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2],
                  [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4]],
        "phrases": [6, 11],
    },
    "old_macdonald": {
        "title": "Old MacDonald",
        "ease": 3,
        "notes": [[67, 1], [67, 1], [67, 1], [62, 1], [64, 1], [64, 1], [62, 2],
                  [71, 1], [71, 1], [69, 1], [69, 1], [67, 3]],
        "phrases": [7, 12],
    },
    # --- Song school favourites (public domain / traditional) ---
    "happy_birthday": {
        "title": "Happy Birthday",
        "ease": 2,
        "tag": "celebration",
        "bpm": 96,
        "notes": [[67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
                  [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
                  [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
                  [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 2]],
        "phrases": [6, 12, 19, 25],
        "words": ["Hap", "py", "birth", "day", "to", "you", "Hap", "py", "birth", "day", "to", "you",
                  "Hap", "py", "birth", "day", "dear", "{name}", "", "Hap", "py", "birth", "day", "to", "you"],
    },
    "gayatri_mantra": {
        "title": "Gayatri Mantra",
        "ease": 2,
        "tag": "indian",
        "bpm": 66,
        "note": "A simple, calm chant tune on Sa Re Ga Ma Pa for small hands.",
        "notes": [[60, 2], [62, 1], [64, 1], [62, 1], [60, 3],
                  [60, 1], [62, 1], [64, 1], [64, 1], [65, 1], [64, 1], [62, 2],
                  [64, 1], [64, 1], [65, 1], [67, 1], [65, 1], [64, 1], [62, 1], [64, 2],
                  [64, 1], [62, 1], [62, 1], [60, 1], [62, 1], [64, 1], [62, 1], [60, 3]],
        "phrases": [5, 12, 20, 28],
        "words": ["Om", "bhur", "bhu", "vah", "svah",
                  "tat", "sa", "vi", "tur", "va", "reN", "yam",
                  "bhar", "go", "de", "va", "sya", "dhee", "ma", "hi",
                  "dhi", "yo", "yo", "nah", "pra", "cho", "da", "yaat"],
        "words_hi": ["ॐ", "भूर्", "भु", "वः", "स्वः",
                     "तत्", "स", "वि", "तुर्", "व", "रे", "ण्यं",
                     "भर्", "गो", "दे", "व", "स्य", "धी", "म", "हि",
                     "धि", "यो", "यो", "नः", "प्र", "चो", "द", "यात्"],
    },
    "mahamrityunjaya_mantra": {
        "title": "Mahamrityunjaya Mantra",
        "ease": 3,
        "tag": "indian",
        "bpm": 60,
        "note": "A slow, peaceful chant tune on Sa Re Ga Ma Pa, one line of the mantra per part.",
        "notes": [[60, 2], [62, 1], [64, 1], [64, 1], [62, 1], [64, 1], [62, 1], [60, 2],
                  [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [64, 2],
                  [64, 1], [64, 1], [62, 1], [62, 1], [60, 1], [62, 1], [64, 1], [62, 1], [60, 2],
                  [62, 1], [64, 1], [65, 1], [64, 1], [62, 1], [64, 1], [62, 1], [60, 3]],
        "phrases": [8, 16, 25, 33],
        "words": ["Om", "tryam", "ba", "kam", "ya", "ja", "ma", "he",
                  "su", "gan", "dhim", "push", "ti", "var", "dha", "nam",
                  "ur", "va", "ru", "ka", "mi", "va", "ban", "dha", "naan",
                  "mri", "tyor", "muk", "shee", "ya", "maa", "mri", "taat"],
        "words_hi": ["ॐ", "त्र्यम्", "ब", "कं", "य", "जा", "म", "हे",
                     "सु", "गन्", "धिं", "पुष्", "टि", "वर्", "ध", "नम्",
                     "उर्", "वा", "रु", "क", "मि", "व", "बन्", "ध", "नान्",
                     "मृ", "त्योर्", "मुक्", "षी", "य", "मा", "मृ", "तात्"],
    },
    "row_boat": {
        "title": "Row, Row, Row Your Boat",
        "ease": 2,
        "tag": "nursery",
        "bpm": 88,
        "notes": [[60, 1], [60, 1], [60, 0.75], [62, 0.25], [64, 1],
                  [64, 0.75], [62, 0.25], [64, 0.75], [65, 0.25], [67, 2],
                  [72, 1 / 3], [72, 1 / 3], [72, 1 / 3], [67, 1 / 3], [67, 1 / 3], [67, 1 / 3],
                  [64, 1 / 3], [64, 1 / 3], [64, 1 / 3], [60, 1 / 3], [60, 1 / 3], [60, 1 / 3],
                  [67, 0.75], [65, 0.25], [64, 0.75], [62, 0.25], [60, 2]],
        "phrases": [5, 10, 22, 27],
        "words": ["Row", "row", "row", "your", "boat", "gent", "ly", "down", "the", "stream",
                  "mer", "ri", "ly", "mer", "ri", "ly", "mer", "ri", "ly", "mer", "ri", "ly",
                  "life", "is", "but", "a", "dream"],
    },
    "london_bridge": {
        "title": "London Bridge",
        "ease": 2,
        "tag": "nursery",
        "bpm": 92,
        "notes": [[67, 1.5], [69, 0.5], [67, 1], [65, 1], [64, 1], [65, 1], [67, 2],
                  [62, 1], [64, 1], [65, 2], [64, 1], [65, 1], [67, 2],
                  [67, 1.5], [69, 0.5], [67, 1], [65, 1], [64, 1], [65, 1], [67, 2],
                  [62, 2], [67, 2], [64, 1], [60, 3]],
        "phrases": [7, 10, 13, 20, 24],
        "words": ["Lon", "don", "bridge", "is", "fall", "ing", "down", "fall", "ing", "down", "fall", "ing", "down",
                  "Lon", "don", "bridge", "is", "fall", "ing", "down", "my", "fair", "la", "dy"],
    },
}

# --- Alankars: classic sargam exercises (practice patterns, not songs) ---
_S = {60: "Sa", 62: "Re", 64: "Ga", 65: "Ma", 67: "Pa", 69: "Dha", 71: "Ni", 72: "Sa'"}
_S_HI = {60: "सा", 62: "रे", 64: "ग", 65: "म", 67: "प", 69: "ध", 71: "नि", 72: "सां"}
_SCALE = [60, 62, 64, 65, 67, 69, 71, 72]


def _alankar(title: str, notes: list[int], phrase_len: int, ease: int, bpm: int, beats: float = 1) -> dict:
    ends = list(range(phrase_len, len(notes), phrase_len)) + [len(notes)]
    return {"title": title, "ease": ease, "tag": "alankar", "bpm": bpm,
            "notes": [[n, beats if i < len(notes) - 1 else 2] for i, n in enumerate(notes)], "phrases": ends,
            "words": [_S[n] for n in notes], "words_hi": [_S_HI[n] for n in notes]}


SONGS["aaroh_avroh"] = _alankar("Aaroh & Avroh (up and down)", _SCALE + _SCALE[::-1][1:], 8, 1, 84)
SONGS["alankar_1"] = _alankar("Alankar 1: Sa Re Ga, Re Ga Ma",
                              [n for i in range(6) for n in _SCALE[i:i + 3]] + [n for i in range(6) for n in _SCALE[::-1][i:i + 3]], 9, 2, 88)
SONGS["alankar_2"] = _alankar("Alankar 2: Sa Sa, Re Re", [n for n in _SCALE for _ in (0, 1)], 8, 1, 96, 0.5)

# Words for the classic songs (public-domain lyrics), shown under the keys in the song school.
SONGS["sargam"]["words"] = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa"]
SONGS["sargam"]["tag"] = "indian"
SONGS["twinkle"]["words"] = ["Twin", "kle", "twin", "kle", "lit", "tle", "star", "how", "I", "won", "der", "what", "you", "are",
                             "up", "a", "bove", "the", "world", "so", "high", "like", "a", "dia", "mond", "in", "the", "sky"]
SONGS["hot_cross_buns"]["words"] = ["Hot", "cross", "buns", "hot", "cross", "buns", "one", "a", "pen", "ny", "two", "a", "pen", "ny",
                                    "hot", "cross", "buns"]
for _s in SONGS.values():
    _s.setdefault("tag", "nursery")
    assert not _s.get("words") or len(_s["words"]) == len(_s["notes"]), _s["title"]
    assert _s["phrases"][-1] == len(_s["notes"]), _s["title"]


@dataclass(frozen=True)
class ActivityDef:
    type: str
    skill: str
    min_level: int
    modes: tuple[str, ...]
    is_game: bool
    generate: Callable[[int, random.Random], dict]
    public_keys: tuple[str, ...] = field(default=())
    uses_note_input: bool = False
    topic_only: bool = False  # only in Music Basics practice, not in regular lessons


def _clamp_d(d: int) -> int:
    return max(1, min(5, int(d)))


# --- Generators --------------------------------------------------------------------------------
def gen_high_low(d: int, rng: random.Random) -> dict:
    interval = {1: 12, 2: 7, 3: 4, 4: 2, 5: 1}[_clamp_d(d)]
    base = rng.randint(53, 72 - interval)
    pair = [base, base + interval]
    rng.shuffle(pair)
    question = rng.choice(["higher", "lower"])
    answer = pair.index(max(pair)) if question == "higher" else pair.index(min(pair))
    return {"notes": pair, "question": question, "answer": answer}


def gen_loud_soft(d: int, rng: random.Random) -> dict:
    gap_db = {1: 18, 2: 12, 3: 8, 4: 5, 5: 3}[_clamp_d(d)]
    loud = 0.9
    soft = round(loud * 10 ** (-gap_db / 20), 4)
    gains = [loud, soft]
    rng.shuffle(gains)
    question = rng.choice(["louder", "softer"])
    answer = gains.index(max(gains)) if question == "louder" else gains.index(min(gains))
    return {"note": rng.choice([60, 64, 67]), "gains": gains, "question": question, "answer": answer}


def gen_instrument_guess(d: int, rng: random.Random) -> dict:
    n = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5}[_clamp_d(d)]
    pool = list(TIMBRES) + (list(TIMBRES_MORE) if _clamp_d(d) >= 4 else [])
    options = rng.sample(pool, n)
    target = rng.randrange(n)
    return {"options": options, "play": options[target], "note": 67, "answer": target}


RHYTHM_POOL: dict[int, list[list[float]]] = {
    1: [[0, 1, 2, 3], [0, 1, 2]],
    2: [[0, 1, 2, 2.5, 3], [0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 3]],
    3: [[0, 0.5, 1, 2, 2.5, 3], [0, 1, 1.5, 2, 2.5, 3], [0, 2, 3, 3.5]],
    4: [[0, 0.5, 1, 1.5, 2, 3], [0, 1.5, 2, 3, 3.5], [0, 0.5, 1.5, 2, 3]],
    5: [[0, 0.5, 1, 1.5, 2.5, 3, 3.5], [0, 0.75, 1.5, 2, 3, 3.5], [0, 0.5, 1.5, 2.5, 3]],
}


def gen_rhythm_tap(d: int, rng: random.Random) -> dict:
    d = _clamp_d(d)
    return {
        "pattern": rng.choice(RHYTHM_POOL[d]),
        "bpm": {1: 80, 2: 88, 3: 96, 4: 100, 5: 108}[d],
        "tolerance_ms": {1: 230, 2: 190, 3: 160, 4: 130, 5: 110}[d],
    }


FIND_NOTE_KEYS = {
    1: [60, 67],
    2: [60, 62, 64],
    3: [60, 62, 64, 65, 67],
    4: [60, 62, 64, 65, 67, 69, 71, 72],
    5: list(range(60, 73)),
}


def gen_find_note(d: int, rng: random.Random) -> dict:
    d = _clamp_d(d)
    keys = FIND_NOTE_KEYS[d]
    return {"keys": keys, "target": rng.choice(keys), "tries": {1: 3, 2: 3, 3: 2, 4: 2, 5: 1}[d], "highlight": d <= 3}


def _melody(length: int, pool: list[int], rng: random.Random) -> list[int]:
    idx = rng.randrange(len(pool))
    out = [pool[idx]]
    for _ in range(length - 1):
        idx = max(0, min(len(pool) - 1, idx + rng.choice([-2, -1, -1, 1, 1, 2, 0])))
        out.append(pool[idx])
    return out


ECHO_POOLS = {1: [60, 62, 64], 2: [60, 62, 64], 3: [60, 62, 64, 65, 67], 4: [60, 62, 64, 67, 69, 72], 5: [60, 62, 64, 65, 67, 69, 71, 72]}


def gen_same_different(d: int, rng: random.Random) -> dict:
    d = _clamp_d(d)
    length = {1: 2, 2: 3, 3: 3, 4: 4, 5: 5}[d]
    a = _melody(length, ECHO_POOLS[max(3, d)], rng)
    same = rng.random() < 0.5
    b = list(a)
    if not same:
        i = rng.randrange(length)
        shift = {1: 7, 2: 5, 3: 4, 4: 2, 5: 1}[d] * rng.choice([-1, 1])
        b[i] = max(48, min(84, b[i] + shift))
    return {"a": a, "b": b, "answer": 0 if same else 1, "options": ["same", "different"]}


def gen_echo_melody(d: int, rng: random.Random) -> dict:
    d = _clamp_d(d)
    length = {1: 2, 2: 3, 3: 4, 4: 5, 5: 6}[d]
    notes = _melody(length, ECHO_POOLS[d], rng)
    return {"notes": notes, "bpm": 84, "keys": sorted(set(ECHO_POOLS[d])), "highlight": d <= 2}


def gen_play_song(d: int, rng: random.Random, song_id: str | None = None) -> dict:
    d = _clamp_d(d)
    max_ease = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3}[d]
    candidates = [k for k, s in SONGS.items() if s["ease"] <= max_ease and s.get("tag") != "alankar"]
    sid = song_id if song_id in SONGS else rng.choice(candidates)
    song = SONGS[sid]
    phrase_count = {1: 1, 2: 1, 3: 2, 4: len(song["phrases"]), 5: len(song["phrases"])}[d]
    end = song["phrases"][min(phrase_count, len(song["phrases"])) - 1]
    part = song["notes"][:end]
    return {
        "song_id": sid,
        "title": song["title"],
        "notes": [n for n, _ in part],
        "beats": [b for _, b in part],
        "bpm": 80 if d <= 3 else 92,
        "guided": d != 3 and d != 5,  # 3 and 5: only first note hinted
        "full_song": end == len(song["notes"]),
    }


def gen_fast_slow(d: int, rng: random.Random) -> dict:
    """The same little tune twice, once faster: which one is faster / slower (tempo)?"""
    ratio = {1: 2.0, 2: 1.7, 3: 1.45, 4: 1.3, 5: 1.18}[_clamp_d(d)]
    slow = rng.choice([66, 72, 80])
    bpms = [round(slow * ratio), slow]
    rng.shuffle(bpms)
    question = rng.choice(["faster", "slower"])
    answer = bpms.index(max(bpms)) if question == "faster" else bpms.index(min(bpms))
    return {"notes": _melody(5, [60, 62, 64, 65, 67], rng), "bpms": bpms, "question": question, "answer": answer}


def gen_free_play(d: int, rng: random.Random) -> dict:
    return {"seconds": 20, "keys": [60, 62, 64, 67, 69, 72], "theme": rng.choice(["rain", "birds", "elephant", "dance"])}


ALL_MODES = ("screen", "real", "listening", "practice")
ACTIVITIES: dict[str, ActivityDef] = {
    a.type: a
    for a in [
        ActivityDef("high_low", "pitch", 1, ("screen", "real", "listening"), False, gen_high_low, ("notes", "question")),
        ActivityDef("loud_soft", "dynamics", 1, ("screen", "real", "listening"), False, gen_loud_soft, ("note", "gains", "question")),
        ActivityDef("instrument_guess", "timbre", 1, ALL_MODES, True, gen_instrument_guess, ("options", "play", "note")),
        ActivityDef("rhythm_tap", "rhythm", 1, ALL_MODES, False, gen_rhythm_tap, ("pattern", "bpm")),
        ActivityDef("find_note", "pitch", 1, ("screen", "real", "practice"), False, gen_find_note, ("keys", "target", "tries", "highlight"), True),
        ActivityDef("same_different", "melody", 2, ("screen", "listening"), False, gen_same_different, ("a", "b", "options")),
        ActivityDef("echo_melody", "melody", 2, ("screen", "real", "practice"), False, gen_echo_melody, ("notes", "bpm", "keys", "highlight"), True),
        ActivityDef("play_song", "melody", 2, ("screen", "real", "practice"), False, gen_play_song,
                    ("song_id", "title", "notes", "beats", "bpm", "guided", "full_song"), True),
        ActivityDef("free_play", "creativity", 3, ("screen", "real"), True, gen_free_play, ("seconds", "keys", "theme"), True),
        ActivityDef("fast_slow", "rhythm", 1, ("screen", "real", "listening", "practice"), False, gen_fast_slow,
                    ("notes", "bpms", "question"), topic_only=True),
    ]
}

THEMES_FOR_BASICS = ("animals", "rain", "space", "jungle")

# Music Basics: each topic practises a focused set of activities (scored like any lesson).
TOPICS: dict[str, dict] = {
    "swars": {"skill": "pitch", "activities": ("find_note", "echo_melody")},
    "rhythm": {"skill": "rhythm", "activities": ("rhythm_tap",)},
    "high_low": {"skill": "pitch", "activities": ("high_low",)},
    "loud_soft": {"skill": "dynamics", "activities": ("loud_soft",)},
    "fast_slow": {"skill": "rhythm", "activities": ("fast_slow",)},
    "instruments": {"skill": "timbre", "activities": ("instrument_guess",)},
    "ear": {"skill": "melody", "activities": ("same_different", "echo_melody")},
}


def topic_activities(topic: str, mode: str) -> list[ActivityDef]:
    acts = [ACTIVITIES[t] for t in TOPICS[topic]["activities"]]
    return [a for a in acts if mode in a.modes] or acts


def public_spec(activity_type: str, full: dict) -> dict:
    keys = ACTIVITIES[activity_type].public_keys
    out = {k: full[k] for k in keys if k in full}
    for flag in ("retry", "stretch"):
        if full.get(flag):
            out[flag] = True
    return out


def age_adjust(activity_type: str, spec: dict, age: int) -> dict:
    """Small hands and young ears get more room: wider rhythm timing for the youngest children."""
    if activity_type == "rhythm_tap" and age <= 5 and "tolerance_ms" in spec:
        spec = {**spec, "tolerance_ms": round(spec["tolerance_ms"] * (1.45 if age <= 4 else 1.2))}
    return spec


def scaffold(activity_type: str, spec: dict) -> dict:
    """The same item again after a miss, with more help (slower, keys shown, an extra try)."""
    out = {**(spec or {}), "retry": 1}
    if activity_type == "echo_melody":
        out.update(highlight=True, bpm=min(out.get("bpm", 84), 72))
    elif activity_type == "find_note":
        out.update(highlight=True, tries=max(out.get("tries", 2), 3))
    elif activity_type == "rhythm_tap":
        out.update(bpm=round(out["bpm"] * 0.85), tolerance_ms=round(out["tolerance_ms"] * 1.25))
    return out


def level_activities(level: int, mode: str) -> list[ActivityDef]:
    return [a for a in ACTIVITIES.values() if a.min_level <= level and mode in a.modes and not a.topic_only]
