"""Update check: compares versions, ignores pre-releases (the voice pack), stays quiet offline."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from app import updates


@pytest.fixture()
def release_server():
    state = {"body": {}}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):  # noqa: N802
            data = json.dumps(state["body"]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield state, f"http://127.0.0.1:{srv.server_port}/latest"
    srv.shutdown()


def test_versions_compare_as_numbers():
    assert updates.newer("1.10.0", "1.9.9") and updates.newer("v2.0", "1.5.0") and not updates.newer("1.5.0", "1.5.0")
    assert not updates.newer("garbage", "1.5.0")


def test_newer_release_is_reported_and_prereleases_ignored(release_server):
    state, url = release_server
    state["body"] = {"tag_name": "v1.6.0", "name": "Melo 1.6.0", "html_url": "https://github.com/x/y/releases/tag/v1.6.0", "prerelease": False}
    got = updates.check(url, force=True)
    assert got["newer"] and got["latest"] == "1.6.0" and got["url"].startswith("https://")
    state["body"] = {"tag_name": "voices", "prerelease": True}
    assert updates.check(url, force=True) == {"current": updates.APP_VERSION, "latest": None, "newer": False, "url": None, "name": None}
    assert updates.check("http://127.0.0.1:9/nothing", force=True, timeout=0.5)["latest"] is None  # offline: quiet
    assert updates.check("", force=True)["latest"] is None  # switched off


def test_versions_are_in_step_everywhere():
    root = Path(__file__).parents[2]
    v = updates.APP_VERSION
    assert f'VERSION = "{v}"' in (root / "backend" / "melo_app.py").read_text(encoding="utf-8")
    assert f'"version": "{v}"' in (root / "frontend" / "package.json").read_text(encoding="utf-8")
    assert f'$Version = "{v}"' in (root / "packaging" / "windows" / "build.ps1").read_text(encoding="utf-8")
    assert f'$Version = "{v}"' in (root / "packaging" / "windows" / "build_msix.ps1").read_text(encoding="utf-8")
    assert f'VERSION="{v}"' in (root / "packaging" / "build.sh").read_text(encoding="utf-8")


def test_update_route_needs_a_parent(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "update_url", "")
    assert client.get("/api/system/update").status_code == 401
    from tests.conftest import register

    register(client)
    assert client.get("/api/system/update").json()["current"] == updates.APP_VERSION
