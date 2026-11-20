"""Melo desktop app: one double-click starts the teacher and opens it in the browser.

This is the entry point of the installed app (Windows .exe, macOS .app, Linux AppImage), built
with PyInstaller from packaging/melo.spec. It also runs from source: `python backend/melo_app.py`.

* Data (database, recordings, keys, optional .env) lives in the user's profile:
  %LOCALAPPDATA%\\Melo, ~/Library/Application Support/Melo or ~/.local/share/Melo.
* The server listens on this computer only (127.0.0.1), which browsers treat as a secure page,
  so the microphone and camera work without any certificate.
* Starting Melo twice just opens the browser on the copy that is already running.
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_NAME = "Melo"
VERSION = "1.4.0"


def _prepare_environment() -> Path:
    """Runs before the app package is imported: settings are read from the environment."""
    os.environ.setdefault("KM_ENV", "production")
    os.environ.setdefault("KM_HOST", "127.0.0.1")
    here = Path(__file__).resolve().parent
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))
    from app.config import get_settings

    data = get_settings().data_dir
    # A windowed app has no console: send output to a log file so problems can be diagnosed.
    if sys.stdout is None or sys.stderr is None or getattr(sys, "frozen", False):
        log = open(data / "melo.log", "a", encoding="utf-8", buffering=1)  # noqa: SIM115 (lives as long as the app)
        sys.stdout = sys.stderr = log
    return data


def _healthy(port: int, timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=timeout) as r:
            return json.loads(r.read()).get("status") == "ok"
    except Exception:
        return False


def _free_port(preferred: int) -> int:
    for port in [preferred, *range(preferred + 1, preferred + 30)]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _control_window(url: str, stop: threading.Event) -> None:
    """A small window so the parent can reopen Melo or close it. Falls back to waiting quietly."""
    try:
        import tkinter as tk
    except Exception:
        stop.wait()
        return
    try:
        root = tk.Tk()
    except Exception:  # no display (server, ssh): keep running until stopped
        stop.wait()
        return
    root.title(APP_NAME)
    root.resizable(False, False)
    root.configure(bg="#6c4cf1", padx=28, pady=22)
    tk.Label(root, text="🎵 Melo is running", font=("Segoe UI", 16, "bold"), fg="white", bg="#6c4cf1").pack()
    tk.Label(root, text="Your music teacher is open in your web browser.\nKeep this window open while you play.",
             font=("Segoe UI", 10), fg="#ece7ff", bg="#6c4cf1", justify="center").pack(pady=(6, 14))
    tk.Button(root, text="Open Melo", font=("Segoe UI", 11, "bold"), width=18, command=lambda: webbrowser.open(url)).pack(pady=3)
    tk.Button(root, text="Close Melo", font=("Segoe UI", 10), width=18, command=root.destroy).pack(pady=3)
    tk.Label(root, text=url, font=("Segoe UI", 8), fg="#d9d2f7", bg="#6c4cf1").pack(pady=(10, 0))
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    root.after(500, lambda: stop.is_set() and root.destroy())
    root.mainloop()
    stop.set()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="melo", description="Melo, the AI music teacher for children")
    parser.add_argument("--port", type=int, default=None, help="port to use (default 8000, or the next free one)")
    parser.add_argument("--no-browser", action="store_true", help="do not open the web browser")
    parser.add_argument("--no-window", action="store_true", help="no control window (stop with Ctrl+C)")
    parser.add_argument("--version", action="version", version=f"{APP_NAME} {VERSION}")
    args = parser.parse_args(argv)

    data = _prepare_environment()
    port_file = data / "melo.port"
    # Already running? Open the browser on it instead of starting a second copy on the same database.
    try:
        running = int(port_file.read_text().strip())
    except (OSError, ValueError):
        running = 0
    if running and _healthy(running):
        if not args.no_browser:
            webbrowser.open(f"http://127.0.0.1:{running}")
        return 0

    import uvicorn

    from app.config import get_settings
    from app.main import app

    port = _free_port(args.port or get_settings().port)
    url = f"http://127.0.0.1:{port}"
    server = uvicorn.Server(uvicorn.Config(app, host=os.environ.get("KM_HOST", "127.0.0.1"), port=port, workers=1, log_level="info"))
    thread = threading.Thread(target=server.run, name="melo-server", daemon=True)
    thread.start()
    for _ in range(120):  # wait for the server (first start creates the database and keys)
        if _healthy(port, 0.5) or not thread.is_alive():
            break
        time.sleep(0.25)
    if not thread.is_alive():
        print("Melo could not start. See melo.log in", data)
        return 1
    port_file.write_text(str(port))
    print(f"Melo is running at {url} (data: {data})")
    if not args.no_browser:
        webbrowser.open(url)

    stop = threading.Event()
    try:
        if args.no_window:
            while thread.is_alive() and not stop.is_set():
                time.sleep(0.5)
        else:
            _control_window(url, stop)
    except KeyboardInterrupt:
        pass
    finally:
        server.should_exit = True
        thread.join(timeout=8)
        try:
            port_file.unlink()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
