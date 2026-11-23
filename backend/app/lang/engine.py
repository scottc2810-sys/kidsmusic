"""Adaptive language teaching: what to practise next, how hard, and how each answer is judged.

Same teaching rules as the music lessons, per language and per skill (listen, speak, read, write):
* placement: while a skill is new and every answer is right, each success steps the difficulty up,
  so a child who already knows the language is not kept on first words;
* afterwards two successes in a row step up, two misses in a row step down;
* a missed word comes back straight away in an easier form (re-teach), and two misses in a row
  are followed by an easy, well-known word so the child gets a success (comfort);
* every word has its own memory strength, so practice is personal: weak and new words come up
  more, known words less; a new tier of words opens when most of the current one is known;
* "could not hear" is never a mistake;
* a child who keeps missing gets *errorless* turns: the right answer glows, they succeed, and the help
  fades again as soon as they get one on their own (that is how special-needs teachers rebuild confidence);
* a new sitting starts with a warm-up on something the child already knows, then moves on;
* earned stages and opened words are never taken away: the working difficulty may ease for a while,
  but the stage shown is the highest the child has really reached.
Pure functions over the ORM rows; deterministic for a given random.Random.
"""
from __future__ import annotations

import difflib
import random
import re
import unicodedata
from dataclasses import dataclass, field

from ..models import LangItemState, LangSkillState
from .content import BARAKHADI, LETTERS, MAX_TIER, NO_SPACES, TARGETS, WORDS, Word
from .phrases import ITEMS, PHRASE_TOPICS, PHRASE_WORDS, REPLIES, TOPIC_IDS, TOPIC_OF, is_topic, topic_pool

SKILLS = ("listen", "speak", "read", "write")
ALPHA = 0.3
STREAK_UP = 2
FAILS_DOWN = 2
PLACEMENT_ATTEMPTS = 4
PLACEMENT_MAX_DIFFICULTY = 4
KNOWN = 0.6  # a word with this strength counts as known
TIER_OPEN_SHARE = 0.75  # share of a tier's words known before the next tier opens
ONCE_KNOWN = (2, 0.25)  # right at least twice and not fully forgotten: still counts for opening tiers
ERRORLESS_AFTER = 3  # misses in a row before the answer glows
REACHED_SUCCESSES = 2  # successes at a difficulty before that stage counts as reached for good
STAGES = ("New", "Starter", "Explorer", "Speaker", "Reader", "Star")  # index = stage 0-5 on the speak-read-write scale
REPLY_SHARE = 0.4  # at the top level, this share of listen / read / speak turns are little conversations

# The journey from first sounds to little conversations: what each stage teaches in every skill, and
# what a parent or teacher can do at home. Stage n is reached when every skill works at difficulty n.
JOURNEY: list[dict] = [
    {"stage": 1, "emoji": "🌱", "title": "Sound Seeker",
     "listen": "hears a word and finds its picture (2 choices)", "read": "finds the first letters by their sound",
     "write": "traces letters over a guide", "speak": "repeats a word after Melo",
     "home": "Point at things at home and say their names in {lang}. Clap once for every word."},
    {"stage": 2, "emoji": "🔤", "title": "Letter Explorer",
     "listen": "picks from 3 pictures", "read": "reads picture words with a reading help; letter + vowel sign (barakhadi) in Indian scripts",
     "write": "traces letters and syllables without a guide", "speak": "repeats short words clearly",
     "home": "Play 'I spy' with the first sound of a word. Write one letter in the air together."},
    {"stage": 3, "emoji": "🧱", "title": "Word Builder",
     "listen": "4 pictures, the word is not shown", "read": "reads words without the reading help",
     "write": "builds words from letter tiles", "speak": "says a word from its picture, without hearing it first",
     "home": "Ask for things at snack time in {lang} only (milk, water, apple). Praise every try."},
    {"stage": 4, "emoji": "📖", "title": "Sentence Reader",
     "listen": "tells apart words of the same group", "read": "sees a picture and finds the written word",
     "write": "builds words with extra letters that do not belong", "speak": "says phrases and short sentences",
     "home": "Read one short sentence a day from a picture book; let the child point to each word."},
    {"stage": 5, "emoji": "🏆", "title": "Little Pro",
     "listen": "hears a question and picks the right answer", "read": "reads a question and picks the reply",
     "write": "builds whole sentences from word tiles", "speak": "answers Melo's question out loud",
     "home": "Have a 2-minute talk in {lang} every day: hello, how are you, what is your name, goodbye."},
]


@dataclass
class Activity:
    type: str  # listen_pick | read_pick | letter_sound | say_word | trace | spell
    skill: str
    difficulty: int
    spec: dict  # full spec including the answer (kept on the server)
    events: list[str] = field(default_factory=list)

    @property
    def public(self) -> dict:
        return {k: v for k, v in self.spec.items() if k not in ("answer", "item")}


@dataclass
class Result:
    outcome: str  # success | partial | miss | uncertain | skipped
    score: float
    detail: dict = field(default_factory=dict)


# --- helpers -----------------------------------------------------------------------------------
TAMIL_PULLI = chr(0x0BCD)  # Tamil writes the dead consonant on its own (க்க), so it does not join the next letter


def _joins_next(piece: str) -> bool:
    """A piece ending in a virama (any Indian script) joins the next consonant into a conjunct (क्ष, ক্ষ, ಕ್ಕ)."""
    last = piece[-1]
    return unicodedata.combining(last) == 9 and last != TAMIL_PULLI


def clusters(text: str) -> list[str]:
    """Split a word into the pieces a child writes one at a time (a letter with its marks;
    conjuncts in Indian scripts stay together)."""
    joiners = (chr(0x200D), chr(0x200C))
    out: list[str] = []
    for ch in text:
        # marks and joiners attach to the letter before; after a virama the next consonant joins too
        if out and (unicodedata.category(ch).startswith("M") or ch in joiners or (_joins_next(out[-1]) and not ch.isspace())):
            out[-1] += ch
        else:
            out.append(ch)
    return out


def normalise(text: str) -> str:
    """Compare what was heard with what was expected: case, accents-as-typed, punctuation and spaces ignored."""
    t = unicodedata.normalize("NFKC", text).casefold()
    return re.sub(r"[\W_]+", "", t, flags=re.UNICODE)


def once_known(item: LangItemState | None) -> bool:
    """Known now, or learned before and only a little rusty: an opened tier stays open."""
    return bool(item) and (item.strength >= KNOWN or (item.correct >= ONCE_KNOWN[0] and item.strength >= ONCE_KNOWN[1]))


def open_tier(items: dict[str, LangItemState], lang: str) -> int:
    tier = 1
    words = WORDS[lang]
    while tier < MAX_TIER:
        in_tier = [w for w in words.values() if w.tier == tier]
        known = sum(1 for w in in_tier if once_known(items.get(w.id)))
        if known < len(in_tier) * TIER_OPEN_SHARE:
            break
        tier += 1
    return tier


def stage(st: LangSkillState | None) -> int:
    """0-5 on the scale: 0 not started, then the difficulty the child is working at."""
    return 0 if st is None or st.attempts == 0 else st.difficulty


def summary(lang: str, skills: dict[str, LangSkillState], items: dict[str, LangItemState], speech: bool = True,
            reached: dict[str, int] | None = None) -> dict:
    """`reached`: per skill, the highest difficulty with REACHED_SUCCESSES successes (from the attempt history).
    The stage shown never drops below it, even while the working difficulty eases after a hard patch."""
    reached = reached or {}
    stages = {s: max(stage(skills.get(s)), reached.get(s, 0)) for s in SKILLS}
    counted = [s for s in SKILLS if speech or s != "speak"]
    overall = min(stages[s] for s in counted)
    started = [s for s in counted if stages[s] > 0]
    focus = min(counted, key=lambda s: (stages[s], skills[s].mastery if s in skills else 0.0))
    t = TARGETS[lang]
    return {
        "language": {"code": t.code, "name": t.name, "native": t.native, "flag": t.flag, "rtl": t.rtl, "locale": t.locale, "latin": t.latin},
        "skills": {s: {"stage": stages[s], "stage_name": STAGES[stages[s]], "mastery": round(skills[s].mastery, 3) if s in skills else 0.0,
                       "attempts": skills[s].attempts if s in skills else 0, "working": stage(skills.get(s))} for s in SKILLS},
        "stage": overall, "stage_name": STAGES[overall], "next_stage": min(5, overall + 1),
        "words_known": sum(1 for k, i in items.items() if i.strength >= KNOWN and k in WORDS[lang]), "words_total": len(WORDS[lang]),
        "phrases_known": sum(1 for k, i in items.items() if i.strength >= KNOWN and k in PHRASE_WORDS[lang]), "phrases_total": len(PHRASE_WORDS[lang]),
        "tier": open_tier(items, lang), "focus": focus, "started": bool(started),
        "barakhadi": lang in BARAKHADI,
        "journey": [{**j, "home": j["home"].replace("{lang}", t.name), "reached": overall >= j["stage"],
                     "current": j["stage"] == min(5, overall + 1)} for j in JOURNEY],
        "topics": [{"id": tid, "emoji": emoji, "title": title, "total": 5,
                    "known": sum(1 for pid, top in TOPIC_OF.items() if top == tid and items.get(pid) and items[pid].strength >= KNOWN)}
                   for tid, emoji, title in PHRASE_TOPICS],
    }


# --- choosing the next activity -----------------------------------------------------------------
def _pick_word(lang: str, items: dict[str, LangItemState], rng: random.Random, *, easy: bool = False, single: bool = False,
               avoid: str | None = None, small: bool = False) -> Word:
    """`small`: the child is struggling, so work on a tiny set of words until they stick (2 instead of 3 open at once)."""
    tier = open_tier(items, lang)
    pool = [w for w in WORDS[lang].values() if w.tier <= tier and w.id != avoid and (not single or " " not in w.text)]
    seen = [w for w in pool if items.get(w.id) and items[w.id].seen > 0]
    shaky = [w for w in seen if items[w.id].strength < KNOWN]
    if easy:
        known = [w for w in pool if items.get(w.id) and items[w.id].strength >= KNOWN]
        if known:
            return rng.choice(known)
        # nothing known yet: the word the child is closest to knowing, never yet another new word
        if shaky:
            return max(shaky, key=lambda w: (items[w.id].strength, items[w.id].correct, rng.random()))
        return rng.choice([w for w in pool if w.tier == 1] or pool)
    fresh = [w for w in pool if w not in seen]
    # one new word at a time: introduce another only when few words are still shaky
    if fresh and (len(shaky) < (2 if small else 3) or not seen):
        if rng.random() < 0.5 or not seen:
            return min(fresh, key=lambda w: (w.tier, rng.random()))
    weights = [0.15 + (1 - items[w.id].strength) * (2.0 if w.tier == tier else 1.0) for w in seen]
    return rng.choices(seen, weights=weights, k=1)[0] if seen else rng.choice(pool)


def _options(lang: str, word: Word, n: int, items: dict[str, LangItemState], rng: random.Random, hard: bool) -> list[Word]:
    tier = open_tier(items, lang)
    others = [w for w in WORDS[lang].values() if w.id != word.id and w.tier <= tier]
    same = [w for w in others if w.tier == word.tier]
    pool = same if hard and len(same) >= n - 1 else others
    opts = rng.sample(pool, min(n - 1, len(pool))) + [word]
    rng.shuffle(opts)
    return opts


def _pick_from(pool: list[Word], items: dict[str, LangItemState], rng: random.Random, *, easy: bool = False, avoid: str | None = None) -> Word:
    """Personal choice inside a fixed set (a conversation topic): new and shaky items first."""
    choices = [w for w in pool if w.id != avoid] or pool
    if easy:
        known = [w for w in choices if items.get(w.id) and items[w.id].strength >= KNOWN]
        return rng.choice(known or choices)
    weights = [0.2 + (1 - items[w.id].strength if items.get(w.id) else 1.3) for w in choices]
    return rng.choices(choices, weights=weights, k=1)[0]


def pieces(text: str, lang: str) -> tuple[list[str], str]:
    """What a child puts in order to write `text`, and how the pieces join: the words of a phrase
    (characters for Chinese and Cantonese, which have no spaces), or the letters of a single word."""
    strip = "".join(chr(c) for c in range(0x2000, 0x2070)) + ".,!?;:¿¡、。，！？：；،؟«»।॥\"'()"
    if lang in NO_SPACES:
        return [c for c in text if c.strip() and unicodedata.category(c)[0] not in "PZ"], ""
    words = [w.strip(strip) for w in text.split()]
    words = [w for w in words if w]
    if len(words) > 1:
        return words, " "
    return clusters(words[0] if words else text), ""


def build(lang: str, word: Word, skill: str, d: int, pool: list[Word], rng: random.Random, *, hint: bool, events: list[str] | None = None) -> Activity:
    """One activity about `word` (a picture word or a phrase), with choices drawn from `pool`."""
    events = events or []
    others = [w for w in pool if w.id != word.id]
    if skill in ("listen", "read"):
        n = {1: 2, 2: 3}.get(d, 4) if skill == "listen" else (3 if d <= 2 else 4)
        opts = rng.sample(others, min(n - 1, len(others))) + [word]
        rng.shuffle(opts)
        if skill == "listen":
            return Activity("listen_pick", skill, d, {"item": word.id, "word": word.text, "roman": word.roman if hint else None, "show_word": d <= 1,
                                                       "options": [{"emoji": o.emoji} for o in opts], "answer": opts.index(word)}, events)
        if d >= 4:
            spec = {"item": word.id, "prompt": {"emoji": word.emoji}, "options": [{"text": o.text} for o in opts], "answer": opts.index(word)}
        else:
            spec = {"item": word.id, "prompt": {"text": word.text, "roman": word.roman if hint else None},
                    "options": [{"emoji": o.emoji} for o in opts], "answer": opts.index(word)}
        return Activity("read_pick", skill, d, spec, events)
    if skill == "speak":
        return Activity("say_word", skill, d, {"item": word.id, "word": word.text, "roman": word.roman if (hint or d <= 3) else None,
                                               "emoji": word.emoji, "model": d <= 2, "show_word": d <= 3, "answer": word.text}, events)
    parts, joiner = pieces(word.text, lang)
    tiles = list(parts)
    if d >= 4 or len(parts) < 2:  # pieces that do not belong, so the child really has to choose
        spare = {p for w in others for p in pieces(w.text, lang)[0] if p not in parts}
        if joiner == "" and lang not in NO_SPACES:
            spare = {x.lower() if TARGETS[lang].latin else x for x in LETTERS[lang]} - set(parts)
        tiles += rng.sample(sorted(spare), min(2, len(spare)))
    rng.shuffle(tiles)
    return Activity("spell", skill, d, {"item": word.id, "emoji": word.emoji, "tiles": tiles, "length": len(parts), "joiner": joiner,
                                        "hear": word.text, "show_text": word.text if d <= 2 else None, "roman": word.roman if hint else None,
                                        "answer": word.text}, events)


def reply_activity(lang: str, skill: str, d: int, items: dict[str, LangItemState], rng: random.Random, events: list[str],
                   question_id: str | None = None) -> Activity:
    """Top level: a little conversation. Melo asks a question in the language; the child picks the reply
    (listen: heard only; read: the question is written) or answers out loud (speak)."""
    phrases = PHRASE_WORDS[lang]
    if question_id not in REPLIES:
        # questions whose reply is not yet known come up more
        qs = list(REPLIES)
        weights = [0.3 + (1 - (items[REPLIES[q]].strength if items.get(REPLIES[q]) else 0.0)) for q in qs]
        question_id = rng.choices(qs, weights=weights, k=1)[0]
    q, a = phrases[question_id], phrases[REPLIES[question_id]]
    if skill == "speak":
        return Activity("say_word", skill, d, {"item": a.id, "question_item": q.id, "question": q.text, "q_roman": q.roman, "word": a.text, "roman": None, "emoji": a.emoji,
                                               "model": False, "show_word": False, "answer": a.text}, events + ["conversation"])
    others = [w for w in phrases.values() if w.id not in (a.id, question_id) and w.text != a.text]
    opts = rng.sample(others, 2 if d < 5 else 3) + [a]
    rng.shuffle(opts)
    return Activity("reply_pick", skill, d, {"item": a.id, "question_item": q.id, "q_roman": q.roman, "question": q.text, "show_question": skill == "read",
                                             "roman": q.roman if (skill == "read" and not TARGETS[lang].latin and d < 5) else None,
                                             "options": [{"text": o.text} for o in opts], "answer": opts.index(a)}, events + ["conversation"])


def _syllable(lang: str, attempts: int, rng: random.Random) -> tuple[str, list[str]]:
    """A barakhadi syllable (का) and two others from the same consonant (कि, कु): tells vowel signs apart.
    The first consonants and the simple vowel signs come first; more open up with practice."""
    rows = BARAKHADI[lang]
    row = rng.choice(rows[:min(len(rows), 4 + attempts // 2)])
    reach = row[:min(len(row), 6 + attempts // 3)]
    syl = rng.choice(reach)
    return syl, rng.sample([x for x in reach if x != syl], 2)


def choose(lang: str, skills: dict[str, LangSkillState], items: dict[str, LangItemState], rng: random.Random, *,
           focus: str | None = None, speech: bool = False, last: dict | None = None, miss_run: int = 0, topic: str | None = None,
           warmup: bool = False, need: dict[str, float] | None = None) -> Activity:
    """`last`: {"item", "outcome", "type", "retry"} of the previous answer in this sitting.
    `topic`: a conversation topic (greetings, directions ...): practise only its phrases.
    `warmup`: first turn of a new sitting for a child with history: start with something they know."""
    act = _choose(lang, skills, items, rng, focus=focus, speech=speech, last=last, miss_run=miss_run, topic=topic, warmup=warmup, need=need or {})
    if miss_run >= ERRORLESS_AFTER and act.type in ("listen_pick", "read_pick", "letter_sound"):
        # errorless learning: show the way, let the child succeed, then fade the help again
        act.spec["glow"] = act.spec["answer"]
        act.spec["show_word"] = True
        act.events.append("errorless")
    return act


def _warmup(lang: str, skills: dict[str, LangSkillState], items: dict[str, LangItemState], rng: random.Random, available: list[str]) -> Activity | None:
    known = [w for w in WORDS[lang].values() if items.get(w.id) and items[w.id].strength >= KNOWN] or \
            [w for w in WORDS[lang].values() if once_known(items.get(w.id))]
    if not known:
        return None
    word = rng.choice(known)
    skill = "listen" if "listen" in available else available[0]
    d = max(1, skills[skill].difficulty - 1)  # one step easier than where the child works: a sure success
    return build(lang, word, skill, d, list(WORDS[lang].values()), rng, hint=not TARGETS[lang].latin and d <= 2, events=["warmup"])


def _choose(lang: str, skills: dict[str, LangSkillState], items: dict[str, LangItemState], rng: random.Random, *,
            focus: str | None, speech: bool, last: dict | None, miss_run: int, topic: str | None, warmup: bool,
            need: dict[str, float] | None = None) -> Activity:
    need = need or {}  # 0..1 per skill from the progress tracker: weaker axes come up more
    target = TARGETS[lang]
    available = [s for s in SKILLS if speech or s != "speak"]
    events: list[str] = []
    if warmup and not is_topic(topic):
        act = _warmup(lang, skills, items, rng, available)
        if act:
            return act
    if is_topic(topic):
        pool = topic_pool(lang, topic)
        if last and last.get("outcome") == "miss" and not last.get("retry") and last.get("item") in ITEMS[lang] and miss_run < 2:
            word = ITEMS[lang][last["item"]]
            act = build(lang, word, "listen", 1, pool, rng, hint=not target.latin, events=["retry"])
            act.spec.update(show_word=True, retry=True, roman=word.roman)
            return act
        comfort = miss_run >= 2
        if comfort:
            skill = "listen"
            events.append("comfort")
        elif focus in available:
            skill = focus
        else:
            weights = [1.6 - min(1.0, skills[s].mastery) for s in available]
            if last and last.get("skill") in available and len(available) > 1:
                weights[available.index(last["skill"])] *= 0.35
            skill = rng.choices(available, weights=weights, k=1)[0]
        d = 1 if comfort else skills[skill].difficulty
        questions = [w.id for w in pool if w.id in REPLIES]
        if d >= 4 and questions and skill != "write" and rng.random() < REPLY_SHARE:
            return reply_activity(lang, skill, d, items, rng, events, rng.choice(questions))
        word = _pick_from(pool, items, rng, easy=comfort, avoid=last.get("item") if last else None)
        return build(lang, word, skill, d, pool, rng, hint=not target.latin and d <= 2, events=events)

    # Re-teach: the word just missed comes back once, as an easy listen-and-pick with the answer modelled.
    if last and last.get("outcome") == "miss" and not last.get("retry") and last.get("item") in ITEMS[lang] and miss_run < 2:
        word = ITEMS[lang][last["item"]]
        opts = _options(lang, word, 2, items, rng, hard=False)
        return Activity("listen_pick", "listen", 1, {
            "item": word.id, "word": word.text, "roman": word.roman, "show_word": True, "retry": True,
            "options": [{"emoji": o.emoji} for o in opts], "answer": opts.index(word)}, ["retry"])

    comfort = miss_run >= 2
    if comfort:
        events.append("comfort")
        skill = "listen"
    elif focus in available:
        skill = focus
    else:
        # weakest skills first, but keep all four moving
        weights = [(1.6 - min(1.0, skills[s].mastery) + (0.6 if skills[s].attempts < 3 else 0)) * (0.7 + need.get(s, 0.3)) for s in available]
        if last and last.get("skill") in available and len(available) > 1:
            weights[available.index(last["skill"])] *= 0.35  # variety
        skill = rng.choices(available, weights=weights, k=1)[0]
    d = 1 if comfort else skills[skill].difficulty
    hint = not target.latin and d <= 2  # romanisation as a reading aid at the easy levels
    struggling = skills[skill].attempts >= 6 and skills[skill].mastery < 0.4
    avoid = last.get("item") if last else None

    if d >= 5 and skill in ("listen", "read", "speak") and rng.random() < REPLY_SHARE:
        return reply_activity(lang, skill, d, items, rng, events)

    if skill == "listen":
        word = _pick_word(lang, items, rng, easy=comfort, avoid=avoid, small=struggling)
        opts = _options(lang, word, {1: 2, 2: 3}.get(d, 4), items, rng, hard=d >= 4)
        spec = {"item": word.id, "word": word.text, "roman": word.roman if hint else None, "show_word": d <= 1,
                "options": [{"emoji": o.emoji} for o in opts], "answer": opts.index(word)}
        return Activity("listen_pick", skill, d, spec, events)

    if skill == "read":
        letters = LETTERS[lang]
        if d == 1:  # first, the letters: hear one, find it
            reach = min(len(letters), 4 + 2 * skills[skill].successes)  # a new letter joins as earlier ones are learned
            letter = rng.choice(letters[:reach])
            opts = rng.sample([x for x in letters[:max(reach, 4)] if x != letter], 2) + [letter]
            rng.shuffle(opts)
            return Activity("letter_sound", skill, d, {"item": f"letter:{letter}", "say": letter, "options": [{"text": o} for o in opts],
                                                       "answer": opts.index(letter)}, events)
        if d == 2 and lang in BARAKHADI and rng.random() < 0.5:  # barakhadi: the same consonant with different vowel signs
            syl, wrong = _syllable(lang, skills[skill].successes, rng)
            opts = wrong + [syl]
            rng.shuffle(opts)
            return Activity("letter_sound", skill, d, {"item": f"syl:{syl}", "say": syl, "barakhadi": True,
                                                       "options": [{"text": o} for o in opts], "answer": opts.index(syl)}, events)
        word = _pick_word(lang, items, rng, avoid=avoid, small=struggling)
        opts = _options(lang, word, 3 if d <= 2 else 4, items, rng, hard=d >= 4)
        if d >= 4:  # picture -> choose the written word (reading without a picture clue on the options)
            spec = {"item": word.id, "prompt": {"emoji": word.emoji}, "options": [{"text": o.text} for o in opts], "answer": opts.index(word)}
        else:
            spec = {"item": word.id, "prompt": {"text": word.text, "roman": word.roman if hint else None},
                    "options": [{"emoji": o.emoji} for o in opts], "answer": opts.index(word)}
        return Activity("read_pick", skill, d, spec, events)

    if skill == "speak":
        word = _pick_word(lang, items, rng, avoid=avoid, small=struggling)
        spec = {"item": word.id, "word": word.text, "roman": word.roman if (hint or d <= 3) else None, "emoji": word.emoji,
                "model": d <= 2,  # Melo says it first at the easy levels; later the child recalls it
                "show_word": d <= 3, "answer": word.text}
        return Activity("say_word", skill, d, spec, events)

    # write: trace letters first, then build whole words from letter tiles, then whole sentences from word tiles
    if d >= 5 and rng.random() < 0.5:
        sentences = [w for w in WORDS[lang].values() if w.tier == MAX_TIER] if open_tier(items, lang) >= MAX_TIER else []
        # whole sentences only: several words (or, in scripts without spaces, several characters)
        pool = sentences + [w for w in PHRASE_WORDS[lang].values()
                            if len(pieces(w.text, lang)[0]) >= 2 and (lang in NO_SPACES or pieces(w.text, lang)[1] == " ")]
        word = _pick_from(pool, items, rng, avoid=avoid)
        return build(lang, word, "write", d, pool, rng, hint=False, events=events + ["sentence"])
    if d == 2 and lang in BARAKHADI and rng.random() < 0.5:
        syl, _ = _syllable(lang, skills[skill].successes, rng)
        return Activity("trace", skill, d, {"item": f"syl:{syl}", "glyph": syl, "hear": syl, "guide": True, "answer": syl}, events)
    if d >= 3:
        word = _pick_word(lang, items, rng, single=True, avoid=avoid)
        parts = clusters(word.text)
        if 2 <= len(parts) <= 9:
            tiles = list(parts)
            if d >= 4:  # extra letters that do not belong
                extra = [x for x in LETTERS[lang] if x.casefold() not in {p.casefold() for p in parts}]
                tiles += [x.lower() if target.latin else x for x in rng.sample(extra, min(2, len(extra)))]
            rng.shuffle(tiles)
            return Activity("spell", skill, d, {"item": word.id, "emoji": word.emoji, "tiles": tiles, "length": len(parts),
                                                "hear": word.text, "roman": None, "answer": word.text}, events)
        glyph = parts[0]
        return Activity("trace", skill, d, {"item": word.id, "glyph": glyph, "hear": word.text, "emoji": word.emoji, "guide": False,
                                            "answer": glyph}, events)
    letters = LETTERS[lang]
    reach = min(len(letters), 4 + 2 * skills[skill].successes)
    glyph = rng.choice(letters[:reach])
    return Activity("trace", skill, d, {"item": f"letter:{glyph}", "glyph": glyph, "hear": glyph, "guide": d <= 1, "answer": glyph}, events)


# --- judging an answer -----------------------------------------------------------------------------
def score(activity_type: str, spec: dict, response: dict) -> Result:
    if response.get("skipped"):
        return Result("skipped", 0.0)
    if activity_type in ("listen_pick", "read_pick", "letter_sound", "reply_pick"):
        choice = response.get("choice")
        if not isinstance(choice, int):
            return Result("skipped", 0.0)
        ok = choice == spec["answer"]
        return Result("success" if ok else "miss", 1.0 if ok else 0.0, {"correct": spec["answer"]})
    if activity_type == "say_word":
        heard = [str(x)[:120] for x in (response.get("heard") or []) if isinstance(x, str)][:6]
        want = normalise(spec["answer"])
        if not heard or not any(normalise(h) for h in heard):
            return Result("uncertain", 0.0)  # nothing recognised: never a mistake
        best, best_text = 0.0, heard[0]
        for h in heard:
            got = normalise(h)
            r = 1.0 if want and (want in got or got in want and len(got) >= max(2, len(want) - 1)) else difflib.SequenceMatcher(None, want, got).ratio()
            if r > best:
                best, best_text = r, h
        # speech recognition is unreliable with young voices: be generous, and never call a near miss wrong
        outcome = "success" if best >= 0.7 else "partial" if best >= 0.4 else "miss"
        return Result(outcome, round(best, 3), {"heard": best_text})
    if activity_type == "trace":
        cover, spill = float(response.get("coverage") or 0), float(response.get("spill") or 0)
        if not response.get("strokes"):
            return Result("skipped", 0.0)
        s = max(0.0, min(1.0, cover * (1 - max(0.0, spill - 0.3))))
        return Result("success" if s >= 0.65 else "partial" if s >= 0.4 else "miss", round(s, 3), {"coverage": cover, "spill": spill})
    if activity_type == "spell":
        built = unicodedata.normalize("NFC", str(response.get("text") or ""))
        if not normalise(built):
            return Result("skipped", 0.0)
        want = normalise(spec["answer"])  # punctuation and spaces do not matter, only the order of the pieces
        if normalise(built) == want:
            return Result("success", 1.0)
        r = difflib.SequenceMatcher(None, want, normalise(built)).ratio()
        return Result("partial" if r >= 0.7 else "miss", round(r, 3), {"built": built})
    raise ValueError(f"unknown activity {activity_type}")


# --- learning from the answer ------------------------------------------------------------------------
def apply(skill: LangSkillState, item: LangItemState | None, result: Result, difficulty: int, guided: bool = False) -> list[str]:
    """Update the skill and the word's memory. Returns events: harder | easier.
    `guided`: the answer was shown (errorless turn). It helps the word's memory a little and ends the run of
    misses, but it is not proof of skill, so it never raises the difficulty or the mastery."""
    events: list[str] = []
    o = result.outcome
    if o not in ("success", "partial", "miss"):
        return events
    if guided and o == "success":
        skill.fail_streak = 0
        if item is not None:
            item.seen += 1
            item.strength += 0.2 * (1 - item.strength)
        return events
    skill.attempts += 1
    skill.mastery = max(0.0, min(1.0, skill.mastery + ALPHA * (result.score - skill.mastery)))
    if o == "success":
        skill.successes += 1
        skill.streak += 1
        skill.fail_streak = 0
        placing = skill.attempts <= PLACEMENT_ATTEMPTS and skill.successes == skill.attempts and skill.difficulty < PLACEMENT_MAX_DIFFICULTY
        if (placing or skill.streak >= STREAK_UP) and skill.difficulty < 5:
            skill.difficulty += 1
            skill.streak = 0
            events.append("harder")
    elif o == "miss":
        skill.streak = 0
        skill.fail_streak += 1
        if skill.fail_streak >= FAILS_DOWN and skill.difficulty > 1:
            skill.difficulty -= 1
            skill.fail_streak = 0
            events.append("easier")
    if item is not None:
        item.seen += 1
        if o == "success":
            item.correct += 1
            # a right answer at a harder level shows the word is already known
            item.strength = max(item.strength + 0.4 * (1 - item.strength), 0.7 if difficulty >= 3 else 0.0)
        elif o == "partial":
            item.strength += 0.15 * (1 - item.strength)
        else:
            item.strength *= 0.6
    return events
