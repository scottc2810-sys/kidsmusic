#!/usr/bin/env bash
# Start Melo on Linux / macOS. Open http://127.0.0.1:8000 (or KM_HOST/KM_PORT from .env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
envval() { [ -f "$ROOT/.env" ] && grep -E "^\s*$1\s*=" "$ROOT/.env" | tail -1 | cut -d= -f2- | sed 's/#.*//' | xargs || true; }
HOST="${KM_HOST:-$(envval KM_HOST)}"; HOST="${HOST:-127.0.0.1}"
PORT="${KM_PORT:-$(envval KM_PORT)}"; PORT="${PORT:-8000}"
cd "$ROOT/backend"
echo "Melo is starting on http://$HOST:$PORT  (Ctrl+C to stop)"
# One worker: SQLite + in-process background analysis and rate limiting are designed for a single process.
exec .venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$PORT" --workers 1 --proxy-headers
