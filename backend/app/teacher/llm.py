"""Other AI brains for Melo, for when Claude Code is not on this computer (or the family prefers another):

* Ollama (local, free, private): native /api/chat with the JSON schema as `format`, so even small models
  return valid JSON. Auto-detected on http://127.0.0.1:11434; the model is picked from what is installed.
* Any OpenAI-compatible endpoint:
    local  - LM Studio (:1234/v1), llama.cpp server (:8080/v1), Jan (:1337/v1), vLLM, LocalAI, Ollama's /v1
    online - OpenAI, OpenRouter, Groq, Together, Mistral, DeepSeek, Google Gemini (OpenAI-compatible URL) ...
  Uses response_format json_schema, and falls back to json_object / plain JSON for servers without it.

Same contract as the Claude providers: `structured(prompt, schema)` returns a dict that matches the schema,
or None (the app then uses its offline teacher). Every answer is checked against the schema here, because
local models drift more than Claude. Only the standard library is used (nothing extra to install or bundle).
Privacy: prompts never contain the child's name (the literal placeholder {name} is used).
"""
from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

log = logging.getLogger("melo.teacher")

OLLAMA_DEFAULT = "http://127.0.0.1:11434"
# Small instruction models that follow schemas well and answer quickly on a laptop, best first.
OLLAMA_PREFERRED = ("qwen3", "qwen2.5", "llama3.2", "llama3.1", "gemma3", "gemma2", "mistral", "phi4", "phi3", "llama3")
# Well-known local OpenAI-compatible servers, probed by the parent's "find AI brains" button.
LOCAL_SERVERS = (("LM Studio", "http://127.0.0.1:1234/v1"), ("llama.cpp", "http://127.0.0.1:8080/v1"), ("Jan", "http://127.0.0.1:1337/v1"))
# Online services that speak the OpenAI API (the parent pastes their own key).
ONLINE_PRESETS = {
    "openai": ("OpenAI", "https://api.openai.com/v1", "gpt-4o-mini"),
    "openrouter": ("OpenRouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini"),
    "groq": ("Groq", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "gemini": ("Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.0-flash"),
    "mistral": ("Mistral", "https://api.mistral.ai/v1", "mistral-small-latest"),
    "deepseek": ("DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"),
}


class LLMError(Exception):
    pass


def _http(url: str, payload: dict | None = None, headers: dict | None = None, timeout: float = 30.0) -> Any:
    if not re.match(r"^https?://", url):
        raise LLMError("Only http:// and https:// addresses are allowed")
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET",
                                 headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "melo-music-teacher",
                                          **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - scheme checked above
            return json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise LLMError(f"HTTP {e.code}: {body}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise LLMError(f"cannot reach {url.split('/v1')[0]}: {getattr(e, 'reason', e)}") from None
    except json.JSONDecodeError:
        raise LLMError("the server did not answer with JSON") from None


def extract_json(text: str) -> dict | None:
    """The JSON object in a model's reply: tolerant of <think> blocks, ``` fences and chatter around it."""
    if not text:
        return None
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.S)
    if fence:
        text = fence.group(1)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def conforms(value: Any, schema: dict) -> bool:
    """A small JSON-schema check (the subset Melo uses): types, required keys, enums, array items."""
    t = schema.get("type")
    if "enum" in schema and value not in schema["enum"]:
        return False
    if t == "object":
        if not isinstance(value, dict):
            return False
        props = schema.get("properties", {})
        if any(k not in value for k in schema.get("required", [])):
            return False
        return all(conforms(value[k], props[k]) for k in props if k in value)
    if t == "array":
        return isinstance(value, list) and all(conforms(v, schema.get("items", {})) for v in value)
    if t == "string":
        return isinstance(value, str)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return True


def _json_instruction(schema: dict) -> str:
    return ("\n\nAnswer with ONLY one JSON object (no other text) that matches this JSON schema:\n" + json.dumps(schema, ensure_ascii=False))


def pick_ollama_model(models: list[str]) -> str | None:
    chat = [m for m in models if not re.search(r"embed|bge|nomic|minilm|whisper|llava|vision", m, re.I)]
    for pref in OLLAMA_PREFERRED:
        hit = sorted((m for m in chat if m.lower().startswith(pref)), key=len)
        if hit:
            return hit[0]
    return chat[0] if chat else None


def ollama_models(url: str = OLLAMA_DEFAULT, timeout: float = 1.5) -> list[str] | None:
    """Installed Ollama models, or None when Ollama is not running."""
    try:
        data = _http(url.rstrip("/") + "/api/tags", timeout=timeout)
    except LLMError:
        return None
    return [m.get("name") or m.get("model") for m in (data or {}).get("models", []) if m.get("name") or m.get("model")]


def openai_models(base_url: str, api_key: str | None = None, timeout: float = 2.0) -> list[str] | None:
    try:
        data = _http(base_url.rstrip("/") + "/models", headers={"Authorization": f"Bearer {api_key}"} if api_key else None, timeout=timeout)
    except LLMError:
        return None
    return [m.get("id") for m in (data or {}).get("data", []) if m.get("id")]


class OllamaProvider:
    kind = "ollama"

    def __init__(self, url: str, model: str | None, timeout: float, system: str) -> None:
        self.url = (url or OLLAMA_DEFAULT).rstrip("/")
        self.model = model or None
        self.timeout = timeout
        self.system = system
        self.last_error: str | None = None

    def _model(self) -> str | None:
        if not self.model:
            models = ollama_models(self.url)
            if models is None:
                self.last_error = f"Ollama is not running at {self.url}. Start the Ollama app (or run `ollama serve`)."
                return None
            self.model = pick_ollama_model(models)
            if not self.model:
                self.last_error = "Ollama has no chat model yet. In a terminal run: ollama pull llama3.2"
        return self.model

    _think_ok = True  # older Ollama versions do not know the "think" switch

    def structured(self, user_prompt: str, schema: dict, max_tokens: int = 2000, timeout: float | None = None) -> dict | None:
        self.last_error = None
        model = self._model()
        if not model:
            return None
        payload = {"model": model, "stream": False, "format": schema, "keep_alive": "15m",
                   "options": {"temperature": 0.6, "num_predict": min(max_tokens, 1500)},
                   "messages": [{"role": "system", "content": self.system}, {"role": "user", "content": user_prompt + _json_instruction(schema)}]}
        if self._think_ok:
            # thinking models (qwen3, deepseek-r1 ...) would think for minutes on a laptop: a child is waiting
            payload["think"] = False
        try:
            try:
                out = _http(self.url + "/api/chat", payload, timeout=timeout or self.timeout)
            except LLMError as e:
                if "think" not in str(e).lower() or "think" not in payload:
                    raise
                self._think_ok = False
                payload.pop("think")
                out = _http(self.url + "/api/chat", payload, timeout=timeout or self.timeout)
        except LLMError as e:
            self.last_error = f"Ollama ({model}): {e}"
            log.warning("Ollama call failed: %s; using offline teacher", e)
            return None
        data = extract_json(((out or {}).get("message") or {}).get("content", ""))
        if data is None or not conforms(data, schema):
            self.last_error = f"Ollama ({model}) answered, but not in the expected shape. A bigger model (e.g. qwen2.5:7b) is more reliable."
            log.info("Ollama output did not match the schema; using offline teacher")
            return None
        return data


class OpenAICompatProvider:
    kind = "openai"

    def __init__(self, base_url: str, model: str, api_key: str | None, timeout: float, system: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key or None
        self.timeout = timeout
        self.system = system
        self.last_error: str | None = None
        self._format_level = 0  # 0 json_schema, 1 json_object, 2 prompt only (remembered per server)

    @property
    def is_local(self) -> bool:
        return bool(re.match(r"^https?://(127\.0\.0\.1|localhost|\[::1\])(:|/|$)", self.base_url))

    def _format(self, schema: dict) -> dict | None:
        if self._format_level == 0:
            return {"type": "json_schema", "json_schema": {"name": "melo_reply", "strict": True, "schema": schema}}
        if self._format_level == 1:
            return {"type": "json_object"}
        return None

    def structured(self, user_prompt: str, schema: dict, max_tokens: int = 2000, timeout: float | None = None) -> dict | None:
        self.last_error = None
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        while True:
            payload: dict[str, Any] = {"model": self.model, "temperature": 0.6, "max_tokens": min(max_tokens, 1500),
                                       "messages": [{"role": "system", "content": self.system},
                                                    {"role": "user", "content": user_prompt + _json_instruction(schema)}]}
            fmt = self._format(schema)
            if fmt:
                payload["response_format"] = fmt
            try:
                out = _http(self.base_url + "/chat/completions", payload, headers, timeout=timeout or self.timeout)
                break
            except LLMError as e:
                msg = str(e)
                # this server does not support that response_format: step down once and remember
                if self._format_level < 2 and re.match(r"HTTP (400|422|500)", msg) and re.search(r"response_format|json_schema|schema|format", msg, re.I):
                    self._format_level += 1
                    continue
                self.last_error = f"{self.model} at {self.base_url}: {msg}" + (" (check the API key)" if msg.startswith("HTTP 401") else "")
                log.warning("OpenAI-compatible call failed: %s; using offline teacher", msg)
                return None
        try:
            text = out["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            self.last_error = "The server answered without a message."
            return None
        data = extract_json(text if isinstance(text, str) else "")
        if data is None or not conforms(data, schema):
            self.last_error = f"{self.model} answered, but not in the expected shape."
            return None
        return data


# --- the parent's choice of brain, saved next to the data (works for the installed app too) ---------
BRAIN_KEYS = ("provider", "ollama_url", "ollama_model", "llm_base_url", "llm_model", "llm_api_key")


def brain_file(data_dir: Path) -> Path:
    return Path(data_dir) / "brain.json"


def load_brain(data_dir: Path) -> dict:
    try:
        raw = json.loads(brain_file(data_dir).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {k: raw[k] for k in BRAIN_KEYS if isinstance(raw.get(k), str)}


def save_brain(data_dir: Path, values: dict) -> None:
    import os

    path = brain_file(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    clean = {k: str(values[k]) for k in BRAIN_KEYS if values.get(k) not in (None, "")}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(clean, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)  # holds an API key when an online service is used
    except OSError:
        pass
    tmp.replace(path)
