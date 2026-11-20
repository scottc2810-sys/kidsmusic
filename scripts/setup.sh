#!/usr/bin/env bash
# Melo setup for Linux / macOS. Requires Python 3.11+ and Node.js 18+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${PYTHON:-python3}"
echo "==> Checking tools"; "$PY" --version; node --version
echo "==> Backend virtual environment"
[ -d backend/.venv ] || "$PY" -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip --quiet
backend/.venv/bin/python -m pip install -r backend/requirements.txt -c backend/requirements.lock --quiet
echo "==> Frontend build"
( cd frontend && { [ -f package-lock.json ] && npm ci --no-audit --no-fund || npm install --no-audit --no-fund; } && npm run build )
[ -f .env ] || { cp .env.example .env; echo "==> Created .env (edit it to add ANTHROPIC_API_KEY)"; }
echo; echo "Setup complete. Start Melo with:  ./scripts/run.sh"
