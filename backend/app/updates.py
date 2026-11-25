"""Is a newer Melo out? Asks the public release page (GitHub releases of the project) at most twice a day.
The request carries no personal information: only the app name and version in the User-Agent.
KM_UPDATE_URL="" turns the check off; pre-releases (such as the voice pack) are ignored."""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.request

APP_VERSION = "1.6.0"  # keep in step with melo_app.VERSION and the installers (tests check it)
_CACHE: dict = {"at": 0.0, "data": None}
_LOCK = threading.Lock()
TTL = 12 * 3600


def _parse(v: str) -> tuple[int, ...]:
    nums = re.findall(r"\d+", v or "")
    return tuple(int(n) for n in nums[:3]) or (0,)


def newer(latest: str, current: str = APP_VERSION) -> bool:
    return _parse(latest) > _parse(current)


def _fetch(url: str, timeout: float) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": f"Melo/{APP_VERSION}", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - fixed https URL from settings
            data = json.loads(r.read(200_000))
    except Exception:  # noqa: BLE001 - offline, no release yet, rate-limited: no update information
        return None
    return data if isinstance(data, dict) else None


def check(url: str, timeout: float = 4.0, force: bool = False) -> dict:
    """{current, latest, newer, url, name}; latest is None when nothing could be learned (offline, no release)."""
    out = {"current": APP_VERSION, "latest": None, "newer": False, "url": None, "name": None}
    if not url:
        return out
    with _LOCK:
        if not force and _CACHE["data"] is not None and time.monotonic() - _CACHE["at"] < TTL:
            return _CACHE["data"]
    rel = _fetch(url, timeout)
    if rel and not rel.get("prerelease") and not rel.get("draft") and rel.get("tag_name"):
        page = rel.get("html_url") or ""
        out.update(latest=str(rel["tag_name"]).lstrip("vV"), name=str(rel.get("name") or "")[:120],
                   url=page if page.startswith("https://") else None)
        out["newer"] = newer(out["latest"])
    with _LOCK:
        _CACHE.update(at=time.monotonic(), data=out)
    return out
