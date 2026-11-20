"""Request/response schemas (strict, bounded)."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from datetime import timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator

Language = Literal["en", "hi", "hinglish", "es", "fr", "zh", "ar"]  # keep in step with app/languages.py
Mode = Literal["screen", "real", "listening", "practice"]
Instrument = Literal["piano"]  # guitar / violin arrive in Phase 4
Avatar = Literal["owl", "cat", "elephant", "bird", "fish", "lion"]

_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$")


def clean_name(v: str) -> str:
    v = " ".join(v.split())
    if not v or any(c in v for c in "<>{}"):
        raise ValueError("Please use letters only")
    return v


def clean_days(v: list[int]) -> list[int]:
    if any(d < 0 or d > 6 for d in v):
        raise ValueError("Days must be 0 (Mon) to 6 (Sun)")
    return sorted(set(v))


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Strict):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class LoginIn(Strict):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ParentOut(BaseModel):
    id: str
    email: str


class ChildBase(Strict):
    name: str = Field(min_length=1, max_length=40)
    age: int = Field(ge=2, le=12)
    avatar: Avatar = "owl"
    language: Language = "en"
    instrument: Instrument = "piano"
    mode: Mode = "screen"
    session_minutes: int = Field(default=5, ge=2, le=20)
    reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    reminder_days: list[int] = Field(default_factory=list, max_length=7)
    cloud_ai_allowed: bool = False

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return clean_name(v)

    @field_validator("reminder_days")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return clean_days(v)


class ChildCreate(ChildBase):
    consent_camera: bool = False
    consent_microphone: bool = False
    consent_recording: bool = False


class ChildUpdate(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    age: int | None = Field(default=None, ge=2, le=12)
    avatar: Avatar | None = None
    language: Language | None = None
    instrument: Instrument | None = None
    mode: Mode | None = None
    session_minutes: int | None = Field(default=None, ge=2, le=20)
    reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    clear_reminder: bool = False
    reminder_days: list[int] | None = Field(default=None, max_length=7)
    cloud_ai_allowed: bool | None = None
    # "My child already knows this": a parent can move the child to any level
    current_level: int | None = Field(default=None, ge=1, le=4)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return None if v is None else clean_name(v)

    @field_validator("reminder_days")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return None if v is None else clean_days(v)


class ConsentUpdate(Strict):
    camera: bool | None = None
    microphone: bool | None = None
    recording: bool | None = None


class ChildOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    age: int
    avatar: str
    language: str
    instrument: str
    mode: str
    session_minutes: int
    reminder_time: str | None
    reminder_days: list[int]
    consent_camera: bool
    consent_microphone: bool
    consent_recording: bool
    cloud_ai_allowed: bool
    current_level: int
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)  # SQLite drops tz info


class StartSessionIn(Strict):
    mode: Mode | None = None
    # Music Basics: practise one topic (swars, rhythm, ...) instead of a mixed lesson
    topic: Literal["swars", "rhythm", "high_low", "loud_soft", "fast_slow", "instruments", "ear"] | None = None
    # The microphone is on and Melo listens to the child's real instrument (needs the parent's consent)
    ears: bool = False
    focus: Literal["pitch", "dynamics", "timbre", "rhythm", "melody", "creativity"] | None = None


class AnswerIn(Strict):
    response: dict = Field(default_factory=dict)


class SignalIn(Strict):
    signal: Literal["tired", "stop", "frustrated", "want_game"]


class ChatIn(Strict):
    message: str = Field(min_length=1, max_length=300)
    history: list[dict] = Field(default_factory=list, max_length=12)


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    song_hint: str | None
    duration_seconds: float
    status: str
    error: str | None
    analysis: dict
    feedback: dict
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
