"""Application configuration (12-factor: everything from env / .env)."""
from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

import sys

FROZEN = bool(getattr(sys, "frozen", False))  # running from the installed desktop app (PyInstaller)
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", REPO_DIR))  # where bundled read-only files live


def user_data_dir() -> Path:
    """Per-user folder for the database, recordings and keys of the installed app."""
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return base / "Melo"


DEFAULT_DATA_DIR = user_data_dir() if FROZEN else REPO_DIR / "data"
DEFAULT_DIST = BUNDLE_DIR / "frontend_dist" if FROZEN else REPO_DIR / "frontend" / "dist"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KM_",
        # installed app: an optional settings file next to the data (Melo/.env)
        env_file=(str(DEFAULT_DATA_DIR / ".env"),) if FROZEN else (str(REPO_DIR / ".env"), str(BACKEND_DIR / ".env")),
        extra="ignore",
    )

    env: Literal["development", "production", "test"] = "production" if FROZEN else "development"
    host: str = "127.0.0.1"
    port: int = 8000
    data_dir: Path = DEFAULT_DATA_DIR
    database_url: str | None = None
    frontend_dist: Path = DEFAULT_DIST
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    secret_key: str | None = None
    recording_key: str | None = None
    session_ttl_hours: int = 72
    cookie_secure: bool | None = None  # None = automatic (Secure when the request arrived over HTTPS)

    # AI teacher
    # auto = Claude API when a key is set, else the local Claude Code CLI, else an OpenAI-compatible endpoint
    # (KM_LLM_BASE_URL), else a running Ollama, else offline. The parent can also choose in the app (saved to brain.json).
    ai_provider: Literal["auto", "anthropic", "claude_code", "ollama", "openai", "offline"] = "auto"
    # retail = the installers families buy: Claude Code (a personal subscription) is never used or offered as the
    # brain; families choose the offline teacher, a free local model (Ollama) or their own API key. dev = the owner's
    # own copy and source runs. Installed (frozen) copies default to retail; KM_EDITION=dev in Melo/.env overrides.
    edition: Literal["dev", "retail"] = "retail" if FROZEN else "dev"
    anthropic_api_key: str | None = Field(
        default=None, validation_alias=AliasChoices("KM_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY")
    )
    ai_model: str = "claude-opus-5-5"
    ai_effort: Literal["low", "medium", "high"] = "low"
    ai_timeout_seconds: float = 12.0
    ai_fallbacks: bool = True  # server-side refusal fallback (Claude API)
    # Claude Code CLI provider (KM_AI_PROVIDER=claude_code)
    claude_code_bin: str = "claude"
    claude_code_model: str = "sonnet"  # CLI alias or full model id; sonnet/haiku keep replies around 4 s
    claude_code_timeout_seconds: float = 30.0  # CLI start-up adds a few seconds over the API
    # Ollama (KM_AI_PROVIDER=ollama): local models, free and private. Empty model = pick from what is installed.
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = ""
    # Any OpenAI-compatible endpoint (KM_AI_PROVIDER=openai): LM Studio, llama.cpp, vLLM, OpenAI, OpenRouter, Groq, Gemini ...
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str | None = None
    llm_timeout_seconds: float = 180.0  # background work (personal lines, exercises, recording feedback): no child waits on it
    # Contact (web page or email) sent to Wikimedia when downloading native-speaker recordings, as its policy asks.
    wikimedia_contact: str = ""
    # Mozilla Data Collective API key (Common Voice sentence recordings, downloaded on this computer only)
    mdc_api_key: str = ""
    # Synthetic neural voices (edge-tts / gTTS) for words with no native recording yet. Only built-in words are sent.
    tts_online: bool = True
    llm_interactive_timeout_seconds: float = 8.0  # a child is waiting (lesson start, chat): then the offline teacher steps in

    # Recordings
    max_recording_seconds: int = 600
    max_upload_mb: int = 40

    # Claude Code / MCP: extra Host headers allowed for /mcp (e.g. "melo.local:8000") when not on localhost
    mcp_allowed_hosts: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # Abuse protection
    login_rate_per_minute: int = 10

    @field_validator("cors_origins", "mcp_allowed_hosts", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def secure_cookies(self) -> bool:
        """True only when HTTPS is explicitly declared (used for HSTS)."""
        return bool(self.cookie_secure)

    @property
    def recordings_dir(self) -> Path:
        return self.data_dir / "recordings"

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'melo.db').as_posix()}"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.recordings_dir.mkdir(parents=True, exist_ok=True)

    def resolved_secret_key(self) -> str:
        return self.secret_key or _load_or_create(self.data_dir / ".secret_key", lambda: secrets.token_urlsafe(48))

    def resolved_recording_key(self) -> bytes:
        if self.recording_key:
            return self.recording_key.encode()
        from cryptography.fernet import Fernet

        return _load_or_create(self.data_dir / ".recording_key", lambda: Fernet.generate_key().decode()).encode()


def _load_or_create(path: Path, factory) -> str:
    """Persist a generated secret once so restarts keep sessions/recordings valid."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    value = factory()
    # O_EXCL avoids a race between two workers creating different keys.
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return path.read_text(encoding="utf-8").strip()
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(value)
    return value


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
