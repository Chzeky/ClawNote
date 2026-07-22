#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORCE_AGENTS=0

if [[ "${1:-}" == "--force-agents" ]]; then
  FORCE_AGENTS=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: ./scripts/bootstrap.sh [--force-agents]"
  exit 2
fi

for command in python3 npm openclaw; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command"
    echo "See README.md environment requirements before retrying."
    exit 1
  fi
done

cd "$PROJECT_ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

echo "Installing Python dependencies..."
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

echo "Installing Node.js dependencies..."
npm ci
npm --prefix frontend ci

echo "Initializing the local knowledge database..."
.venv/bin/python scripts/knowledge_db.py init

echo "Checking OpenClaw model configuration..."
if ! openclaw models status >/dev/null; then
  echo "OpenClaw does not have a usable model configuration."
  echo "Run 'openclaw configure', then run this bootstrap script again."
  exit 1
fi

setup_args=(--register-openclaw --verify-openclaw)
if ((FORCE_AGENTS)); then
  setup_args+=(--force)
fi

echo "Installing and registering ClawNote agents..."
.venv/bin/python scripts/setup_openclaw_local.py "${setup_args[@]}"

echo
echo "ClawNote setup is complete."
echo "Start the app with: ./scripts/dev.sh"
