"""ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Parent(Base):
    __tablename__ = "parents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    children: Mapped[list[Child]] = relationship(back_populates="parent", cascade="all, delete-orphan", passive_deletes=True)


class Child(Base):
    __tablename__ = "children"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    parent_id: Mapped[str] = mapped_column(ForeignKey("parents.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    age: Mapped[int] = mapped_column(Integer)
    avatar: Mapped[str] = mapped_column(String(20), default="owl")
    language: Mapped[str] = mapped_column(String(10), default="en")  # en | hi | hinglish
    instrument: Mapped[str] = mapped_column(String(20), default="piano")
    mode: Mapped[str] = mapped_column(String(20), default="screen")  # screen | real | listening | practice
    session_minutes: Mapped[int] = mapped_column(Integer, default=5)
    reminder_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM local
    reminder_days: Mapped[list[int]] = mapped_column(JSON, default=list)  # 0=Mon..6=Sun
    consent_camera: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_microphone: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_recording: Mapped[bool] = mapped_column(Boolean, default=False)
    cloud_ai_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    current_level: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    parent: Mapped[Parent] = relationship(back_populates="children")
    skills: Mapped[list[SkillState]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    sessions: Mapped[list[LessonSession]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    recordings: Mapped[list[Recording]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    consent_events: Mapped[list[ConsentEvent]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    exercises: Mapped[list[CustomExercise]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class ConsentEvent(Base):
    __tablename__ = "consent_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    granted: Mapped[bool] = mapped_column(Boolean)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SkillState(Base):
    __tablename__ = "skill_states"
    __table_args__ = (UniqueConstraint("child_id", "skill"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(20))
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    fail_streak: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LessonSession(Base):
    __tablename__ = "lesson_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    mode: Mapped[str] = mapped_column(String(20), default="screen")
    seed: Mapped[int] = mapped_column(Integer, default=0)
    plan: Mapped[dict] = mapped_column(JSON, default=dict)
    activities_done: Mapped[int] = mapped_column(Integer, default=0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    miss_run: Mapped[int] = mapped_column(Integer, default=0)
    skip_run: Mapped[int] = mapped_column(Integer, default=0)
    uncertain_run: Mapped[int] = mapped_column(Integer, default=0)
    new_types_introduced: Mapped[list[str]] = mapped_column(JSON, default=list)
    pending_override: Mapped[str | None] = mapped_column(String(20), nullable=True)  # game | easy
    end_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    attempts: Mapped[list[Attempt]] = relationship(cascade="all, delete-orphan", passive_deletes=True, order_by="Attempt.created_at")


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (Index("ix_attempts_child_type_outcome", "child_id", "activity_type", "outcome"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("lesson_sessions.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    activity_type: Mapped[str] = mapped_column(String(30))
    skill: Mapped[str] = mapped_column(String(20))
    level: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[int] = mapped_column(Integer)
    spec: Mapped[dict] = mapped_column(JSON)  # full spec incl. answer (never sent raw to the client)
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(12), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Recording(Base):
    __tablename__ = "recordings"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(80), default="Practice")
    song_hint: Mapped[str | None] = mapped_column(String(40), nullable=True)
    storage_name: Mapped[str] = mapped_column(String(64))
    duration_seconds: Mapped[float] = mapped_column(Float)
    sample_rate: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | analyzed | failed
    error: Mapped[str | None] = mapped_column(String(200), nullable=True)
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    feedback: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiToken(Base):
    """Personal access token for Claude Code / MCP. Only a SHA-256 hash is stored."""

    __tablename__ = "api_tokens"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    parent_id: Mapped[str] = mapped_column(ForeignKey("parents.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60), default="Claude Code")
    prefix: Mapped[str] = mapped_column(String(16))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    allow_write: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class CustomExercise(Base):
    """A sargam exercise made for one child as they progress (by Melo's AI brain, Claude Code over MCP, or offline)."""
    __tablename__ = "custom_exercises"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(20))
    tier: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(80))
    notes: Mapped[list] = mapped_column(JSON)  # [[midi, beats], ...]
    phrases: Mapped[list] = mapped_column(JSON)
    intro: Mapped[str | None] = mapped_column(String(300), nullable=True)
    bpm: Mapped[int] = mapped_column(Integer, default=84)
    source: Mapped[str] = mapped_column(String(20), default="offline")  # offline | claude | claude-code
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# --- Language learning (listen / speak / read / write), per child and language -------------------
class LangSkillState(Base):
    __tablename__ = "lang_skill_states"
    __table_args__ = (UniqueConstraint("child_id", "lang", "skill"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    lang: Mapped[str] = mapped_column(String(10))
    skill: Mapped[str] = mapped_column(String(10))  # listen | speak | read | write
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    fail_streak: Mapped[int] = mapped_column(Integer, default=0)


class LangItemState(Base):
    """How well the child knows one word of one language (drives what is practised next)."""
    __tablename__ = "lang_item_states"
    __table_args__ = (UniqueConstraint("child_id", "lang", "item"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    lang: Mapped[str] = mapped_column(String(10))
    item: Mapped[str] = mapped_column(String(40))
    strength: Mapped[float] = mapped_column(Float, default=0.0)
    seen: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LangAttempt(Base):
    __tablename__ = "lang_attempts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    lang: Mapped[str] = mapped_column(String(10))
    activity: Mapped[str] = mapped_column(String(20))
    skill: Mapped[str] = mapped_column(String(10))
    difficulty: Mapped[int] = mapped_column(Integer)
    spec: Mapped[dict] = mapped_column(JSON)  # full spec incl. answer (never sent raw to the client)
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(12), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InstrumentProfile(Base):
    """The child's real instrument at home, described by the parent (form, photos, product links), so lessons
    can be personalised: the right number of keys, the key stickers, where to find "home" on THAT instrument.
    No profile = the standard on-screen piano lessons."""
    __tablename__ = "instrument_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(20), default="keyboard")
    name: Mapped[str] = mapped_column(String(80), default="")
    keys: Mapped[int | None] = mapped_column(Integer, nullable=True)  # keys / bars / pads
    first_key: Mapped[str] = mapped_column(String(3), default="C")  # leftmost white key (keyboards) / lowest bar
    labels: Mapped[str] = mapped_column(String(12), default="none")  # none | letters | numbers | colors | sargam | solfege
    features: Mapped[dict] = mapped_column(JSON, default=dict)  # mic, record, lights, demo_songs, teach_mode ...
    sources: Mapped[list] = mapped_column(JSON, default=list)  # [{url, title, found}]
    photos: Mapped[list] = mapped_column(JSON, default=list)  # [{id, file, mime}]
    notes: Mapped[str] = mapped_column(String(4000), default="")  # the parent's words, or pasted product text
    summary: Mapped[str] = mapped_column(String(400), default="")  # one friendly line Melo can say to the child
    tips: Mapped[list] = mapped_column(JSON, default=list)  # practical tips for the parent (from the analysis)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ChildPrefs(Base):
    """Per-child choices that are not lesson state: the school class for maths / science, and the teacher
    persona and voice the parent picked for each subject ({"maths": {"persona", "voice", "rate", "pitch"}, ...})."""
    __tablename__ = "child_prefs"
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SubjectProgress(Base):
    """How a child is doing in one maths / science topic: difficulty 1-5 moves with the results."""
    __tablename__ = "subject_progress"
    __table_args__ = (UniqueConstraint("child_id", "subject", "topic"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(12))
    topic: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    rounds: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
