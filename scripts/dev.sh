#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$PROJECT_ROOT/.venv/bin/python"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PROCESS_GROUPS=()
CLEANED_UP=0

cleanup() {
  if ((CLEANED_UP)); then
    return
  fi
  CLEANED_UP=1
  if ((${#PROCESS_GROUPS[@]} > 0)); then
    echo
    echo "Stopping ClawNote..."
    for group_id in "${PROCESS_GROUPS[@]}"; do
      kill -- "-$group_id" 2>/dev/null || true
    done
    wait "${PROCESS_GROUPS[@]}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing Python virtual environment: $PROJECT_ROOT/.venv"
  echo "Create it with: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available. Install Node.js 20+ first."
  exit 1
fi

if [[ ! -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run: npm --prefix frontend ci"
  exit 1
fi

echo "Starting ClawNote backend..."
setsid "$PYTHON" -m uvicorn backend.app.main:app \
  --app-dir "$PROJECT_ROOT" \
  --reload \
  --host 127.0.0.1 \
  --port "$BACKEND_PORT" &
PROCESS_GROUPS+=("$!")

echo "Starting ClawNote frontend..."
setsid npm --prefix "$PROJECT_ROOT/frontend" run dev -- \
  --host 127.0.0.1 \
  --port "$FRONTEND_PORT" &
PROCESS_GROUPS+=("$!")

echo
echo "ClawNote is starting:"
echo "  Web: http://localhost:$FRONTEND_PORT"
echo "  API: http://127.0.0.1:$BACKEND_PORT/docs"
echo "Press Ctrl+C to stop both services."
echo

wait -n "${PROCESS_GROUPS[@]}"
