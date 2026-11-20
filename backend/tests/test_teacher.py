import random
from types import SimpleNamespace

from app.config import Settings
from app.teacher import phrases
from app.teacher.safety import clean_child_text, redact_for_ai
from app.teacher.service import TeacherService


def child(**kw):
    base = dict(name="Asha", age=5, language="en", session_minutes=5, current_level=1, mode="screen", instrument="piano", cloud_ai_allowed=True)
    base.update(kw)
    return SimpleNamespace(**base)


class FakeAI:
    def __init__(self, data):
        self.data = data
        self.prompts = []

    def structured(self, prompt, schema, max_tokens=2000):
        self.prompts.append(prompt)
        return self.data


def svc(data):
    s = TeacherService(Settings(ai_provider="offline"))
    s._provider = FakeAI(data)  # type: ignore[assignment]
    return s


def test_every_phrase_exists_in_all_languages():
    for key, langs in phrases.P.items():
        for lang in ("en", "hi", "hinglish"):
            assert langs.get(lang), f"{key} missing {lang}"
            for line in langs[lang]:
                assert clean_child_text(line.format(**FMT)), f"unsafe curated line {key}/{lang}"


FMT = dict(name="X", skill="rhythm", song="S", stars=3, level="L", expected="Re", played="Ga", count=2, n=1, note="Ga", notes="Sa Re", beats=2,
           matched=3, expected_beats=4, word="cat")


def test_language_packs_only_use_known_keys_and_placeholders():
    """Every extra language (es, fr, zh, ar ...) may translate any phrase key, with the same {placeholders}."""
    import re
    import string
    from pathlib import Path

    from app.languages import BUILTIN, LANGUAGES

    fields = lambda s: {f for _, f, _, _ in string.Formatter().parse(s) if f}  # noqa: E731
    for code in LANGUAGES:
        if code in BUILTIN:
            continue
        assert (Path(phrases.__file__).parent / "locales" / f"{code}.json").is_file(), f"no phrase pack for {code}"
        pack = phrases.pack(code)
        assert pack, f"empty phrase pack for {code}"
        for key, lines in pack.items():
            assert key in phrases.P, f"{code}: unknown phrase key {key}"
            allowed = set().union(*(fields(x) for x in phrases.P[key]["en"]))
            for line in lines:
                assert fields(line) <= allowed, f"{code}/{key}: unknown placeholder in {line!r}"
                assert not re.search(r"https?://", line)
        # the lines a child hears most must exist in every language
        for key in ("greeting", "success", "partial", "miss", "retry", "wrap_up", "intro.find_note", "intro.rhythm_tap"):
            assert key in pack, f"{code}: missing core phrase {key}"
        assert phrases.line("success", code) in pack["success"]
    assert phrases.line("success", "xx")  # unknown language: English


def test_safety_filter_blocks_shaming_and_links():
    assert clean_child_text("That was wrong, try harder") is None
    assert clean_child_text("You are better than other kids!") is None
    assert clean_child_text("Visit https://example.com") is None
    assert clean_child_text("Lovely try! Let's play again.") == "Lovely try! Let's play again."


def test_redaction_removes_name_and_contacts():
    out = redact_for_ai("I am Asha, call 98765 43210 or mail a@b.com", "Asha")
    assert "Asha" not in out and "98765" not in out and "a@b.com" not in out


def test_plan_rejects_out_of_bounds_ai_choice():
    s = svc({"focus_skill": "violin_bowing", "theme": "animals", "greeting": "Hi {name}!", "reason_for_parent": "x"})
    plan = s.plan_session(child(), {"pitch": {"mastery": 0.1}}, ["pitch", "rhythm"], [], random.Random(1))
    assert plan["source"] == "offline" and plan["focus_skill"] in ("pitch", "rhythm")


def test_plan_accepts_valid_ai_choice_and_never_sends_name():
    ai = FakeAI({"focus_skill": "rhythm", "theme": "rain", "greeting": "Hi {name}! Ready to drum?", "reason_for_parent": "Rhythm is newest."})
    s = TeacherService(Settings(ai_provider="offline"))
    s._provider = ai  # type: ignore[assignment]
    plan = s.plan_session(child(), {"pitch": {"mastery": 0.1}}, ["pitch", "rhythm"], [], random.Random(1))
    assert plan["source"] == "claude" and plan["focus_skill"] == "rhythm" and plan["greeting"].startswith("Hi {name}")
    assert all("Asha" not in p for p in ai.prompts)


def test_unsafe_ai_chat_reply_falls_back_to_curated_line():
    s = svc({"reply": "That is a stupid question", "wants_rest": False, "wants_game": False})
    r = s.chat(child(), "what is a note?", [])
    assert r["source"] == "offline" and "stupid" not in r["reply"]


def test_ai_disabled_by_parent_is_respected():
    ai = FakeAI({"reply": "hello"})
    s = TeacherService(Settings(ai_provider="offline"))
    s._provider = ai  # type: ignore[assignment]
    s.chat(child(cloud_ai_allowed=False), "hi", [])
    assert ai.prompts == []


# -- Claude Code CLI provider (no API key; subprocess is stubbed) -----------------------------
import json as _json
import subprocess as _sp

import pytest

from app.teacher import service as _service_mod


def _cc_settings(tmp_path, **kw):
    return Settings(ai_provider="claude_code", data_dir=tmp_path, anthropic_api_key=None, **kw)


@pytest.fixture
def fake_cli(monkeypatch):
    calls = []
    result = {"stdout": _json.dumps({"type": "result", "subtype": "success", "is_error": False,
                                      "structured_output": {"reply": "Lovely high note, {name}!", "wants_rest": False, "wants_game": False}}),
              "returncode": 0, "raise": None}

    def run(cmd, **kw):
        calls.append({"cmd": cmd, **kw})
        if result["raise"]:
            raise result["raise"]
        return _sp.CompletedProcess(cmd, result["returncode"], stdout=result["stdout"], stderr="")

    monkeypatch.setattr(_service_mod.shutil, "which", lambda name: "/fake/bin/claude")
    monkeypatch.setattr(_service_mod.subprocess, "run", run)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-should-not-leak")
    return calls, result


def test_claude_code_provider_used_for_chat_without_api_key(tmp_path, fake_cli):
    calls, _ = fake_cli
    s = TeacherService(_cc_settings(tmp_path))
    st = s.status()
    assert st["provider"] == "claude_code" and st["model"] == "sonnet" and st["claude_code_found"] is True
    out = s.chat(child(), "I played Asha's high note", [])
    assert out["source"] == "claude" and out["reply"] == "Lovely high note, {name}!"
    call = calls[0]
    cmd = call["cmd"]
    # sealed CLI: print mode, JSON schema, no tools, no MCP, no session, hooks off
    assert cmd[:2] == ["/fake/bin/claude", "-p"]
    assert cmd[cmd.index("--tools") + 1] == ""
    assert "--strict-mcp-config" in cmd and "--no-session-persistence" in cmd
    assert _json.loads(cmd[cmd.index("--settings") + 1]) == {"disableAllHooks": True}
    assert "reply" in _json.loads(cmd[cmd.index("--json-schema") + 1])["properties"]
    # prompt goes on stdin, child's name redacted, API key scrubbed so the CLI uses the Claude Code login
    assert "Asha" not in call["input"] and "Asha" not in " ".join(cmd)
    assert "ANTHROPIC_API_KEY" not in call["env"]
    assert call["cwd"] == tmp_path / "claude-code"


@pytest.mark.parametrize("failure", ["timeout", "not_json", "is_error", "missing_cli_run"])
def test_claude_code_failures_fall_back_to_offline(tmp_path, fake_cli, failure):
    _, result = fake_cli
    if failure == "timeout":
        result["raise"] = _sp.TimeoutExpired("claude", 30)
    elif failure == "not_json":
        result["stdout"], result["returncode"] = "Please run /login", 1
    elif failure == "is_error":
        result["stdout"] = _json.dumps({"type": "result", "subtype": "error_during_execution", "is_error": True, "result": "boom"})
    else:
        result["raise"] = FileNotFoundError("claude")
    s = TeacherService(_cc_settings(tmp_path))
    out = s.chat(child(), "hello", [])
    assert out["source"] == "offline" and out["reply"]


def test_claude_code_missing_cli_runs_offline(tmp_path, monkeypatch):
    monkeypatch.setattr(_service_mod, "find_claude_cli", lambda name="claude": None)
    s = TeacherService(_cc_settings(tmp_path))
    assert s.status()["provider"] == "offline" and s.status()["claude_code_found"] is False
    assert s.chat(child(), "hello", [])["source"] == "offline"


def test_claude_code_respects_cloud_ai_consent(tmp_path, fake_cli):
    calls, _ = fake_cli
    s = TeacherService(_cc_settings(tmp_path))
    assert s.chat(child(cloud_ai_allowed=False), "hello", [])["source"] == "offline"
    assert calls == []


def test_self_test_reports_connection(tmp_path, fake_cli):
    _, result = fake_cli
    result["stdout"] = _json.dumps({"type": "result", "subtype": "success", "is_error": False, "structured_output": {"reply": "Hello {name}, let's sing!"}})
    out = TeacherService(_cc_settings(tmp_path)).self_test()
    assert out["ok"] and out["provider"] == "claude_code" and out["reply"] == "Hello {name}, let's sing!"


def test_self_test_explains_not_logged_in(tmp_path, fake_cli):
    _, result = fake_cli
    result["stdout"] = _json.dumps({"type": "result", "subtype": "success", "is_error": True, "result": "Not logged in · Please run /login"})
    out = TeacherService(_cc_settings(tmp_path)).self_test()
    assert not out["ok"] and "Not logged in" in out["message"]


def test_claude_code_is_found_outside_path_and_auto_mode_uses_it(tmp_path, monkeypatch):
    """An app started from the installer may not have the terminal's PATH: look in the usual folders."""
    import os
    from pathlib import Path

    from app.teacher import service

    home = tmp_path / "home"
    (home / ".local" / "bin").mkdir(parents=True)
    exe = home / ".local" / "bin" / ("claude.exe" if os.name == "nt" else "claude")
    exe.write_text("")
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    for var in ("APPDATA", "LOCALAPPDATA"):
        monkeypatch.delenv(var, raising=False)
    assert service.find_claude_cli("claude") == str(exe)
    assert service.find_claude_cli("no-such-cli-here") is None
    s = TeacherService(Settings(ai_provider="auto", anthropic_api_key=None, data_dir=tmp_path / "d"))
    st = s.status()
    assert st["provider"] == "claude_code" and st["claude_code_found"] is True and st["configured"] == "auto"
    # the parent's switch still decides: no child data goes to the AI until Cloud AI is allowed
    assert s._ai_for(child(cloud_ai_allowed=False)) is None
    off = TeacherService(Settings(ai_provider="offline", data_dir=tmp_path / "d")).status()
    assert off["provider"] == "offline" and off["claude_code_found"] is True


def test_self_test_offline_explains_setup():
    out = TeacherService(Settings(ai_provider="offline")).self_test()
    assert not out["ok"] and "AI brain" in out["message"] and "Ollama" in out["message"]
