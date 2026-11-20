"""Progress tracker: the children's learning-assessment parameters, measured after every activity.

Every learning area (music, each language studied, learning habits) is shown as a spider (radar) chart.
Each axis score is

    final = 80 % measured  +  20 % assessed

* measured (80 %): computed only from what the child actually did in the app (attempts, levels reached,
  support used, timing, sessions), recomputed after every single answer;
* assessed (20 %): the latest teacher / parent assessment of that axis (human-reviewed, preferred), or the
  AI teacher's assessment, weighted by its confidence. With neither, the axis is 100 % measured and says so.

Rules from the parameter guide that this module follows:
* scores describe demonstrated performance on tasks, never the child (no labels, no diagnoses);
* an axis with too little evidence is "not assessed yet", never 0; few attempts are flagged "limited evidence";
* bands: 0-20 Introduction, 21-40 Exploring, 41-60 Developing, 61-80 Proficient, 81-100 Demonstrated mastery;
* AI observations carry the quality fields (method, modality, model, confidence, evidence, review status,
  validity, limitations) and can be rejected by a parent;
* no rankings between children, no punitive streaks; response time is shown in context, never scored.

Outliers and end cases:
* an answer given less than 0.6 s after the activity appeared cannot be a real answer: an accidental tap,
  excluded from the scores (counted as "rushed");
* a run of 4 or more skips is disengagement, not ability: excluded too;
* AI scores further than 25 points from the measured score are pulled back to that limit and marked
  "partially valid"; low-evidence axes halve the AI's confidence;
* a failed AI assessment (no brain, timeout, refusal, token limit) never touches the measured part: the
  last valid assessment is kept (marked stale after 21 days) and the failure is recorded for the audit.
"""
from __future__ import annotations

import logging
import statistics
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, delete, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .db import Base
from .models import Attempt, Child, LangAttempt, LangItemState, LessonSession, utcnow

log = logging.getLogger("melo.assessment")

MEASURED_WEIGHT, ASSESSED_WEIGHT = 0.8, 0.2
MIN_EVIDENCE = 3  # valid attempts before an axis gets a score
LIMITED_EVIDENCE = 8  # below this the score is shown as "limited evidence"
RUSHED_SECONDS = 0.6
AI_MAX_DEVIATION = 25
AI_STALE_DAYS, HUMAN_STALE_DAYS = 21, 90
RUBRIC_VERSION = "melo-1.0"
BANDS = ((20, "Introduction"), (40, "Exploring"), (60, "Developing"), (80, "Proficient"), (100, "Demonstrated mastery"))


def band(score: float | None) -> str | None:
    if score is None:
        return None
    return next(name for top, name in BANDS if score <= top)


# --- storage ----------------------------------------------------------------------------------------
class Assessment(Base):
    """A teacher, parent, AI or child-self-report observation about one axis (or the whole child)."""
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(12))  # ai | teacher | parent | child | system
    area: Mapped[str] = mapped_column(String(20))  # music | lang:<code> | habits | overall
    axis: Mapped[str] = mapped_column(String(30))
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(12), default="active")  # active | rejected
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # the quality fields of the guide
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ProgressSnapshot(Base):
    """One per child per day, rewritten after every activity: the longitudinal history of the spider charts."""
    __tablename__ = "progress_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# --- normalised attempts ------------------------------------------------------------------------------
@dataclass
class Ev:
    domain: str  # music | lang
    lang: str | None
    kind: str  # activity type
    skill: str
    difficulty: int
    outcome: str
    item: str | None
    supported: bool
    at: datetime
    secs: float | None
    sitting: str
    spec: dict

    @property
    def valid(self) -> bool:
        return self.outcome in ("success", "partial", "miss")

    @property
    def value(self) -> float:
        return {"success": 1.0, "partial": 0.5}.get(self.outcome, 0.0)


def _utc(dt: datetime | None) -> datetime | None:
    return dt.replace(tzinfo=timezone.utc) if dt is not None and dt.tzinfo is None else dt


def load_events(db: Session, child_id: str, days: int = 180, limit: int = 1500) -> tuple[list[Ev], dict]:
    """All answered attempts (music + languages), oldest first, with outliers removed. Returns (events, quality)."""
    since = utcnow() - timedelta(days=days)
    evs: list[Ev] = []
    for a in db.scalars(select(Attempt).where(Attempt.child_id == child_id, Attempt.created_at >= since)
                        .order_by(Attempt.created_at.desc()).limit(limit)):
        sp = a.spec or {}
        evs.append(Ev("music", None, a.activity_type, a.skill, a.difficulty, a.outcome or "abandoned", sp.get("song_id"),
                      bool(sp.get("retry") or sp.get("support") in ("full", "some")), _utc(a.created_at),
                      ((_utc(a.answered_at) - _utc(a.created_at)).total_seconds() if a.answered_at else None), f"s:{a.session_id}", sp))
    lang_rows = list(db.scalars(select(LangAttempt).where(LangAttempt.child_id == child_id, LangAttempt.created_at >= since)
                                .order_by(LangAttempt.created_at.desc()).limit(limit)))
    lang_rows.sort(key=lambda a: _utc(a.created_at))
    sitting, last_at = 0, None
    for a in lang_rows:  # language sittings: a pause of 30 minutes starts a new one
        at = _utc(a.created_at)
        if last_at is None or at - last_at > timedelta(minutes=30):
            sitting += 1
        last_at = at
        sp = {**(a.spec or {}), "_pron": ((a.response or {}).get("pronunciation") or {}).get("score")}  # vs native speakers
        evs.append(Ev("lang", a.lang, a.activity, a.skill, a.difficulty, a.outcome or "abandoned", sp.get("item"),
                      bool(sp.get("glow") is not None or sp.get("retry")), at,
                      ((_utc(a.answered_at) - at).total_seconds() if a.answered_at else None), f"l:{a.lang}:{sitting}", sp))
    evs.sort(key=lambda e: e.at)
    # outliers: impossible-fast answers and long skip runs
    rushed = disengaged = 0
    clean: list[Ev] = []
    skip_run: list[Ev] = []
    for e in evs:
        if e.valid and e.secs is not None and e.secs < RUSHED_SECONDS:
            rushed += 1
            continue
        if e.outcome == "skipped":
            skip_run.append(e)
            continue
        if len(skip_run) >= 4:
            disengaged += len(skip_run)
        else:
            clean.extend(skip_run)
        skip_run = []
        clean.append(e)
    if len(skip_run) >= 4:
        disengaged += len(skip_run)
    else:
        clean.extend(skip_run)
    clean.sort(key=lambda e: e.at)
    return clean, {"rushed_excluded": rushed, "disengaged_excluded": disengaged, "events": len(clean)}


# --- measures -------------------------------------------------------------------------------------------
def _valid(evs: list[Ev]) -> list[Ev]:
    return [e for e in evs if e.valid]


def accuracy(evs: list[Ev], window: int = 30) -> tuple[float | None, int]:
    v = _valid(evs)[-window:]
    return (round(100 * statistics.fmean(e.value for e in v), 1), len(v)) if len(v) >= MIN_EVIDENCE else (None, len(v))


def skill_score(evs: list[Ev]) -> tuple[float | None, int]:
    """Demonstrated performance: the highest level succeeded at twice (55 %) and recent accuracy (45 %)."""
    v = _valid(evs)
    if len(v) < MIN_EVIDENCE:
        return None, len(v)
    wins: dict[int, int] = {}
    for e in v:
        if e.outcome == "success" and not e.supported:
            wins[e.difficulty] = wins.get(e.difficulty, 0) + 1
    reached = max([d for d, n in wins.items() if n >= 2], default=1 if wins else 0)
    acc = statistics.fmean(e.value for e in v[-25:])
    level_part = max(0, reached - 1) / 4 if reached else 0.0
    return round(100 * (0.55 * level_part + 0.45 * acc), 1), len(v)


def consistency(evs: list[Ev]) -> tuple[float | None, int]:
    by: dict[str, list[float]] = {}
    for e in _valid(evs):
        by.setdefault(e.sitting, []).append(e.value)
    accs = [statistics.fmean(x) for x in by.values() if len(x) >= 4]
    if len(accs) < 2:
        return None, len(accs)
    return round(100 * (1 - min(1.0, statistics.pstdev(accs[-8:]) / 0.35)), 1), len(accs)


def retention(evs: list[Ev]) -> tuple[float | None, int]:
    """Right again after a gap of 20 hours or more, on something that was right before."""
    last: dict[tuple, Ev] = {}
    hits: list[float] = []
    for e in _valid(evs):
        key = (e.domain, e.lang, e.item if e.domain == "lang" and e.item else e.skill)
        prev = last.get(key)
        if prev is not None and prev.outcome == "success" and e.at - prev.at >= timedelta(hours=20):
            hits.append(e.value)
        last[key] = e
    return (round(100 * statistics.fmean(hits), 1), len(hits)) if len(hits) >= MIN_EVIDENCE else (None, len(hits))


def independence(evs: list[Ev]) -> tuple[float | None, int]:
    wins = [e for e in _valid(evs)[-60:] if e.outcome == "success"]
    if len(wins) < MIN_EVIDENCE:
        return None, len(wins)
    return round(100 * sum(1 for e in wins if not e.supported) / len(wins), 1), len(wins)


def error_recovery(evs: list[Ev]) -> tuple[float | None, int]:
    v = _valid(evs)
    after: list[float] = []
    for i, e in enumerate(v):
        if e.outcome != "miss":
            continue
        nxt = next((x for x in v[i + 1:i + 6] if x.skill == e.skill and x.domain == e.domain), None)
        if nxt is not None:
            after.append(nxt.value)
    return (round(100 * statistics.fmean(after), 1), len(after)) if len(after) >= MIN_EVIDENCE else (None, len(after))


def velocity(evs: list[Ev]) -> tuple[float | None, int]:
    """50 = steady; higher = improving over the last 30 days (difficulty-weighted accuracy, early vs late half)."""
    since = utcnow() - timedelta(days=30)
    v = [e for e in _valid(evs) if e.at >= since]
    if len(v) < 10:
        return None, len(v)
    w = lambda xs: statistics.fmean(e.value * (0.6 + 0.1 * e.difficulty) for e in xs)  # noqa: E731
    half = len(v) // 2
    delta = w(v[half:]) - w(v[:half])
    return round(max(0.0, min(100.0, 50 + delta * 100)), 1), len(v)


def regularity(evs: list[Ev]) -> tuple[float | None, int]:
    """Practice spread over the last 14 days: practising on 7 of 14 days (every other day) is 100. Never a streak."""
    if not evs:
        return None, 0
    since = utcnow() - timedelta(days=14)
    per_day: dict[str, int] = {}
    for e in evs:
        if e.at >= since and e.valid:
            per_day[e.at.date().isoformat()] = per_day.get(e.at.date().isoformat(), 0) + 1
    days = sum(1 for n in per_day.values() if n >= 3)
    return round(min(100.0, 100 * days / 7), 1), days


def completion(evs: list[Ev]) -> tuple[float | None, int]:
    if len(evs) < MIN_EVIDENCE:
        return None, len(evs)
    return round(100 * sum(1 for e in evs if e.valid) / len(evs), 1), len(evs)


def transfer(evs: list[Ev]) -> tuple[float | None, int]:
    """First meeting with a new word or phrase at difficulty 2+: using what was learned on something unfamiliar."""
    seen: set = set()
    hits: list[float] = []
    for e in _valid(evs):
        if e.domain != "lang" or not e.item:
            continue
        key = (e.lang, e.item)
        if key not in seen and e.difficulty >= 2 and not e.supported:
            hits.append(e.value)
        seen.add(key)
    return (round(100 * statistics.fmean(hits), 1), len(hits)) if len(hits) >= MIN_EVIDENCE else (None, len(hits))


def difficulty_tolerance(evs: list[Ev]) -> tuple[float | None, int]:
    v = _valid(evs)
    hard = [e.value for e in v if e.difficulty >= 4]
    easy = [e.value for e in v if e.difficulty <= 2]
    if len(hard) < MIN_EVIDENCE or len(easy) < MIN_EVIDENCE:
        return None, len(hard)
    return round(100 * min(1.0, statistics.fmean(hard) / max(0.05, statistics.fmean(easy))), 1), len(hard)


def response_time(evs: list[Ev]) -> float | None:
    t = [e.secs for e in _valid(evs) if e.secs is not None and e.secs < 120]
    return round(statistics.median(t), 1) if len(t) >= MIN_EVIDENCE else None


def _f(evs: list[Ev], **kw) -> list[Ev]:
    out = evs
    for k, v in kw.items():
        if k == "kinds":
            out = [e for e in out if e.kind in v]
        elif k == "min_d":
            out = [e for e in out if e.difficulty >= v]
        elif k == "max_d":
            out = [e for e in out if e.difficulty <= v]
        elif k == "spec":
            out = [e for e in out if all(e.spec.get(a) for a in v)]
        elif k == "no_spec":
            out = [e for e in out if not any(e.spec.get(a) for a in v)]
        else:
            out = [e for e in out if getattr(e, k) == v]
    return out


# --- the spider axes ----------------------------------------------------------------------------------
MUSIC_AXES = [  # (axis, label, emoji, skill)
    ("pitch", "Pitch & notes", "🐦", "pitch"), ("rhythm", "Rhythm & beat", "🥁", "rhythm"), ("dynamics", "Loud & soft", "🦁", "dynamics"),
    ("timbre", "Ear training", "👂", "timbre"), ("melody", "Melody & memory", "🎵", "melody"), ("creativity", "Creativity", "🎨", "creativity"),
]
LANG_AXES = [("listen", "Listening", "👂"), ("speak", "Speaking", "🗣️"), ("read", "Reading", "📖"), ("write", "Writing", "✍️"),
             ("vocabulary", "Vocabulary", "🔤"), ("conversation", "Conversation", "💬")]
HABIT_AXES = [("accuracy", "Accuracy", "🎯"), ("consistency", "Consistency", "📏"), ("retention", "Remembering", "🧠"),
              ("independence", "Independence", "🦸"), ("recovery", "Bouncing back", "🔁"), ("regularity", "Practice rhythm", "📅"),
              ("velocity", "Getting better", "📈")]


def _axis(axis: str, label: str, emoji: str, measured: tuple[float | None, int], skill: str | None = None) -> dict:
    score, n = measured
    return {"id": axis, "label": label, "emoji": emoji, "skill": skill, "measured": score, "n": n,
            "evidence": None if score is None else ("limited" if n < LIMITED_EVIDENCE else "good")}


def measured_areas(db: Session, child: Child, evs: list[Ev] | None = None) -> list[dict]:
    """The measured (80 %) part of every spider chart, straight from the child's activity."""
    if evs is None:
        evs, _ = load_events(db, child.id)
    areas = []
    music = [e for e in evs if e.domain == "music"]
    areas.append({"id": "music", "title": "Music", "emoji": "🎹",
                  "axes": [_axis(a, label, em, skill_score(_f(music, skill=sk)), sk) for a, label, em, sk in MUSIC_AXES]})
    from .lang.content import TARGETS, WORDS
    from .lang.phrases import PHRASE_WORDS

    langs = sorted({e.lang for e in evs if e.domain == "lang" and e.lang in TARGETS}, key=lambda c: -sum(1 for e in evs if e.lang == c))
    for code in langs:
        L = [e for e in evs if e.lang == code]
        items = {i.item: i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id, LangItemState.lang == code))}
        total = len(WORDS[code]) + len(PHRASE_WORDS[code])
        known = sum(1 for i in items.values() if i.strength >= 0.6)
        vocab = (round(min(100.0, 100 * known / max(1, total) * 2.5), 1), len(items)) if len(items) >= MIN_EVIDENCE else (None, len(items))
        convo = skill_score(_f(L, kinds=("reply_pick",)) + _f(L, spec=("question",)) + [e for e in L if (e.item or "").startswith("p_")])
        axes = [_axis(s, label, em, skill_score(_f(L, skill=s)), s) for s, label, em in LANG_AXES[:4]]
        axes += [_axis("vocabulary", "Vocabulary", "🔤", vocab), _axis("conversation", "Conversation", "💬", convo)]
        areas.append({"id": f"lang:{code}", "title": TARGETS[code].name, "emoji": TARGETS[code].flag, "axes": axes,
                      "facts": {"words_known": known, "items_total": total}})
    areas.append({"id": "habits", "title": "Learning habits", "emoji": "🌱", "axes": [
        _axis("accuracy", "Accuracy", "🎯", accuracy(evs, 60)), _axis("consistency", "Consistency", "📏", consistency(evs)),
        _axis("retention", "Remembering", "🧠", retention(evs)), _axis("independence", "Independence", "🦸", independence(evs)),
        _axis("recovery", "Bouncing back", "🔁", error_recovery(evs)), _axis("regularity", "Practice rhythm", "📅", regularity(evs)),
        _axis("velocity", "Getting better", "📈", velocity(evs)),
    ]})
    return areas


# --- the parameter catalogue (the assessment guide), each with how Melo measures it ---------------------
# (group, parameter, definition, measure key or None). None = needs an AI teacher, a teacher or a parent
# (camera / handwriting analysis, free speech, comprehension of passages ...), shown as "not measured by the app".
CATALOGUE_TEXT = """
Common|Accuracy|Correct responses divided by valid opportunities|accuracy
Common|Completion rate|Proportion of activities completed|completion
Common|Learning progress|Change in demonstrated skill over time|velocity
Common|Learning velocity|Rate of improvement across comparable assessments|velocity
Common|Response time|Time between prompt and response, read in context (not scored)|response_time
Common|Learning speed|Sessions needed to reach a defined skill level|learning_speed
Common|Retention|Performance when a learned skill is checked again after a delay|retention
Common|Recall|Retrieving information without seeing the answer|recall
Common|Recognition|Identifying previously encountered information|recognition
Common|Consistency|Stability of performance across sessions|consistency
Common|Independence|Level of support needed to complete a task|independence
Common|Hint dependence|Share of successes that needed help (lower is more independent)|hint_dependence
Common|Repetition requirement|Practice opportunities needed before a word is known|repetitions
Common|Error frequency|Errors per valid opportunity (lower is better)|error_rate
Common|Error type distribution|Which kinds of activity the errors happen in|error_types
Common|Error recovery|Getting it right soon after a mistake|recovery
Common|Self-correction|Corrections without an external prompt|
Common|Transfer learning|Applying a skill to new, unfamiliar examples|transfer
Common|Difficulty tolerance|Performance as task difficulty rises|difficulty_tolerance
Common|Engagement indicators|Observable participation: activities per sitting, continuing voluntarily (context only)|engagement
Common|Practice regularity|Practice spread across days (never a streak)|regularity
Common|Goal progression|Progress against the focus set by a parent or teacher|goal
Common|Mastery stability|Known words and skills still right on later checks|mastery_stability
Common|Confidence rating|Child-reported comfort, kept separate from performance|confidence
Common|Preferred learning format|Activity formats the child completes most|preferred_format
Common|Accessibility support|Accommodations or assistive supports used|
Reading|Alphabet / character recognition|Correct identification of letters or characters|r_letters
Reading|Script familiarity|Recognition of the writing system and its conventions|r_script
Reading|Letter-sound correspondence|Associating letters with their sounds|r_letters
Reading|Phonological awareness|Awareness of syllables, rhymes and sound units|r_syllables
Reading|Phonemic awareness|Working with individual speech sounds|
Reading|Sound blending|Combining sounds into syllables or words|r_syllables
Reading|Sound segmentation|Separating words into their sounds|w_spell
Reading|Syllable recognition|Identifying syllables (barakhadi in Indian scripts)|r_syllables
Reading|Word recognition|Identifying written words|r_words
Reading|Sight-word recognition|Recognising familiar words without decoding|r_sight
Reading|Decoding accuracy|Sounding out unfamiliar words|r_new_words
Reading|Reading accuracy|Correctly read units divided by attempted units|r_all
Reading|Oral reading fluency|Accuracy and pace reading aloud|
Reading|Reading rate|Units read per minute|
Reading|Pronunciation during reading|Spoken forms while reading aloud|
Reading|Prosody|Phrasing, pauses, stress and intonation|
Reading|Vocabulary recognition|Understanding words met in text|r_words
Reading|Sentence comprehension|Understanding sentence meaning|r_sentences
Reading|Passage comprehension|Understanding a passage|
Reading|Main-idea identification|Identifying the central idea|
Reading|Detail retrieval|Finding stated information|
Reading|Inference|Drawing conclusions from a passage|
Reading|Sequencing|Ordering events from a text|
Reading|Contextual meaning|Using context for unfamiliar words|
Reading|Reading recall|Remembering key information after reading|
Reading|Reading independence|Reading with reduced assistance|r_independence
Writing|Character formation|Correct construction of letters|w_trace
Writing|Stroke order|Sequence of strokes|
Writing|Character orientation|Direction and orientation|
Writing|Character size consistency|Consistent size|
Writing|Baseline alignment|Placement on the line|
Writing|Letter / character spacing|Spacing between written units|
Writing|Word spacing|Separation between words|
Writing|Handwriting legibility|How easily writing can be read|w_trace
Writing|Writing accuracy|Written content compared with the target|w_all
Writing|Spelling accuracy|Correct spelling of words|w_spell
Writing|Phonetic spelling|Representing heard sounds in writing|w_spell
Writing|Dictation accuracy|Writing what was heard|w_spell
Writing|Vocabulary use|Range and use of words|
Writing|Grammar accuracy|Correct grammatical forms|w_sentences
Writing|Sentence construction|Complete, meaningful sentences|w_sentences
Writing|Sentence variety|Different sentence structures|
Writing|Punctuation|Appropriate punctuation|
Writing|Capitalization|Capital letters where relevant|
Writing|Paragraph structure|Sentences organised into a paragraph|
Writing|Cohesion|Logical connection between ideas|
Writing|Organization|Beginning, middle and end|
Writing|Creative writing|Originality of ideas|
Writing|Written expression|Clarity of ideas in writing|
Writing|Writing fluency|Producing written content with increasing ease|w_velocity
Writing|Writing rate|Characters per minute|
Writing|Editing and revision|Improving a draft|
Writing|Writing independence|Writing without step-by-step help|w_independence
Speaking|Sound production|Production of target speech sounds|s_all
Speaking|Phoneme accuracy|Accuracy of individual sounds (estimated by comparison with native speakers)|s_native
Speaking|Pronunciation compared with native speakers|How close the spoken word sounds to native-speaker recordings (0-100)|s_native
Speaking|Syllable production|Accurate syllables|
Speaking|Word pronunciation|Intelligibility and accuracy of spoken words|s_words
Speaking|Intelligibility|How understandable speech is|s_all
Speaking|Fluency|Smoothness and continuity|
Speaking|Speaking rate|Syllables per minute|
Speaking|Pausing|Use of pauses|
Speaking|Vocabulary range|Variety of words used|
Speaking|Word retrieval|Finding the word from a picture, without hearing it first|s_recall
Speaking|Grammar in speech|Grammatical forms|
Speaking|Sentence construction|Forming meaningful spoken sentences|s_sentences
Speaking|Sentence complexity|Range of sentence structures|
Speaking|Narrative ability|Telling a coherent story|
Speaking|Sequencing in speech|Logical order of spoken ideas|
Speaking|Descriptive language|Describing people, objects, events|
Speaking|Conversational turn-taking|Taking and yielding turns|s_conversation
Speaking|Topic maintenance|Staying relevant|
Speaking|Question asking|Asking relevant questions|
Speaking|Response relevance|Answering a question with a fitting reply|s_conversation
Speaking|Spontaneous speech|Speaking without a model|s_recall
Speaking|Explanation ability|Explaining reasoning|
Speaking|Expressiveness|Emphasis and intonation|
Speaking|Speaking independence|Communicating without repeated prompting|s_independence
Listening|Sound discrimination|Distinguishing similar sounds|l_letters
Listening|Phoneme discrimination|Differences between speech sounds|l_letters
Listening|Word recognition from audio|Recognising spoken words|l_words
Listening|Vocabulary comprehension|Understanding spoken vocabulary|l_all
Listening|Sentence comprehension|Understanding spoken sentences|l_sentences
Listening|Passage comprehension|Understanding spoken stories|
Listening|Instruction comprehension|Understanding spoken directions|l_directions
Listening|Multi-step instruction following|Completing a sequence of spoken directions|
Listening|Auditory memory|Remembering what was heard|m_memory
Listening|Listening recall|Recalling key details from audio|
Listening|Sequencing from audio|Ordering steps heard|m_memory
Listening|Inference from audio|Drawing conclusions from spoken content|
Listening|Speaker / voice discrimination|Distinguishing speakers|
Listening|Conversation comprehension|Following a conversation|l_conversation
Listening|Response accuracy|Correct responses to listening tasks|l_all
Vocabulary|Receptive vocabulary|Words understood when heard or read|v_receptive
Vocabulary|Expressive vocabulary|Words used in speech or writing|v_expressive
Vocabulary|Vocabulary breadth|Number and variety of known words|v_breadth
Vocabulary|Vocabulary depth|Meanings, relationships and usage|
Vocabulary|Synonym recognition|Words with similar meanings|
Vocabulary|Antonym recognition|Words with opposite meanings|
Vocabulary|Word categories|Grouping words by meaning|
Vocabulary|Morphology|Word parts and formation|
Vocabulary|Grammar concepts|Grammatical rules and patterns|
Vocabulary|Word order|Sentences in the language's normal order|w_sentences
Vocabulary|Tense and agreement|Grammatical forms|
Vocabulary|Translation ability|Meaning between languages (side-by-side view)|
Vocabulary|Code-switching awareness|Context-appropriate language choice (never an error)|
Music knowledge|Note recognition|Identifying named notes|m_find
Music knowledge|Pitch recognition|High and low pitches|m_pitch
Music knowledge|Pitch matching|Matching a heard pitch|m_find
Music knowledge|Interval recognition|Distance between notes|m_pitch_hard
Music knowledge|Melody recognition|Recognising a melodic pattern|m_same
Music knowledge|Rhythm recognition|Identifying rhythmic patterns|m_rhythm
Music knowledge|Beat recognition|Identifying the pulse|m_rhythm
Music knowledge|Tempo recognition|Speed of music|m_tempo
Music knowledge|Meter recognition|Beat groupings (taal)|
Music knowledge|Note duration|How long notes are held|m_song
Music knowledge|Rest recognition|Silence in music|
Music knowledge|Dynamics recognition|Loudness|m_dynamics
Music knowledge|Articulation recognition|How notes are played|
Music knowledge|Musical notation reading|Reading the note path|m_song
Music knowledge|Music theory knowledge|Age-appropriate concepts (Basics topics)|m_basics
Music knowledge|Ear training|Identifying features by listening|m_ear
Music knowledge|Musical memory|Remembering notes, rhythms and melodies|m_memory
Music performance|Note accuracy|Correct notes performed|m_notes
Music performance|Pitch accuracy|Closeness to the intended pitch (microphone)|m_mic
Music performance|Rhythm accuracy|Correct timing|m_rhythm
Music performance|Tempo stability|Steady tempo|m_rhythm
Music performance|Timing accuracy|Starting notes on time|m_rhythm
Music performance|Note duration accuracy|Holding notes for their length|
Music performance|Sequence accuracy|Notes in the intended order|m_sequence
Music performance|Finger placement|Finger positioning (camera observation)|
Music performance|Finger independence|Individual finger control|
Music performance|Hand coordination|Coordination between hands|
Music performance|Hand transitions|Moving between positions|
Music performance|Chord accuracy|Correct notes in a chord|
Music performance|Chord transitions|Changing between chords|
Music performance|Scale proficiency|Learned scales (alankars)|m_alankar
Music performance|Articulation|Separation or connection of notes|
Music performance|Dynamics control|Control of loudness|
Music performance|Tone quality|Suitable tone|
Music performance|Technique consistency|Reproducible technique|
Music performance|Posture observation|Visible setup and posture (assessed cautiously)|
Music performance|Performance continuity|Playing through a whole piece|m_full_song
Music performance|Recovery after a mistake|Resuming after an error|m_recovery
Music performance|Sight-reading|Playing from unfamiliar notation|m_new_song
Music performance|Performance independence|Playing without guidance|m_independence
Music expression|Phrasing|Grouping notes into phrases|
Music expression|Expressive interpretation|Conveying musical character|
Music expression|Dynamic expression|Intentional loudness changes|
Music expression|Articulation expression|Intentional attack and connection|
Music expression|Improvisation|Creating ideas spontaneously|m_create
Music expression|Composition|Creating an original piece|m_create
Music expression|Melody creation|Creating a sequence of pitches|m_create
Music expression|Rhythm creation|Creating rhythmic patterns|
Music expression|Arrangement|Organising musical parts|
Music expression|Musical exploration|Trying sounds and ideas|m_create
Music expression|Performance confidence|Self-reported comfort performing|confidence
Music expression|Ensemble coordination|Coordinating with others|
Music expression|Listening and response|Responding to another performer (echo games)|m_memory
Keyboard|Correct key identification|Finding the named key|m_find
Keyboard|Note location accuracy|Locating notes on the keyboard|m_find
Keyboard|Right-hand performance accuracy|Right-hand playing|
Keyboard|Left-hand performance accuracy|Left-hand playing|
Keyboard|Two-hand coordination|Both hands together|
Keyboard|Finger numbering accuracy|Using the right fingers|
Keyboard|Chord shape and inversion recognition|Chord shapes|
Keyboard|Pedal use|When age-appropriate|
Keyboard|Scale and arpeggio performance|Scales and arpeggios|m_alankar
Keyboard|Keyboard navigation|Moving around the keyboard|m_notes
Cognitive|Pattern recognition|Repeated or changing patterns|m_same
Cognitive|Categorization|Grouping items by shared features|
Cognitive|Sequencing|Ordering events, objects or steps|m_sequence
Cognitive|Working-memory task performance|Holding and using information during a task|m_memory
Cognitive|Recall memory|Retrieving learned information|recall
Cognitive|Recognition memory|Identifying encountered information|recognition
Cognitive|Spatial reasoning|Shapes and spatial relationships|
Cognitive|Logical reasoning|Conclusions from rules|
Cognitive|Problem solving|Selecting and applying a solution|
Cognitive|Planning|Organising steps toward a goal|
Cognitive|Flexible thinking|Trying another approach|recovery
Cognitive|Concept formation|A general idea from examples|transfer
Cognitive|Cause-and-effect understanding|Actions and outcomes|
Cognitive|Classification|Sorting by attributes|
Cognitive|Estimation|Approximate judgements|
Cognitive|Comparison|Similarities and differences (same / different, higher / lower)|m_compare
Cognitive|Sequenced instruction performance|Completing ordered tasks|m_sequence
Cognitive|Transfer|Applying learning to a new task|transfer
Cognitive|Creative idea generation|Producing varied ideas|m_create
Cognitive|Explanation|Describing how an answer was reached|
Cognitive|Decision making|Selecting among options with a reason|
Cognitive|Strategy use|Choosing an effective approach|
Cognitive|Self-monitoring|Checking one's own work|
Cognitive|Reflection|What was learned or is still hard (child self-report)|confidence
Creativity|Idea generation|Number and variety of ideas|m_create
Creativity|Originality|Novelty of ideas|
Creativity|Elaboration|Adding useful detail|
Creativity|Imagination|Fictional or hypothetical ideas|
Creativity|Story creation|Developing a coherent story|
Creativity|Visual expression|Ideas through drawings|
Creativity|Musical creativity|Creating melodies and rhythms|m_create
Creativity|Language creativity|Using language in original ways|
Creativity|Exploration|Trying alternative approaches|m_create
Creativity|Revision|Improving a creation|
Creativity|Creative problem solving|Useful new solutions|
Creativity|Project completion|Finishing a creative task|m_full_song
"""


def catalogue() -> list[dict]:
    out = []
    for line in CATALOGUE_TEXT.strip().splitlines():
        group, name, definition, key = (line.split("|") + [""])[:4]
        out.append({"group": group, "name": name, "definition": definition, "measure": key or None})
    return out


def _measure_all(db: Session, child: Child, evs: list[Ev]) -> dict[str, dict]:
    """Every measure key of the catalogue -> {score, n, info?}."""
    M = [e for e in evs if e.domain == "music"]
    L = [e for e in evs if e.domain == "lang"]
    s = lambda xs: skill_score(xs)  # noqa: E731
    out: dict[str, tuple] = {
        "accuracy": accuracy(evs, 60), "completion": completion(evs), "velocity": velocity(evs), "retention": retention(evs),
        "consistency": consistency(evs), "independence": independence(evs), "recovery": error_recovery(evs),
        "transfer": transfer(evs), "difficulty_tolerance": difficulty_tolerance(evs), "regularity": regularity(evs),
        "recall": accuracy(_f(L, kinds=("spell",)) + _f(L, kinds=("say_word",), spec=("answer",), no_spec=("model",))
                           + _f(L, kinds=("read_pick",), min_d=4)),
        "recognition": accuracy(_f(L, kinds=("listen_pick", "letter_sound")) + _f(L, kinds=("read_pick",), max_d=3)
                                + _f(M, kinds=("high_low", "instrument_guess", "same_different"))),
        "r_letters": accuracy(_f(L, kinds=("letter_sound",), no_spec=("barakhadi",))), "r_syllables": accuracy(_f(L, kinds=("letter_sound",), spec=("barakhadi",))),
        "r_words": accuracy(_f(L, kinds=("read_pick",), max_d=3)), "r_sight": accuracy(_f(L, kinds=("read_pick",), min_d=4)),
        "r_all": s(_f(L, skill="read")), "r_script": accuracy(_f(L, skill="read"), 60),
        "r_sentences": accuracy(_f(L, kinds=("reply_pick",), skill="read") + [e for e in _f(L, skill="read") if (e.item or "").startswith(("s_", "p_"))]),
        "r_independence": independence(_f(L, skill="read")),
        "w_trace": accuracy(_f(L, kinds=("trace",))), "w_spell": accuracy(_f(L, kinds=("spell",))), "w_all": s(_f(L, skill="write")),
        "w_sentences": accuracy([e for e in _f(L, kinds=("spell",)) if (e.item or "").startswith(("s_", "p_"))]),
        "w_velocity": velocity(_f(L, skill="write")), "w_independence": independence(_f(L, skill="write")),
        "s_all": s(_f(L, skill="speak")), "s_words": accuracy([e for e in _f(L, skill="speak") if not (e.item or "").startswith("p_")]),
        "s_recall": accuracy(_f(L, skill="speak", no_spec=("model",))), "s_sentences": accuracy([e for e in _f(L, skill="speak") if (e.item or "").startswith(("s_", "p_"))]),
        "s_conversation": accuracy(_f(L, skill="speak", spec=("question",))), "s_independence": independence(_f(L, skill="speak")),
        "l_letters": accuracy(_f(L, kinds=("letter_sound",))), "l_words": accuracy(_f(L, kinds=("listen_pick",))), "l_all": s(_f(L, skill="listen")),
        "l_sentences": accuracy([e for e in _f(L, kinds=("listen_pick",)) if (e.item or "").startswith(("s_", "p_"))]),
        "l_directions": accuracy([e for e in L if (e.item or "") in ("p_left", "p_right", "p_straight", "p_near", "p_toilet")]),
        "l_conversation": accuracy(_f(L, kinds=("reply_pick",), skill="listen")),
        "m_find": s(_f(M, kinds=("find_note",))), "m_pitch": s(_f(M, kinds=("high_low",))), "m_pitch_hard": accuracy(_f(M, kinds=("high_low",), min_d=3)),
        "m_same": s(_f(M, kinds=("same_different",))), "m_rhythm": s(_f(M, skill="rhythm")), "m_tempo": accuracy(_f(M, kinds=("fast_slow",))),
        "m_dynamics": s(_f(M, skill="dynamics")), "m_ear": s(_f(M, kinds=("instrument_guess", "same_different"))),
        "m_memory": s(_f(M, kinds=("echo_melody",))), "m_notes": s(_f(M, kinds=("find_note", "echo_melody", "play_song"))),
        "m_song": accuracy(_f(M, kinds=("play_song",))), "m_sequence": s(_f(M, kinds=("echo_melody", "play_song"))),
        "m_full_song": accuracy(_f(M, kinds=("play_song",), spec=("full_song",))), "m_recovery": error_recovery(M),
        "m_independence": independence(M), "m_basics": accuracy([e for e in M if e.spec.get("topic")]),
        "m_alankar": accuracy([e for e in _f(M, kinds=("play_song",)) if str(e.item or "").startswith(("alankar", "aaroh", "x_"))]),
        "m_new_song": accuracy([e for e in _f(M, kinds=("play_song",)) if e.supported is False]),
        "m_compare": accuracy(_f(M, kinds=("same_different", "high_low", "loud_soft", "fast_slow"))),
        "m_mic": accuracy([e for e in M if (e.spec.get("source") == "mic")]),
    }
    out["r_new_words"] = transfer(_f(L, skill="read"))
    pron = [float(e.spec.get("_pron")) for e in L if e.spec.get("_pron") is not None]
    out["s_native"] = (round(statistics.fmean(pron[-30:]), 1), len(pron)) if len(pron) >= MIN_EVIDENCE else (None, len(pron))
    from . import memory

    goal = memory.focus_override(db, child)
    out["goal"] = skill_score(_f(M, skill=goal)) if goal else (None, 0)
    m_create = _f(M, skill="creativity")
    out["m_create"] = ((min(100.0, 20.0 * len(m_create)), len(m_create)) if m_create else (None, 0))
    ind = out["independence"]
    out["hint_dependence"] = ((round(100 - ind[0], 1) if ind[0] is not None else None), ind[1])
    v = _valid(evs)
    out["error_rate"] = ((round(100 * sum(1 for e in v[-60:] if e.outcome == "miss") / len(v[-60:]), 1), len(v[-60:])) if len(v) >= MIN_EVIDENCE else (None, len(v)))
    known = [i for i in db.scalars(select(LangItemState).where(LangItemState.child_id == child.id)) if i.strength >= 0.6]
    out["repetitions"] = ((None, len(known)) if len(known) < MIN_EVIDENCE else (None, len(known)))
    rep_info = round(statistics.fmean(i.seen for i in known), 1) if len(known) >= MIN_EVIDENCE else None
    items = list(db.scalars(select(LangItemState).where(LangItemState.child_id == child.id)))
    out["v_receptive"] = accuracy(_f(L, skill="listen") + _f(L, skill="read"), 60)
    out["v_expressive"] = accuracy(_f(L, skill="speak") + _f(L, skill="write"), 60)
    out["v_breadth"] = ((min(100.0, round(len(known) * 100 / 40, 1)), len(items)) if len(items) >= MIN_EVIDENCE else (None, len(items)))
    mastered = [i for i in items if i.correct >= 2]
    out["mastery_stability"] = ((round(100 * sum(1 for i in mastered if i.strength >= 0.6) / len(mastered), 1), len(mastered))
                                if len(mastered) >= MIN_EVIDENCE else (None, len(mastered)))
    feelings = [a.score for a in db.scalars(select(Assessment).where(Assessment.child_id == child.id, Assessment.source == "child",
                                                                     Assessment.axis == "feeling").order_by(Assessment.created_at.desc()).limit(10))]
    out["confidence"] = (round(statistics.fmean(feelings), 1), len(feelings)) if feelings else (None, 0)
    result = {k: {"score": v[0], "n": v[1]} for k, v in out.items()}
    # information measures: shown, never scored
    sittings: dict[str, int] = {}
    for e in evs:
        sittings[e.sitting] = sittings.get(e.sitting, 0) + (1 if e.valid else 0)
    by_kind: dict[str, list[int]] = {}
    for e in evs:
        by_kind.setdefault(e.kind, [0, 0])
        by_kind[e.kind][0] += 1
        by_kind[e.kind][1] += e.valid
    misses: dict[str, int] = {}
    for e in v:
        if e.outcome == "miss":
            misses[e.kind] = misses.get(e.kind, 0) + 1
    result["response_time"] = {"score": None, "n": len(v), "info": f"median {response_time(evs)} s" if response_time(evs) is not None else None}
    result["repetitions"]["info"] = f"about {rep_info} tries per known word" if rep_info else None
    result["error_types"] = {"score": None, "n": sum(misses.values()), "info": ", ".join(f"{k} {n}" for k, n in sorted(misses.items(), key=lambda x: -x[1])[:4]) or None}
    result["engagement"] = {"score": None, "n": len(sittings), "info": f"{round(statistics.fmean(sittings.values()), 1)} activities per sitting" if sittings else None}
    pref = sorted(((done / tot, k) for k, (tot, done) in by_kind.items() if tot >= 4), reverse=True)
    result["preferred_format"] = {"score": None, "n": len(pref), "info": ", ".join(k for _, k in pref[:3]) or None}
    first_level = db.scalars(select(LessonSession).where(LessonSession.child_id == child.id, LessonSession.level >= 2)
                             .order_by(LessonSession.started_at)).first()
    if first_level is not None:
        n_before = db.query(LessonSession).filter(LessonSession.child_id == child.id, LessonSession.started_at < first_level.started_at).count()
        result["learning_speed"] = {"score": None, "n": n_before, "info": f"level 2 reached after {n_before} lesson(s)"}
    else:
        result["learning_speed"] = {"score": None, "n": 0, "info": None}
    return result


# --- combining with the assessed 20 % ------------------------------------------------------------------
def _latest_assessments(db: Session, child_id: str) -> dict[tuple[str, str], Assessment]:
    """The assessment that counts for each (area, axis): a human one if recent, else the latest valid AI one."""
    now = utcnow()
    best: dict[tuple[str, str], Assessment] = {}
    for a in db.scalars(select(Assessment).where(Assessment.child_id == child_id, Assessment.status == "active", Assessment.score.is_not(None))
                        .order_by(Assessment.created_at.desc())):
        age = now - _utc(a.created_at)
        human = a.source in ("teacher", "parent")
        if age > timedelta(days=HUMAN_STALE_DAYS if human else AI_STALE_DAYS * 3):
            continue
        if (a.meta or {}).get("assessment_validity") == "invalid":
            continue
        key = (a.area, a.axis)
        cur = best.get(key)
        if cur is None or (human and cur.source == "ai"):
            best[key] = a
    return best


def combine(areas: list[dict], assessed: dict[tuple[str, str], Assessment]) -> list[dict]:
    now = utcnow()
    for area in areas:
        for ax in area["axes"]:
            a = assessed.get((area["id"], ax["id"]))
            ax["assessed"] = None
            w = 0.0
            if a is not None:
                human = a.source in ("teacher", "parent")
                stale = not human and now - _utc(a.created_at) > timedelta(days=AI_STALE_DAYS)
                w = ASSESSED_WEIGHT * (1.0 if human else max(0.0, min(1.0, a.confidence))) * (0.5 if stale else 1.0)
                ax["assessed"] = {"score": round(a.score, 1), "source": a.source, "confidence": round(a.confidence, 2), "note": a.note,
                                  "at": _utc(a.created_at).isoformat(), "stale": stale, "id": a.id}
            m = ax["measured"]
            if m is None and a is not None:
                final, src = a.score, f"{a.source} only (not measured yet)"
            elif m is None:
                final, src = None, "not assessed yet"
            elif a is None or w == 0:
                final, src = m, "measured"
            else:
                final, src = (1 - w) * m + w * a.score, f"{round(100 * (1 - w))}% measured + {round(100 * w)}% {a.source}"
            ax["final"] = None if final is None else round(final, 1)
            ax["band"] = band(ax["final"])
            ax["source"] = src
    return areas


def _snapshot_areas(db: Session, child_id: str, days_ago: int) -> dict | None:
    day = (utcnow() - timedelta(days=days_ago)).date().isoformat()
    snap = db.scalars(select(ProgressSnapshot).where(ProgressSnapshot.child_id == child_id, ProgressSnapshot.day <= day)
                      .order_by(ProgressSnapshot.day.desc())).first()
    return {**(snap.data or {}), "day": snap.day} if snap else None


def tracker(db: Session, child: Child, *, with_catalogue: bool = True) -> dict:
    """Everything the parent and child views (and the AI) need: spider charts, comparison, parameters, assessments."""
    evs, quality = load_events(db, child.id)
    areas = combine(measured_areas(db, child, evs), _latest_assessments(db, child.id))
    past = _snapshot_areas(db, child.id, 14)
    for area in areas:
        before = {a["id"]: a for a in ((past or {}).get("areas", {}).get(area["id"]) or [])}
        for ax in area["axes"]:
            prev = before.get(ax["id"], {}).get("final")
            ax["before"] = prev
            ax["trend"] = None if prev is None or ax["final"] is None else round(ax["final"] - prev, 1)
        scored = [a for a in area["axes"] if a["final"] is not None]
        area["strengths"] = [a["label"] for a in sorted(scored, key=lambda a: -a["final"]) if a["final"] >= 61][:3]
        area["developing"] = [a["label"] for a in sorted(scored, key=lambda a: a["final"]) if a["final"] < 61][:3]
        area["not_assessed"] = [a["label"] for a in area["axes"] if a["final"] is None]
        area["score"] = round(statistics.fmean(a["final"] for a in scored), 1) if len(scored) >= 3 else None
    out = {"weights": {"measured": MEASURED_WEIGHT, "assessed": ASSESSED_WEIGHT}, "bands": [{"max": t, "label": n} for t, n in BANDS],
           "areas": areas, "quality": quality, "updated_at": utcnow().isoformat(), "compared_with": (past or {}).get("day"),
           "recommendations": recommendations(areas),
           "limitations": ["Scores describe what the child did in Melo's activities, not the child. They are not clinical, school-board or age norms.",
                           "Speech recognition and the microphone are less reliable with young voices and noisy rooms; speaking scores are generous.",
                           "Tracing checks that the letter is covered, not stroke order. Camera observations are hints, not judgements.",
                           "An axis without enough activity says 'not assessed yet': it does not mean the child cannot do it."]}
    if with_catalogue:
        measures = _measure_all(db, child, evs)
        params = []
        for p in catalogue():
            m = measures.get(p["measure"] or "", {})
            params.append({**p, "score": m.get("score"), "n": m.get("n", 0), "band": band(m.get("score")), "info": m.get("info"),
                           "how": "measured by the app" if p["measure"] else "needs a teacher / AI observation"})
        out["parameters"] = params
        out["coverage"] = {"total": len(params), "measured": sum(1 for p in params if p["measure"]),
                           "with_evidence": sum(1 for p in params if p["score"] is not None or p["info"])}
        out["assessments"] = [_assessment_dict(a) for a in db.scalars(select(Assessment).where(Assessment.child_id == child.id)
                                                                       .order_by(Assessment.created_at.desc()).limit(40))]
    return out


def _assessment_dict(a: Assessment) -> dict:
    return {"id": a.id, "source": a.source, "area": a.area, "axis": a.axis, "score": a.score, "band": band(a.score), "confidence": a.confidence,
            "note": a.note, "status": a.status, "at": _utc(a.created_at).isoformat(), **{"quality": a.meta or {}}}


# --- lenses: filter the tracker by skill across areas (e.g. Reading in every language) -------------------
LENSES = {
    "listen": ("👂 Listening", ("Listening",)), "speak": ("🗣️ Speaking", ("Speaking",)), "read": ("📖 Reading", ("Reading",)),
    "write": ("✍️ Writing", ("Writing",)), "vocabulary": ("🔤 Vocabulary", ("Vocabulary",)), "conversation": ("💬 Conversation", ("Speaking", "Listening")),
    "music": ("🎹 Instrument & music", ("Music knowledge", "Music performance", "Music expression", "Keyboard")),
    "habits": ("🌱 Learning habits", ("Common", "Cognitive", "Creativity")),
}


def lens_view(t: dict, lens: str) -> dict | None:
    """One spider across areas for a skill lens: e.g. 'read' = the reading axis of every language studied.
    'music' and 'habits' show their own area. Parameters are filtered to the matching groups."""
    if lens not in LENSES:
        return None
    title, groups = LENSES[lens]
    if lens in ("music", "habits"):
        area = next(a for a in t["areas"] if a["id"] == lens)
        axes = [dict(x) for x in area["axes"]]
    else:
        axes = []
        for a in t["areas"]:
            if not a["id"].startswith("lang:"):
                continue
            x = next((x for x in a["axes"] if x["id"] == lens), None)
            if x is not None:
                axes.append({**x, "id": a["id"], "label": a["title"], "emoji": a["emoji"], "skill": lens})
    params = [p for p in t.get("parameters", []) if p["group"] in groups]
    scored = [x for x in axes if x.get("final") is not None]
    return {"lens": lens, "title": title, "axes": axes, "parameters": params,
            "score": round(statistics.fmean(x["final"] for x in scored), 1) if scored else None,
            "developing": [x["label"] for x in sorted(scored, key=lambda x: x["final"]) if x["final"] < 61][:3],
            "strengths": [x["label"] for x in sorted(scored, key=lambda x: -x["final"]) if x["final"] >= 61][:3]}


def teacher_plan(t: dict, lens: str | None = None) -> dict:
    """Without an AI brain: a clear summary, what the child understands, and the next activities, from the tracker."""
    from .curriculum import ACTIVITIES
    from .memory import ACTIVITY_NAMES

    view = lens_view(t, lens) if lens else None

    def in_lens(area_id: str, axis_id: str) -> bool:
        if view is None:
            return True
        if lens in ("music", "habits"):
            return area_id == lens
        return area_id.startswith("lang:") and axis_id == lens

    understands, working, acts = [], [], []
    for a in t["areas"]:
        for x in a["axes"]:
            if x["final"] is None or not in_lens(a["id"], x["id"]):
                continue
            (understands if x["final"] >= 61 else working).append(f"{a['title']} · {x['label']} ({x['band'].lower()}, {x['final']:.0f})")
    for r in t["recommendations"]:
        if not in_lens(r["area"], r["axis"]):
            continue
        if r["area"] == "music" and r.get("skill"):
            names = [ACTIVITY_NAMES.get(k, k) for k, d in ACTIVITIES.items() if d.skill == r["skill"]][:2]
            acts.append({"activity": f"Music lesson focusing on {r['skill']}: {', '.join(names)}", "why": r["reason"], "minutes": 5})
        elif r["area"].startswith("lang:"):
            lang_name = next((a["title"] for a in t["areas"] if a["id"] == r["area"]), r["area"])
            acts.append({"activity": f"Languages → {lang_name} → {r['axis']} chip", "why": r["reason"], "minutes": 5})
        else:
            acts.append({"activity": "Any short lesson", "why": r["reason"], "minutes": 5})
    if view and not acts:  # a lens: the weakest axes of that lens
        weak = sorted((x for x in view["axes"] if x["final"] is not None and x["final"] < 61), key=lambda x: x["final"])[:3]
        for x in weak:
            where = f"Languages → {x['label']} → {view['title']} chip" if lens not in ("music", "habits") else f"{view['title']}: {x['label']}"
            acts.append({"activity": where, "why": f"{x['label']}: {x['band'].lower()} ({x['final']:.0f}); short practice with help first.", "minutes": 5})
        untried = [x for x in view["axes"] if x["final"] is None][:1]
        for x in untried:
            acts.append({"activity": f"Try {view['title']} in {x['label']}", "why": "Not tried enough yet: one playful try shows where to start.", "minutes": 3})
    if not acts:
        acts = [{"activity": "Learning path → next step", "why": "Everything practised is going well: keep the next step short and playful.", "minutes": 5}]
    scope = view["title"] if view else "all areas"
    summary = (f"In {scope}: " + (f"secure in {len(understands)} skill(s)" if understands else "no secure skills yet")
               + (f", still developing {len(working)}" if working else "") + ". "
               + ("Scores come from what the child did in Melo (80 %) plus any teacher or AI assessment (20 %)." if understands or working
                  else "There is not enough activity yet for a reliable picture; a few short lessons will show where to start."))
    return {"source": "offline", "summary": summary, "understands": understands[:6], "working_on": working[:6], "next_activities": acts[:4],
            "home_tip": HABIT_TIPS["regularity"]}


HABIT_TIPS = {  # supportive, never a streak or a pressure to practise more
    "accuracy": "Melo already makes things easier after misses; a few minutes on familiar activities builds sure successes.",
    "consistency": "Short lessons at a similar time of day help results settle.",
    "retention": "Coming back to yesterday's words and tunes the next day is what makes them stick; Melo warms up with them.",
    "independence": "Let the glowing help fade: wait a moment before helping, and praise trying alone.",
    "recovery": "After a mistake, try the same thing once more together; that comeback is what Melo praises most.",
    "regularity": "A little music on more days (5 minutes, every other day) helps more than one long session. No streaks needed.",
    "velocity": "Progress has levelled off for now; a new song or a new topic in Music basics can spark it again.",
}


def recommendations(areas: list[dict]) -> list[dict]:
    """Supportive, explainable next steps: the lowest scored axis in each area, plus axes not yet tried."""
    recs = []
    for area in areas:
        scored = sorted((a for a in area["axes"] if a["final"] is not None), key=lambda a: a["final"])
        if scored and scored[0]["final"] < 61:
            a = scored[0]
            tip = HABIT_TIPS.get(a["id"]) if area["id"] == "habits" else "short, easy practice with help first, then let the help fade."
            recs.append({"area": area["id"], "axis": a["id"], "skill": a.get("skill"), "priority": 1 if a["final"] < 41 else 2,
                         "reason": f"{a['label']}: {a['band'].lower()} ({a['final']:.0f}). {tip}"})
        untried = [a for a in area["axes"] if a["final"] is None and a.get("skill")]
        if untried and area["id"] != "habits":
            recs.append({"area": area["id"], "axis": untried[0]["id"], "skill": untried[0]["skill"], "priority": 3,
                         "reason": f"{untried[0]['label']} has not been tried yet: one playful try will show where to start."})
    return sorted(recs, key=lambda r: r["priority"])[:6]


def needs(db: Session, child: Child, area: str) -> dict[str, float]:
    """0 (strong) .. 1 (needs practice) per skill of an area: the engine and the AI lean on the low ones."""
    for ar in tracker(db, child, with_catalogue=False)["areas"]:
        if ar["id"] == area:
            return {a["skill"] or a["id"]: (0.5 if a["final"] is None else round(1 - a["final"] / 100, 3)) for a in ar["axes"]}
    return {}


# --- after every activity --------------------------------------------------------------------------------
def update_after_activity(db: Session, child: Child) -> dict:
    """Recompute the measured spider charts and store today's snapshot. Cheap enough for every answer."""
    t = tracker(db, child, with_catalogue=False)
    day = utcnow().date().isoformat()
    snap = db.scalars(select(ProgressSnapshot).where(ProgressSnapshot.child_id == child.id, ProgressSnapshot.day == day)).first()
    data = {"day": day, "areas": {a["id"]: [{"id": x["id"], "final": x["final"], "measured": x["measured"], "n": x["n"]} for x in a["axes"]]
                                  for a in t["areas"]}}
    if snap is None:
        db.add(ProgressSnapshot(child_id=child.id, day=day, data=data))
    else:
        snap.data = data
    return t


def history(db: Session, child: Child, area: str, days: int = 90) -> list[dict]:
    since = (utcnow() - timedelta(days=days)).date().isoformat()
    rows = db.scalars(select(ProgressSnapshot).where(ProgressSnapshot.child_id == child.id, ProgressSnapshot.day >= since).order_by(ProgressSnapshot.day))
    out = []
    for r in rows:
        axes = (r.data or {}).get("areas", {}).get(area)
        if axes:
            vals = [a["final"] for a in axes if a.get("final") is not None]
            out.append({"day": r.day, "score": round(statistics.fmean(vals), 1) if vals else None, "axes": {a["id"]: a.get("final") for a in axes}})
    return out


# --- the AI teacher's 20 % ---------------------------------------------------------------------------------
_running: set[str] = set()
_lock = threading.Lock()
AI_MIN_INTERVAL = timedelta(minutes=5)
AI_EVERY_ANSWERS = 12


def _since_last(db: Session, child: Child) -> tuple[timedelta, int]:
    """Time since the last AI review (or failed try) and the answers given since then."""
    last = db.scalars(select(Assessment).where(Assessment.child_id == child.id, Assessment.source.in_(["ai", "system"]))
                      .order_by(Assessment.created_at.desc())).first()
    since = _utc(last.created_at) if last else datetime(2000, 1, 1, tzinfo=timezone.utc)
    n = db.query(Attempt).filter(Attempt.child_id == child.id, Attempt.answered_at >= since).count() + \
        db.query(LangAttempt).filter(LangAttempt.child_id == child.id, LangAttempt.answered_at >= since).count()
    return utcnow() - since, n


def ai_due(db: Session, child: Child, at_end: bool = False) -> bool:
    """During a sitting: every 12 answers. At a session end: whenever 3 or more answers are new.
    Never more than once in 5 minutes (a slow local model must not pile up requests)."""
    gap, n = _since_last(db, child)
    return gap >= AI_MIN_INTERVAL and n >= (MIN_EVIDENCE if at_end else AI_EVERY_ANSWERS)


def request_ai_assessment(child_id: str, reason: str) -> bool:
    """Start an AI assessment in the background (one per child at a time). Returns False if one is running."""
    with _lock:
        if child_id in _running:
            return False
        _running.add(child_id)

    def work() -> None:
        try:
            from .db import session_factory

            with session_factory()() as db:
                child = db.get(Child, child_id)
                if child is not None:
                    run_ai_assessment(db, child, reason)
                    db.commit()
        except Exception:  # an assessment is a bonus: never disturb the child
            log.exception("AI assessment failed")
        finally:
            with _lock:
                _running.discard(child_id)

    threading.Thread(target=work, name="melo-assess", daemon=True).start()
    return True


def _compact(t: dict, limit: int = 5000) -> dict:
    """What the AI sees: per axis measured score + evidence, nothing raw. Cut to fit any model's context."""
    areas = []
    for a in t["areas"]:
        areas.append({"area": a["id"], "title": a["title"],
                      "axes": [{"axis": x["id"], "measured": x["measured"], "n": x["n"], "trend": x["trend"]} for x in a["axes"]]})
    payload = {"areas": areas, "quality": t["quality"]}
    import json

    while len(json.dumps(payload)) > limit and len(payload["areas"]) > 2:
        payload["areas"].pop(-2)  # drop the least-used language first; music and habits stay
    return payload


def run_ai_assessment(db: Session, child: Child, reason: str) -> list[Assessment]:
    """The AI teacher looks at the measured picture and the child's memory and gives its 20 %: a score per axis
    with confidence, an observation, a pace suggestion and the focus for next time. Fully validated."""
    from . import memory
    from .teacher.service import get_teacher

    teacher = get_teacher()
    t = tracker(db, child, with_catalogue=False)
    status = teacher.status()
    meta_base = {"assessment_method": "AI review of measured task results and the learning graph (no audio, video or images)",
                 "input_modality": "interaction", "model_name": status.get("provider"), "model_version": status.get("model"),
                 "evidence_reference": f"{t['quality']['events']} activities up to {t['updated_at'][:16]}", "human_review_status": "not reviewed",
                 "environment_quality": "n/a (aggregated results)", "rubric_version": RUBRIC_VERSION, "reason": reason}
    if not teacher.uses_ai(child):
        return []  # no brain for this child: the tracker stays 100 % measured, nothing to record
    if not ai_due(db, child, at_end=True):
        return []  # nothing new since the last review, or one ran a moment ago
    payload = _compact(t)
    axes = {(a["area"], x["axis"]): x for a in payload["areas"] for x in a["axes"]}
    data = teacher.assess_progress(child, payload, memory.brief(db, child), [f"{a}/{x}" for a, x in axes])
    if not data:
        db.add(Assessment(child_id=child.id, source="system", area="overall", axis="ai_review", score=None, confidence=0.0,
                          note="The AI teacher could not assess this time; the measured scores are unchanged.",
                          meta={**meta_base, "assessment_validity": "invalid",
                                "limitations": getattr(getattr(teacher, "_provider", None), "last_error", None) or "no usable answer (timeout, token limit or refusal)"}))
        return []
    out = []
    for row in (data.get("axes") or [])[:40]:
        key = tuple(str(row.get("axis", "")).split("/", 1))
        if len(key) != 2 or key not in axes:
            continue
        measured, n = axes[key]["measured"], axes[key]["n"]
        score = float(row.get("score", 0))
        conf = max(0.0, min(1.0, float(row.get("confidence", 0.5))))
        validity, limits = "valid", []
        if not 0 <= score <= 100:
            continue
        if measured is not None and abs(score - measured) > AI_MAX_DEVIATION:
            score = measured + (AI_MAX_DEVIATION if score > measured else -AI_MAX_DEVIATION)
            validity = "partially valid"
            limits.append(f"AI score was more than {AI_MAX_DEVIATION} points from the measured score and was limited")
        if n < LIMITED_EVIDENCE:
            conf *= 0.5
            limits.append("limited evidence")
        a = Assessment(child_id=child.id, source="ai", area=key[0], axis=key[1], score=round(score, 1), confidence=round(conf, 2),
                       note=str(row.get("observation", ""))[:300],
                       meta={**meta_base, "confidence_score": round(conf, 2), "assessment_validity": validity, "limitations": "; ".join(limits) or None,
                             "pace": row.get("pace")})
        db.add(a)
        out.append(a)
    if data.get("teacher_note"):
        db.add(Assessment(child_id=child.id, source="ai", area="overall", axis="teacher_note", score=None, confidence=1.0,
                          note=str(data["teacher_note"])[:500], meta={**meta_base, "assessment_validity": "valid",
                                                                      "focus": [f for f in (data.get("focus") or [])[:2] if tuple(f.split("/", 1)) in axes]}))
    db.flush()
    apply_pace(db, child, out)
    # keep the table small: drop failure records older than 30 days
    db.execute(delete(Assessment).where(Assessment.child_id == child.id, Assessment.source == "system",
                                        Assessment.created_at < utcnow() - timedelta(days=30)))
    return out


def apply_pace(db: Session, child: Child, assessed: list[Assessment]) -> list[str]:
    """The AI may suggest a faster or slower pace for an axis. Within the engine's bounds, and only when the
    measured evidence agrees, the working difficulty moves one step (recorded in the timeline)."""
    from . import memory
    from .models import LangSkillState, SkillState

    events = []
    for a in assessed:
        pace = (a.meta or {}).get("pace")
        if pace not in ("faster", "slower") or a.confidence < 0.6:
            continue
        if a.area == "music":
            st = db.scalars(select(SkillState).where(SkillState.child_id == child.id, SkillState.skill == a.axis)).first()
        elif a.area.startswith("lang:") and a.axis in ("listen", "speak", "read", "write"):
            st = db.scalars(select(LangSkillState).where(LangSkillState.child_id == child.id, LangSkillState.lang == a.area[5:],
                                                          LangSkillState.skill == a.axis)).first()
        else:
            continue
        if st is None:
            continue
        if pace == "faster" and a.score >= 65 and st.difficulty < 5:
            st.difficulty += 1
        elif pace == "slower" and a.score < 45 and st.difficulty > 1:
            st.difficulty -= 1
        else:
            continue
        msg = f"AI teacher: {a.area} {a.axis} {'a step harder' if pace == 'faster' else 'a step easier'} (now {st.difficulty})"
        memory._event(db, child.id, "ai_pace", msg)
        events.append(msg)
    return events


def felt_hard_twice(db: Session, child: Child) -> bool:
    last = list(db.scalars(select(Assessment).where(Assessment.child_id == child.id, Assessment.source == "child", Assessment.axis == "feeling")
                           .order_by(Assessment.created_at.desc()).limit(2)))
    return len(last) == 2 and all(a.note == "hard" for a in last) and utcnow() - _utc(last[0].created_at) < timedelta(days=7)


def add_human(db: Session, child: Child, source: str, area: str, axis: str, score: float | None, note: str) -> Assessment:
    a = Assessment(child_id=child.id, source=source, area=area, axis=axis, score=score, confidence=1.0, note=note[:500],
                   meta={"assessment_method": f"{source} observation", "input_modality": "observation", "model_name": None,
                         "human_review_status": "reviewed", "assessment_validity": "valid", "rubric_version": RUBRIC_VERSION})
    db.add(a)
    return a
