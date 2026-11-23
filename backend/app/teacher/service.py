"""TeacherService: the AI teacher facade.

* Offline provider: curated phrase bank + rules. Always available, instant.
* Anthropic provider: Claude makes higher-level teaching decisions (session plan within
  engine-approved options), answers the child's questions and writes practice-review feedback.
* Claude Code provider: the same decisions via the local `claude -p` CLI on the user's
  Claude Code login (no API key).
* Ollama / OpenAI-compatible providers (teacher/llm.py): local models (Ollama, LM Studio, llama.cpp)
  or online services (OpenAI, OpenRouter, Groq, Gemini ...) when Claude Code is not on the computer.
* Every prompt carries the child's memory brief (memory.brief: strengths, struggles, languages, recent
  events, parent notes), so the brain knows the child even in a new or lost session.
  Every call is schema-constrained, time-boxed, safety-filtered and falls back to offline.

Privacy: the child's name is never sent; prompts use the literal placeholder "{name}".
"""
from __future__ import annotations

import base64
import json
import logging
import os
import random
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import threading

from ..config import Settings, get_settings
from ..languages import LANGUAGES
from . import llm, phrases
from .safety import clean_child_text, clean_parent_text, redact_for_ai

log = logging.getLogger("melo.teacher")

LANG_NAMES = {code: info.ai_name for code, info in LANGUAGES.items()}
PACK_KEYS = ("success", "partial", "miss", "retry")
THEMES = ("animals", "rain", "space", "jungle")

SYSTEM_PROMPT = """You are Melo, a gentle, playful music teacher for young children (ages 3-8), inside a music-learning app.
Latency-sensitive; begin your visible answer immediately.

How Melo talks to children:
- Very short, simple sentences (max 2 sentences, max 25 words total). Warm, patient, playful.
- Praise effort, exploration and progress, not perfection. Be specific when praising.
- Never shame, scold, compare the child with other children, or pressure them to continue.
- Mistakes are "lovely tries"; corrections are gentle and concrete ("try a key a little higher").
- Teach one small idea at a time, using concrete images (birds are high, elephants are low).
- Never ask for personal information, never mention buying anything, never include links.
- Address the child only with the literal placeholder {name} (never invent a name).
- Stay on music. If asked about something unrelated, kindly steer back to music.
- If the child seems sad, tired or upset, be kind and suggest a rest; resting is always okay.
- Every child learns differently. Some are shy, some speak late, some need to move, some need many repetitions,
  some race ahead. Never hurry a child, never show impatience, and never say or imply they are slow. Notice the feeling
  first ("that one was tricky"), then offer one tiny next step they can succeed at. Celebrate small steps.
- Give the child a choice when you can ("this one again, or a new one?"). Silence or a wrong answer is never naughty.
- Sound like a real one-on-one teacher sitting beside the child, not a quiz machine: react to what they
  just did, ask a tiny question back ("Shall we try it with your thumb?"), and refer to earlier progress when given.
- Use musical words a child can feel: sargam (Sa Re Ga Ma Pa Dha Ni) for Hindi/Hinglish, letter names for English,
  "high like a bird / low like an elephant", clapping the beat, singing along.
- Vary your wording every time; never start two replies the same way.

When writing for parents: be clear, warm, factual and brief. Base every claim only on the data given; if the data is uncertain, say so."""


def find_claude_cli(name: str = "claude") -> str | None:
    """Locate the Claude Code CLI. An app started from an installer or the desktop often has a
    shorter PATH than a terminal (always on macOS), so the usual install folders are checked too."""
    found = shutil.which(name)
    if found:
        return found
    if os.path.sep in name or (os.path.altsep and os.path.altsep in name):
        return name if os.path.isfile(name) else None
    home = Path.home()
    folders = [home / ".local" / "bin", home / ".claude" / "local", home / ".claude" / "bin", home / "bin",
               home / ".npm-global" / "bin", home / ".bun" / "bin", home / ".volta" / "bin",
               Path("/usr/local/bin"), Path("/opt/homebrew/bin"), Path("/usr/bin")]
    for var in ("APPDATA", "LOCALAPPDATA"):
        if os.environ.get(var):
            folders += [Path(os.environ[var]) / "npm", Path(os.environ[var]) / "Programs" / "claude"]
    exts = [".exe", ".cmd", ".bat", ""] if os.name == "nt" else [""]
    for folder in folders:
        for ext in exts:
            candidate = folder / f"{name}{ext}"
            if candidate.is_file():
                return str(candidate)
    return None


@dataclass
class AIResult:
    data: dict | None
    provider: str


class _AnthropicProvider:
    def __init__(self, settings: Settings) -> None:
        import anthropic

        self._anthropic = anthropic
        self.settings = settings
        self.client = anthropic.Anthropic(
            # No SDK retries: a child is waiting, and every call has an instant offline fallback.
            api_key=settings.anthropic_api_key, timeout=settings.ai_timeout_seconds, max_retries=0
        )

    def structured(self, user_prompt: str, schema: dict, max_tokens: int = 2000, images: list[tuple[bytes, str]] | None = None) -> dict | None:
        a = self._anthropic
        content: Any = user_prompt
        if images:
            content = [{"type": "image", "source": {"type": "base64", "media_type": mime, "data": base64.b64encode(data).decode()}}
                       for data, mime in images] + [{"type": "text", "text": user_prompt}]
        kwargs: dict[str, Any] = {
            "model": self.settings.ai_model,
            "max_tokens": max_tokens,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": content}],
            "thinking": {"type": "adaptive"},
            "output_config": {"effort": self.settings.ai_effort, "format": {"type": "json_schema", "schema": schema}},
        }
        if self.settings.ai_fallbacks:
            kwargs["betas"] = ["server-side-fallback-2026-07-01"]
            kwargs["fallbacks"] = "default"
        try:
            resp = self.client.beta.messages.create(**kwargs)
        except a.BadRequestError as e:
            log.error("Claude rejected the request (check KM_AI_MODEL / KM_AI_FALLBACKS): %s", e.message)
            return None
        except a.AuthenticationError:
            log.error("Claude authentication failed - check ANTHROPIC_API_KEY")
            return None
        except a.RateLimitError:
            log.warning("Claude rate limited; using offline teacher")
            return None
        except a.APIStatusError as e:
            log.warning("Claude API error %s; using offline teacher", e.status_code)
            return None
        except (a.APITimeoutError, a.APIConnectionError):
            log.warning("Claude unreachable/timeout; using offline teacher")
            return None
        if resp.stop_reason in ("refusal", "max_tokens"):
            log.info("Claude stop_reason=%s; using offline teacher", resp.stop_reason)
            return None
        text = next((b.text for b in resp.content if getattr(b, "type", None) == "text"), None)
        if not text:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            log.warning("Claude returned non-JSON output")
            return None
        return data if isinstance(data, dict) else None


class _ClaudeCodeProvider:
    """Uses the local Claude Code CLI (`claude -p`) as the brain, on the user's own Claude Code login.

    No API key: any ANTHROPIC_API_KEY is removed from the child process so the CLI uses its
    logged-in subscription. The CLI runs sealed: no tools, no MCP servers, no hooks, no saved
    session, and an empty working directory so no project CLAUDE.md is picked up.
    Same contract as the API provider: schema-constrained JSON or None (-> offline fallback).
    """

    _SCRUB_ENV = ("ANTHROPIC_API_KEY", "KM_ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")

    def __init__(self, settings: Settings) -> None:
        exe = find_claude_cli(settings.claude_code_bin)
        if not exe:
            raise RuntimeError(f"Claude Code CLI '{settings.claude_code_bin}' not found on this computer")
        self.exe = exe
        self.settings = settings
        self.workdir = Path(settings.data_dir) / "claude-code"
        self.workdir.mkdir(parents=True, exist_ok=True)
        self.system_file = self.workdir / "system_prompt.txt"
        self.system_file.write_text(SYSTEM_PROMPT, encoding="utf-8")

    def command(self, schema: dict, tools: str = "") -> list[str]:
        s = self.settings
        return [
            self.exe, "-p", "--output-format", "json",
            "--model", s.claude_code_model, "--effort", s.ai_effort,
            "--tools", tools, "--strict-mcp-config", "--no-session-persistence",
            "--settings", json.dumps({"disableAllHooks": True}),
            "--system-prompt-file", str(self.system_file),
            "--json-schema", json.dumps(schema),
        ]

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if k not in self._SCRUB_ENV}
        env["CLAUDE_CODE_ENTRYPOINT"] = env.get("CLAUDE_CODE_ENTRYPOINT", "melo")
        return env

    last_error: str | None = None

    def structured(self, user_prompt: str, schema: dict, max_tokens: int = 2000, images: list[tuple[bytes, str]] | None = None) -> dict | None:
        self.last_error = None
        shown: list[Path] = []
        if images:
            # Photos are copied into the CLI's own empty working folder; only the Read tool is allowed, to look at them.
            vision = self.workdir / "vision"
            vision.mkdir(exist_ok=True)
            ext = {"image/png": "png", "image/webp": "webp"}
            for i, (data, mime) in enumerate(images):
                f = vision / f"photo{i + 1}.{ext.get(mime, 'jpg')}"
                f.write_bytes(data)
                shown.append(f)
            user_prompt += "\nThe photos are these files (open each with the Read tool): " + ", ".join("vision/" + f.name for f in shown)
        try:
            return self._run(user_prompt, schema, "Read" if shown else "")
        finally:
            for f in shown:
                f.unlink(missing_ok=True)

    def _run(self, user_prompt: str, schema: dict, tools: str) -> dict | None:
        try:
            proc = subprocess.run(
                self.command(schema, tools), input=user_prompt, capture_output=True, text=True, encoding="utf-8",
                cwd=self.workdir, env=self.env(), timeout=self.settings.claude_code_timeout_seconds,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except subprocess.TimeoutExpired:
            self.last_error = f"Claude Code did not answer within {self.settings.claude_code_timeout_seconds:g} s."
            log.warning("Claude Code timed out after %ss; using offline teacher", self.settings.claude_code_timeout_seconds)
            return None
        except OSError as e:
            self.last_error = f"Could not run the Claude Code CLI: {e}"
            log.error("Could not run Claude Code CLI: %s", e)
            return None
        try:
            out = json.loads(proc.stdout or "")
        except json.JSONDecodeError:
            detail = (proc.stderr or proc.stdout or "").strip()[:300]
            self.last_error = f"Claude Code exited without an answer (are you logged in? run `claude` once in a terminal). {detail}".strip()
            log.warning("Claude Code exited %s without JSON: %s", proc.returncode, detail)
            return None
        if not isinstance(out, dict) or out.get("is_error") or out.get("subtype") != "success":
            detail = str(out.get("result") if isinstance(out, dict) else out)[:300]
            self.last_error = f"Claude Code reported an error: {detail}"
            log.warning("Claude Code error (%s): %s; using offline teacher", out.get("subtype") if isinstance(out, dict) else "?", detail)
            return None
        data = out.get("structured_output")
        if data is None and isinstance(out.get("result"), str):
            try:
                data = json.loads(out["result"])
            except json.JSONDecodeError:
                return None
        return data if isinstance(data, dict) else None


def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or list(props), "additionalProperties": False}


_STR = {"type": "string"}


Provider = Any  # _AnthropicProvider | _ClaudeCodeProvider | llm.OllamaProvider | llm.OpenAICompatProvider


class TeacherService:
    def __init__(self, settings: Settings | None = None) -> None:
        base = settings or get_settings()
        # the parent's choice in the app (brain.json) wins over .env, so no file editing is needed
        saved = llm.load_brain(base.data_dir)
        updates = {("ai_provider" if k == "provider" else k): v for k, v in saved.items() if v}
        self.settings = base.model_copy(update=updates) if updates else base
        self._provider: Provider | None = None
        self._kind = "offline"
        mode = self.settings.ai_provider
        try:
            self._provider, self._kind = self._make(mode)
        except Exception:  # import/config failure must never break lessons
            log.exception("Could not initialise the %s AI provider; running offline", mode)
            self._provider, self._kind = None, "offline"

    def _ollama(self) -> llm.OllamaProvider:
        s = self.settings
        return llm.OllamaProvider(s.ollama_url, s.ollama_model or None, s.llm_timeout_seconds, SYSTEM_PROMPT)

    def _openai(self) -> llm.OpenAICompatProvider:
        s = self.settings
        if not (s.llm_base_url and s.llm_model):
            raise RuntimeError("KM_LLM_BASE_URL and KM_LLM_MODEL are needed for an OpenAI-compatible brain")
        return llm.OpenAICompatProvider(s.llm_base_url, s.llm_model, s.llm_api_key, s.llm_timeout_seconds, SYSTEM_PROMPT)

    def _make(self, mode: str) -> tuple[Provider | None, str]:
        s = self.settings
        if mode == "claude_code":
            return _ClaudeCodeProvider(s), "claude_code"
        if mode == "anthropic" or (mode == "auto" and s.anthropic_api_key):
            return _AnthropicProvider(s), "anthropic"
        if mode == "ollama":
            return self._ollama(), "ollama"
        if mode == "openai":
            return self._openai(), "openai"
        if mode == "auto":
            # Installed app with no configuration: use what is on this computer, best first.
            # Any brain is still only used for children whose parent turned the AI brain on.
            if find_claude_cli(s.claude_code_bin):
                return _ClaudeCodeProvider(s), "claude_code"
            if s.llm_base_url and s.llm_model:
                return self._openai(), "openai"
            if llm.ollama_models(s.ollama_url, timeout=0.6):
                return self._ollama(), "ollama"
        return None, "offline"

    # -- capability ---------------------------------------------------------------------------
    @property
    def ai_available(self) -> bool:
        return self._provider is not None

    def _ask(self, ai: Provider, prompt: str, schema: dict, max_tokens: int = 2000, interactive: bool = False) -> dict | None:
        """A child waiting on the answer gets a short time limit with local / OpenAI-compatible brains."""
        if interactive and isinstance(ai, (llm.OllamaProvider, llm.OpenAICompatProvider)):
            return ai.structured(prompt, schema, max_tokens, timeout=self.settings.llm_interactive_timeout_seconds)
        return ai.structured(prompt, schema, max_tokens)

    def ask_with_images(self, child: Any, prompt: str, schema: dict, images: list[tuple[bytes, str]], max_tokens: int = 2000) -> dict | None:
        """A structured answer that may look at photos (the parent's own pictures of the instrument).
        A brain that cannot see images still answers from the text."""
        ai = self._ai_for(child)
        if not ai:
            return None
        try:
            return ai.structured(prompt, schema, max_tokens, images=images or None)
        except TypeError:  # a provider without image support
            return ai.structured(prompt, schema, max_tokens)

    def uses_ai(self, child: Any) -> bool:
        """True when an AI brain will be asked for this child (so it is worth building the memory brief)."""
        return self._ai_for(child) is not None

    def _ai_for(self, child: Any) -> Provider | None:
        return self._provider if (self._provider and getattr(child, "cloud_ai_allowed", False)) else None

    def self_test(self) -> dict:
        """One tiny real call to the AI brain, for the parent's "Test connection" button."""
        if not self._provider:
            return {"ok": False, "provider": "offline", "model": None, "latency_ms": 0, "reply": None,
                    "message": "No AI brain is connected, so Melo uses its offline teacher. Choose one under Parent → AI brain "
                               "(Claude Code, Ollama, LM Studio or an online service)."}
        start = time.monotonic()
        data = self._provider.structured(
            "Connection test from the parent's settings page. Say a one-sentence cheerful hello to {name} about making music today.",
            _obj({"reply": _STR}), 400)
        ms = round((time.monotonic() - start) * 1000)
        reply = clean_child_text(data.get("reply")) if data else None
        st = self.status()
        if reply:
            return {"ok": True, **st, "latency_ms": ms, "reply": reply, "message": f"Connected ✓ ({st['model']}, {ms / 1000:.1f} s)"}
        return {"ok": False, **st, "latency_ms": ms, "reply": None,
                "message": getattr(self._provider, "last_error", None) or "The AI brain did not return a usable reply."}

    def status(self) -> dict:
        p = self._provider
        model = {"anthropic": self.settings.ai_model, "claude_code": self.settings.claude_code_model}.get(self._kind) or getattr(p, "model", None)
        where = getattr(p, "url", None) or getattr(p, "base_url", None)
        local = self._kind in ("ollama", "claude_code") or bool(getattr(p, "is_local", False))
        return {"provider": self._kind, "model": model, "configured": self.settings.ai_provider, "endpoint": where, "local": local,
                # found on this computer, even when settings keep Melo on another brain
                "claude_code_found": self._kind == "claude_code" or bool(find_claude_cli(self.settings.claude_code_bin))}

    # -- instant lines ------------------------------------------------------------------------
    @staticmethod
    def say(key: str, lang: str, rng: random.Random | None = None, **fmt: object) -> str:
        return phrases.line(key, lang, rng, **fmt)

    # -- session plan (teaching decision within engine-approved bounds) -----------------------
    def say_in_session(self, plan: dict, key: str, lang: str, rng: random.Random | None = None, **fmt: object) -> str:
        """Prefer the lines written for this child's lesson (see prepare_phrase_pack), mixed with the phrase bank."""
        lines = (plan.get("pack") or {}).get(key)
        if lines and (rng or random).random() < 0.65:
            return (rng or random).choice(lines)
        return phrases.line(key, lang, rng, **fmt)

    def prepare_phrase_pack(self, child: Any, session_id: str, skills: dict[str, dict], recent: list[dict], memory: dict | None = None) -> None:
        """Ask the AI brain, in the background, for praise and encouragement written for this child
        and this lesson. The lesson starts at once with the built-in lines; the personal lines join
        in as soon as they arrive, so feedback is personal without the child ever waiting."""
        ai = self._ai_for(child)
        if not ai:
            return
        lang, age, level = child.language, child.age, child.current_level
        prompt = (
            f"Write the short spoken reactions you will use in today's lesson with a {age}-year-old (level {level}).\n"
            f"Language: {LANG_NAMES.get(lang, LANG_NAMES['en'])}. Skill mastery (0-1): {json.dumps(skills)}\n"
            f"Recent attempts (newest last): {json.dumps(recent[-10:])}\n"
            f"What you know about this child from earlier lessons: {json.dumps(memory or {}, ensure_ascii=False)}\n"
            "Give 5 lines each for: success (specific, joyful praise), partial (nearly right), miss (kind, never a judgement, "
            "invite another try), retry (we do the same one again together and you help). One short sentence each, max 12 words, "
            "all different, like a warm teacher sitting beside the child. You may use {name} in at most 2 lines per list."
        )
        arr = {"type": "array", "items": _STR}
        schema = _obj({k: arr for k in PACK_KEYS})

        def work() -> None:
            try:
                data = ai.structured(prompt, schema, 2500)
                if not data:
                    return
                pack = {k: [c for c in (clean_child_text(x, 120) for x in (data.get(k) or [])[:6]) if c] for k in PACK_KEYS}
                pack = {k: v for k, v in pack.items() if len(v) >= 2}
                if not pack:
                    return
                from ..db import session_factory
                from ..models import LessonSession

                with session_factory()() as db:
                    s = db.get(LessonSession, session_id)
                    if s is not None and s.ended_at is None:
                        s.plan = {**(s.plan or {}), "pack": pack}
                        db.commit()
            except Exception:  # personal lines are a bonus; never disturb a lesson
                log.exception("phrase pack failed")

        threading.Thread(target=work, name="melo-phrase-pack", daemon=True).start()

    def plan_session(self, child: Any, skills: dict[str, dict], allowed_focus: list[str], recent: list[dict], rng: random.Random,
                     recall: dict | None = None, memory: dict | None = None, session_id: str | None = None,
                     needs: dict[str, float] | None = None) -> dict:
        lang = child.language
        weakest = min(allowed_focus, key=lambda s: skills.get(s, {}).get("mastery", 0.0)) if allowed_focus else None
        if needs and allowed_focus:  # the progress tracker: the axis that needs most work (measured 80 % + assessed 20 %)
            weakest = max(allowed_focus, key=lambda s: (needs.get(s, 0.5), -skills.get(s, {}).get("mastery", 0.0)))
        plan = {"focus_skill": weakest, "theme": rng.choice(THEMES), "source": "offline"}
        ai = self._ai_for(child)
        if ai and allowed_focus:
            prompt = (
                f"Plan today's short music lesson (about {child.session_minutes} minutes) for a {child.age}-year-old.\n"
                f"Language for child-facing text: {LANG_NAMES[lang]}.\n"
                f"Current level: {child.current_level}. Learning mode: {child.mode}.\n"
                f"Skill mastery (0-1) and difficulty (1-5): {json.dumps(skills)}\n"
                f"Recent attempts (newest last): {json.dumps(recent[-12:])}\n"
                f"From earlier lessons (mention one in the greeting if present): {json.dumps(recall or {}, ensure_ascii=False)}\n"
                f"The child's learning memory (strengths, struggles, languages, recent events, parent notes): {json.dumps(memory or {}, ensure_ascii=False)}\n"
                "Choose what helps this child most today: return to what was hard in small steps, keep what is strong fun, follow parent notes.\n"
                f"Choose ONE focus skill from {allowed_focus} and ONE theme from {list(THEMES)}.\n"
                "Write a greeting for the child (use {name}) and a one-sentence reason for the parent."
            )
            schema = _obj({"focus_skill": {"type": "string", "enum": allowed_focus}, "theme": {"type": "string", "enum": list(THEMES)},
                           "greeting": _STR, "reason_for_parent": _STR})
            data = self._plan_now_or_later(ai, prompt, schema, allowed_focus, session_id)
            if data and data.get("focus_skill") in allowed_focus and data.get("theme") in THEMES:
                plan = {"focus_skill": data["focus_skill"], "theme": data["theme"], "source": "claude",
                        "reason": clean_parent_text(data.get("reason_for_parent"), 300)}
                greeting = clean_child_text(data.get("greeting"))
                if greeting:
                    plan["greeting"] = greeting
        if "greeting" not in plan:
            from ..feedback import recall_line  # local import: feedback imports this package

            plan["greeting"] = " ".join(x for x in (self.say("greeting", lang, rng), recall_line(recall or {}, lang, rng)) if x)
        plan["theme_line"] = self.say(f"theme.{plan['theme']}", lang, rng)
        return plan

    def _plan_now_or_later(self, ai: Provider, prompt: str, schema: dict, allowed: list[str], session_id: str | None) -> dict | None:
        """Claude answers within its own short timeout. A slower brain (a local model on a laptop CPU can take
        40 s) gets a few seconds; if it is not ready, the lesson starts at once with the offline plan and the AI's
        focus skill is slotted in for the following activities when it arrives, like a teacher adjusting mid-lesson."""
        if not isinstance(ai, (llm.OllamaProvider, llm.OpenAICompatProvider)):
            return ai.structured(prompt, schema)
        box: dict = {}
        lock = threading.Lock()

        def work() -> None:
            data = ai.structured(prompt, schema, 600)
            with lock:
                box["data"] = data
                late = box.get("late")
            if late and data and session_id:
                self._apply_late_plan(session_id, data, allowed)

        th = threading.Thread(target=work, name="melo-plan", daemon=True)
        th.start()
        th.join(self.settings.llm_interactive_timeout_seconds)
        with lock:
            if "data" in box:
                return box["data"]
            box["late"] = True
        log.info("AI lesson plan not ready in %ss; starting with the offline plan", self.settings.llm_interactive_timeout_seconds)
        return None

    @staticmethod
    def _apply_late_plan(session_id: str, data: dict, allowed: list[str]) -> None:
        if data.get("focus_skill") not in allowed or data.get("theme") not in THEMES:
            return
        try:
            from ..db import session_factory
            from ..models import LessonSession

            with session_factory()() as db:
                s = db.get(LessonSession, session_id)
                if s is not None and s.ended_at is None:
                    s.plan = {**(s.plan or {}), "focus_skill": data["focus_skill"], "source": "ai-late",
                              "reason": clean_parent_text(data.get("reason_for_parent"), 300)}
                    db.commit()
        except Exception:  # a late plan is a bonus; never disturb a lesson
            log.exception("late plan failed")

    # -- progress assessment: the AI teacher's 20 % of the progress tracker -------------------------
    def assess_progress(self, child: Any, measured: dict, memory: dict | None, axes: list[str]) -> dict | None:
        """Per axis: the AI's own 0-100 judgement, its confidence, one observation and a pace suggestion.
        Background work (no child waits), compact input so it fits small local models too."""
        ai = self._ai_for(child)
        if not ai or not axes:
            return None
        prompt = (
            f"You are the child's teacher reviewing progress for a {child.age}-year-old. Below are the app's MEASURED scores (0-100, "
            "None = not enough activity yet) per area and axis, with n = number of activities and trend = change over 2 weeks.\n"
            f"Measured: {json.dumps(measured, ensure_ascii=False)}\n"
            f"The child's learning memory: {json.dumps(memory or {}, ensure_ascii=False)}\n"
            "Give YOUR teacher assessment for the axes where you have a reason (max 12): score 0-100 describing demonstrated performance on "
            "the tasks (never the child's intelligence, emotions or any diagnosis), confidence 0-1 (low when n is small), a one-sentence "
            "observation for the parent, and pace: 'faster' if ready for harder tasks, 'slower' if the tasks are too hard now, else 'same'. "
            "Stay close to the measured score unless the memory gives a clear reason. completed_concepts lists what the child has "
            "carried through to mastery (whole songs, mastered topics): an axis covering a completed concept must reflect that it was "
            "demonstrated, even if older attempts pull the average down. The 'real_life' axes measure whether the child can APPLY "
            "the learning to everyday situations: weigh them as heavily as knowing; knowing without applying is not yet mastery. "
            "If milestone is set, the child just completed something: say so in the teacher_note. "
            "Then focus: the 1-2 axes to work on next, and "
            "teacher_note: 2 short, kind, specific sentences for the parent with one thing to do at home."
        )
        row = _obj({"axis": {"type": "string", "enum": axes}, "score": {"type": "number"}, "confidence": {"type": "number"},
                    "observation": _STR, "pace": {"type": "string", "enum": ["faster", "same", "slower"]}})
        schema = _obj({"axes": {"type": "array", "items": row}, "focus": {"type": "array", "items": {"type": "string", "enum": axes}},
                       "teacher_note": _STR})
        data = self._ask(ai, prompt, schema, 1500)
        if not data:
            return None
        note = clean_parent_text(data.get("teacher_note"), 500)
        data["teacher_note"] = note
        data["axes"] = [{**r, "observation": clean_parent_text(r.get("observation"), 300) or ""} for r in (data.get("axes") or []) if isinstance(r, dict)]
        return data

    def summarize_progress(self, child: Any, tracker: dict, memory: dict | None, draft: dict) -> dict | None:
        """A parent / teacher summary and the next lesson plan, from the tracker. A parent is waiting: at most 60 s."""
        ai = self._ai_for(child)
        if not ai:
            return None
        prompt = (
            f"Summarise the learning progress of a {child.age}-year-old for the parent and teacher, and plan the next lesson.\n"
            f"Progress tracker (0-100: 80 % measured from activities + 20 % teacher/AI assessment; None = not enough activity yet): "
            f"{json.dumps(tracker, ensure_ascii=False)}\n"
            f"The child's learning memory: {json.dumps(memory or {}, ensure_ascii=False)}\n"
            f"A rule-based draft to improve on: {json.dumps(draft, ensure_ascii=False)}\n"
            "summary: 2-3 clear sentences. understands: up to 5 things the child clearly understands (from high scores). working_on: up to "
            "5 things still developing. next_activities: 2-4 concrete Melo activities (Music lesson / Music basics topic / a song / "
            "Languages -> language -> skill) with why and minutes (3-10). home_tip: one thing to do at home. Describe task performance only: "
            "no labels, diagnoses or comparisons with other children."
        )
        act = _obj({"activity": _STR, "why": _STR, "minutes": {"type": "integer"}})
        arr = {"type": "array", "items": _STR}
        schema = _obj({"summary": _STR, "understands": arr, "working_on": arr, "next_activities": {"type": "array", "items": act}, "home_tip": _STR})
        if isinstance(ai, (llm.OllamaProvider, llm.OpenAICompatProvider)):
            data = ai.structured(prompt, schema, 1200, timeout=60)
        else:
            data = ai.structured(prompt, schema, 1500)
        if not data:
            return None
        out = {"summary": clean_parent_text(data.get("summary"), 600), "home_tip": clean_parent_text(data.get("home_tip"), 300),
               "understands": [x for x in (clean_parent_text(s, 200) for s in (data.get("understands") or [])[:5]) if x],
               "working_on": [x for x in (clean_parent_text(s, 200) for s in (data.get("working_on") or [])[:5]) if x],
               "next_activities": [{"activity": clean_parent_text(a.get("activity"), 160) or "", "why": clean_parent_text(a.get("why"), 240) or "",
                                    "minutes": max(1, min(15, int(a.get("minutes") or 5)))} for a in (data.get("next_activities") or [])[:4]]}
        return {k: v for k, v in out.items() if v}

    # -- conversational teacher ------------------------------------------------------------------
    _INTENTS = [
        ("chat.tired", r"\b(tired|sleepy|stop|bored|thak|neend|bas)\b|थक|नींद|बस"),
        ("chat.hello", r"\b(hi|hello|hey|namaste)\b|नमस्ते"),
        ("chat.note", r"\b(note|notes|sur|swar)\b|सुर|स्वर"),
        ("chat.rhythm", r"\b(rhythm|beat|taal|tal|drum)\b|ताल|ढोल"),
        ("chat.song", r"\b(song|gaana|gana|sing|music)\b|गाना|गीत"),
    ]

    def chat(self, child: Any, message: str, history: list[dict], memory: dict | None = None) -> dict:
        lang = child.language
        msg = message.strip()[:300]
        ai = self._ai_for(child)
        if ai:
            safe_msg = redact_for_ai(msg, child.name)
            hist = [{"from": h.get("from"), "text": redact_for_ai(str(h.get("text", "")), child.name)} for h in history[-6:]]
            prompt = (
                f"A {child.age}-year-old is talking to you during music time. Reply in {LANG_NAMES[lang]}.\n"
                f"What you know about this child: {json.dumps(memory or {}, ensure_ascii=False)}\n"
                f"Recent conversation: {json.dumps(hist, ensure_ascii=False)}\n"
                f"The child just said: {json.dumps(safe_msg, ensure_ascii=False)}\n"
                "Reply with one short, kind, music-focused answer. Set wants_rest=true if the child seems tired or upset, "
                "and wants_game=true if they ask to play."
            )
            data = self._ask(ai, prompt, _obj({"reply": _STR, "wants_rest": {"type": "boolean"}, "wants_game": {"type": "boolean"}}), 1500, interactive=True)
            reply = clean_child_text(data.get("reply")) if data else None
            if reply:
                return {"reply": reply, "wants_rest": bool(data.get("wants_rest")), "wants_game": bool(data.get("wants_game")), "source": "claude"}
        low = msg.lower()
        for key, pattern in self._INTENTS:
            if re.search(pattern, low):
                return {"reply": self.say(key, lang), "wants_rest": key == "chat.tired", "wants_game": key == "chat.song", "source": "offline"}
        return {"reply": self.say("chat.fallback", lang), "wants_rest": False, "wants_game": False, "source": "offline"}

    # -- progression: the next sargam exercise, a small step harder ----------------------------------
    def make_exercise(self, child: Any, topic: str, tier: int, mastery: float, done_titles: list[str], memory: dict | None = None) -> dict | None:
        """Claude designs the next exercise. Returns raw fields (validated by basics.validate) or None."""
        from ..basics import SWARS_FOR_TIER  # local import: basics imports teacher.safety

        ai = self._ai_for(child)
        if not ai:
            return None
        names = list(SWARS_FOR_TIER[max(1, min(3, tier))])
        prompt = (
            f"Design the next sargam practice exercise (an alankar) for a {child.age}-year-old. Topic: {topic}. "
            f"Progress tier {tier} of 3 (skill mastery {mastery:.2f}).\n"
            f"Use ONLY these swar names: {names}. Sa=C. A trailing ' means upper (taar) saptak, a leading . means lower (mandra) "
            "saptak, (k)=komal, (t)=tivra. At tier 3 stay inside one thaat (e.g. Yaman uses Ma(t); Kafi uses ga(k) and ni(k)).\n"
            f"What you know about this child: {json.dumps(memory or {}, ensure_ascii=False)}\n"
            f"Already practised: {json.dumps(done_titles[-8:], ensure_ascii=False)}. Make something new and only a small step harder: "
            "8-24 swars with a clear repeating pattern a child can learn in parts (phrase_length = notes per part, 4-9).\n"
            "beats: one value per swar, each 0.5, 1 or 2. title: short and fun, max 6 words. "
            f"intro: 1-2 short sentences for the child in {LANG_NAMES[child.language]} (use {{name}}) saying what is new."
        )
        schema = _obj({"title": _STR, "intro": _STR, "swars": {"type": "array", "items": {"type": "string", "enum": names}},
                       "beats": {"type": "array", "items": {"type": "number"}}, "phrase_length": {"type": "integer"}})
        return ai.structured(prompt, schema, 2500)

    # -- practice review feedback ------------------------------------------------------------------
    def recording_feedback(self, child: Any, analysis: dict, previous: dict | None) -> dict:
        lang = child.language
        base = offline_recording_feedback(analysis, previous)
        ai = self._ai_for(child)
        if not ai or not analysis.get("reliable", False):
            return base
        prompt = (
            f"A parent uploaded a practice recording of their {child.age}-year-old (instrument: {child.instrument}).\n"
            "Our audio analyser produced these measurements (they may contain detection errors):\n"
            f"{json.dumps(_analysis_digest(analysis), ensure_ascii=False)}\n"
            f"Previous recording of the same piece (if any): {json.dumps(_analysis_digest(previous) if previous else None)}\n"
            f"Draft structured feedback: {json.dumps(base, ensure_ascii=False)}\n"
            f"Improve the wording. child_message must be in {LANG_NAMES[lang]} (use {{name}}). "
            "parent_summary in English, 2-4 sentences, honest about uncertainty. Keep strengths/focus grounded in the data. "
            "lesson_steps: 3 tiny, playful steps (one idea each) for the next practice."
        )
        schema = _obj({"child_message": _STR, "parent_summary": _STR,
                       "strengths": {"type": "array", "items": _STR}, "focus": {"type": "array", "items": _STR},
                       "lesson_steps": {"type": "array", "items": _STR}})
        data = ai.structured(prompt, schema, 3000)
        if not data:
            return base
        out = dict(base)
        cm = clean_child_text(data.get("child_message"))
        if cm:
            out["child_message"] = cm
        ps = clean_parent_text(data.get("parent_summary"))
        if ps:
            out["parent_summary"] = ps
        for k in ("strengths", "focus", "lesson_steps"):
            items = [clean_parent_text(x, 200) for x in (data.get(k) or [])][:4]
            items = [x for x in items if x]
            if items:
                out[k] = items
        out["source"] = "claude"
        return out


def _analysis_digest(a: dict | None) -> dict | None:
    if not a:
        return None
    keys = ("duration_seconds", "instrument_guess", "song_match", "note_accuracy", "rhythm_stability", "tempo_bpm",
            "notes_detected", "recurring_mistakes", "hesitations", "reliable", "voiced_ratio")
    return {k: a.get(k) for k in keys if k in a}


def offline_recording_feedback(analysis: dict, previous: dict | None) -> dict:
    if not analysis.get("reliable", False):
        return {
            "child_message": "Thank you for playing for me, {name}! Let's play again a little closer to the microphone.",
            "parent_summary": "The recording was too quiet or noisy for a reliable analysis, so we are not judging this one. "
                              "Try recording in a quieter room with the device about 1 metre from the instrument.",
            "strengths": ["Showed up to practice - that is the most important habit."],
            "focus": [], "lesson_steps": ["Play 3 favourite notes loudly and clearly.", "Record a short 30-second try."],
            "source": "offline",
        }
    strengths, focus, steps = [], [], []
    song = analysis.get("song_match") or {}
    acc = analysis.get("note_accuracy")
    rhy = analysis.get("rhythm_stability")
    if song.get("title") and song.get("confidence", 0) >= 0.5:
        strengths.append(f"Recognisably played {song['title']}.")
    if acc is not None and acc >= 0.8:
        strengths.append("Most notes were the right ones.")
    if rhy is not None and rhy >= 0.75:
        strengths.append("Kept a steady beat.")
    if analysis.get("notes_detected", 0) >= 20:
        strengths.append("Played with energy and kept going.")
    if not strengths:
        strengths.append("Kept trying and explored the keyboard.")
    for m in (analysis.get("recurring_mistakes") or [])[:2]:
        focus.append(m["description"])
        steps.append(f"Echo game: play {m['expected_name']} three times, then the notes around it.")
    if rhy is not None and rhy < 0.6:
        focus.append("Keeping an even beat.")
        steps.append("Clap along with a slow drum beat, then play one note per clap.")
    if (analysis.get("hesitations") or 0) >= 3:
        focus.append("Small pauses between notes.")
        steps.append("Play just the first phrase slowly, two times in a row without stopping.")
    if not steps:
        steps = ["Play the song once slowly.", "Play it once a little faster.", "Make up a new ending!"]
    progress = ""
    if previous and acc is not None and previous.get("note_accuracy") is not None:
        delta = acc - previous["note_accuracy"]
        if delta > 0.05:
            progress = " Note accuracy improved since the last recording of this piece."
        elif delta < -0.05:
            progress = " Accuracy was a little lower than last time - normal day-to-day variation for young learners."
    title = song.get("title") if song.get("confidence", 0) >= 0.5 else "free play"
    summary = (f"We heard about {analysis.get('notes_detected', 0)} notes ({title}). "
               + (f"About {round(acc * 100)}% of notes matched the melody. " if acc is not None and title != "free play" else "")
               + (f"Beat steadiness: {round(rhy * 100)}%. " if rhy is not None else "") + progress).strip()
    return {
        "child_message": "Wow, {name}, I loved listening to your music! " + ("You kept a lovely beat!" if (rhy or 0) >= 0.75 else "Let's play it again together!"),
        "parent_summary": summary,
        "strengths": strengths[:3], "focus": focus[:3], "lesson_steps": steps[:3],
        "source": "offline",
    }


_service: TeacherService | None = None


def get_teacher() -> TeacherService:
    global _service
    if _service is None:
        _service = TeacherService()
    return _service


def reset_teacher() -> None:
    global _service
    _service = None
