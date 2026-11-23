"""End-to-end check of a BUILT Melo app (the .exe / .app / AppImage folder), against a throwaway data folder.

    python packaging/smoke_test.py dist/Melo/Melo.exe        (Windows)
    python packaging/smoke_test.py dist/Melo/Melo            (Linux)
    python packaging/smoke_test.py dist/Melo.app/Contents/MacOS/Melo   (macOS)

Starts the app on a free port with no browser and no window, then exercises: the web app, an account and a
child, songs, the child's own instrument (profile, photo, reading it), the language lessons in every language
with a voice for every item (native, bundled neural or live), the "why" behind answers, and the "own words"
material page. Exits non-zero on the first failure. Uses only the standard library.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

LANGS = ["en", "hi", "mr", "fr", "es", "ar", "zh", "yue", "ko", "ru", "tr", "sa", "gu", "bn", "pa", "ta", "te", "kn", "de", "ja"]
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Client:
    def __init__(self, base: str) -> None:
        self.base = base
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def req(self, method: str, path: str, body=None, raw: bytes | None = None, ctype: str | None = None, expect=(200, 201, 204)):
        data, headers = None, {"X-Requested-With": "melo"}
        if body is not None:
            data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
        elif raw is not None:
            data, headers["Content-Type"] = raw, ctype
        r = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with self.op.open(r, timeout=60) as resp:
                status, content, typ = resp.status, resp.read(), resp.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            status, content, typ = e.code, e.read(), e.headers.get("Content-Type", "")
        if status not in expect:
            raise AssertionError(f"{method} {path} -> {status}: {content[:300]!r}")
        return json.loads(content) if "json" in typ and content else content

    def multipart(self, path: str, fields: dict, files: list[tuple[str, str, bytes, str]], expect=(200, 201)):
        b = "----melo" + os.urandom(8).hex()
        parts = []
        for k, v in fields.items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for field, name, content, typ in files:
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{field}"; filename="{name}"\r\nContent-Type: {typ}\r\n\r\n'.encode() + content + b"\r\n")
        return self.req("POST", path, raw=b"".join(parts) + f"--{b}--\r\n".encode(), ctype=f"multipart/form-data; boundary={b}", expect=expect)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to a code page without ✓
    exe = os.path.abspath(sys.argv[1])
    port = free_port()
    data = tempfile.mkdtemp(prefix="melo-smoke-")
    env = {**os.environ, "KM_DATA_DIR": data, "KM_TTS_ONLINE": "false"}  # offline: bundled voices must be enough
    proc = subprocess.Popen([exe, "--port", str(port), "--no-browser", "--no-window"], env=env)
    base = f"http://127.0.0.1:{port}"
    ok = lambda msg: print("  ✓", msg, flush=True)  # noqa: E731
    try:
        for _ in range(120):
            try:
                with urllib.request.urlopen(base + "/api/health", timeout=2) as r:
                    if json.loads(r.read())["status"] == "ok":
                        break
            except Exception:
                time.sleep(1)
        else:
            raise AssertionError("the app did not start within 2 minutes (see melo.log in " + data + ")")
        ok(f"app started on port {port}")
        c = Client(base)
        assert b"root" in c.req("GET", "/")
        ok("web app served")
        c.req("POST", "/api/auth/register", {"email": "smoke@example.com", "password": "correct-horse-1"})
        kid = c.req("POST", "/api/children", {"name": "Asha", "age": 3, "language": "en"})
        cid = kid["id"]
        ok("parent account and child created")

        songs = c.req("GET", f"/api/children/{cid}/songs")
        assert songs, "no songs"
        start = c.req("POST", f"/api/children/{cid}/songs/{songs[0]['id']}/start")
        assert start["song"]["notes"]
        ok(f"{len(songs)} songs; song school starts")

        inst = c.req("PUT", f"/api/children/{cid}/instrument", {"kind": "toy_keyboard", "keys": 37, "first_key": "F", "labels": "numbers",
                                                                 "notes": "37 keys kids keyboard with microphone and recording"})
        assert inst["set"] and inst["low"] % 12 == 5
        inst = c.multipart(f"/api/children/{cid}/instrument/photos", {}, [("file", "keys.png", PNG, "image/png")])
        assert len(inst["photos"]) == 1 and c.req("GET", inst["photos"][0]["url"]) == PNG
        a = c.req("POST", f"/api/children/{cid}/instrument/analyze")
        assert a["suggestion"]["keys"] == 37 and a["suggestion"]["mic"]
        ok("own instrument: profile, photo, reading it")

        silent = []
        for lang in LANGS:
            st = c.req("GET", f"/api/children/{cid}/learn/{lang}")
            items = ["p_how", "p_fine", "p_name_q", "cat", "water"]
            for item in items:
                refs = c.req("GET", f"/api/learn/native/{lang}/{item}")
                if not refs:
                    silent.append(f"{lang}/{item}")
                    continue
                clip = c.req("GET", refs[0]["url"])
                assert len(clip) > 500, f"{lang}/{item}: empty clip"
            assert st["language"]["code"] == lang
        if os.environ.get("MELO_SMOKE_VOICES", "1") == "0":  # a build without the voice pack (CI without the "voices" release)
            print(f"  ! voice check skipped ({len(silent)} sampled items without a bundled voice)")
        else:
            assert not silent, f"no voice for {silent}"
        ok(f"every sampled word and conversation has a voice in all {len(LANGS)} languages (offline)")

        why = None
        for _ in range(8):  # letters and tracing have no word meaning: answer until a word comes up
            act = c.req("POST", f"/api/children/{cid}/learn/fr/next", {"speech": False})
            resp = {"spell": {"text": "x"}, "trace": {"strokes": 1, "coverage": 0.5, "spill": 0.1}}.get(act["type"], {"choice": 0})
            ans = c.req("POST", f"/api/children/{cid}/learn/attempts/{act['attempt_id']}/answer", {"response": resp})
            why = ans["reveal"].get("why")
            if why:
                break
        assert why, "no language answer explained its meaning"
        ok(f"language answer explains why: {why!r}")

        r = c.multipart(f"/api/children/{cid}/learn/material", {"langs": "fr", "notes": "good morning"}, [], expect=(201, 409))
        ok("own-words page answers (" + ("made a topic" if isinstance(r, dict) and r.get("ok") else "needs the AI brain, as expected offline") + ")")
        prefs = c.req("PUT", f"/api/children/{cid}/prefs", {"grade": 3, "teachers": {"maths": {"persona": "professor_pi", "rate": 0.9, "pitch": 1.0}}})
        assert prefs["grade"] == 3 and prefs["teachers"]["maths"]["persona"] == "professor_pi"
        r = c.req("POST", f"/api/children/{cid}/subjects/maths/addition/round", {"correct": 5, "total": 5, "difficulty": 2})
        assert r["difficulty"] == 3 and r["earned"] == 3
        c.req("POST", f"/api/children/{cid}/subjects/science/water_cycle/round", {"correct": 2, "total": 5, "difficulty": 2})
        assert set(c.req("GET", f"/api/children/{cid}/subjects/maths")["topics"]) == {"addition"}
        ok("maths & science progress and per-subject teacher personas")
        html = c.req("GET", "/").decode()
        js = [p for p in html.split('"') if p.startswith("/assets/") and p.endswith(".js")]
        bundle = b"".join(c.req("GET", p) for p in js)
        for needle in (b"Shape Lab", b"Nikhilam", b"water cycle", b"Professor Pi", b"One by one"):
            assert needle in bundle, f"web app is missing {needle!r}"
        ok("web app has Maths (Shape Lab, Vedic tricks), Science, personas, one-by-one")
        c.req("DELETE", f"/api/children/{cid}/instrument")
        print("ALL CHECKS PASSED", flush=True)
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(15)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
