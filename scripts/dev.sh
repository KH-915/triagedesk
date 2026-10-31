#!/usr/bin/env bash
# TriageDesk — one-command local dev (Linux/macOS/Git Bash).
#
# First run: creates .env, starts Postgres (Docker), installs Node + Python deps,
# applies migrations, seeds demo users and trains the ML model.
# Later runs: skips whatever is already set up and just starts everything.
#
# Usage:
#   scripts/dev.sh           # setup if needed, then run
#   scripts/dev.sh --setup   # force all setup steps
#   scripts/dev.sh --no-run  # setup only
#
# Ctrl+C stops the ML service, API and web app. Postgres keeps running
# (stop it with: docker compose -f infra/docker-compose.yml stop db).
set -euo pipefail

SETUP=0
RUN=1
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=1 ;;
    --no-run) RUN=0 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ML_DIR="$ROOT/services/ml-api"
COMPOSE="$ROOT/infra/docker-compose.yml"
if [ -x "$ML_DIR/.venv/Scripts/python.exe" ] || [ "${OS:-}" = "Windows_NT" ]; then
  VENV_PY="$ML_DIR/.venv/Scripts/python"
else
  VENV_PY="$ML_DIR/.venv/bin/python"
fi
cd "$ROOT"

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
skip() { printf '\033[90m    %s (already done)\033[0m\n' "$1"; }
require() { command -v "$1" >/dev/null 2>&1 || { echo "$1 not found. $2" >&2; exit 1; }; }

require node 'Install Node 20.6+.'
require npm 'Install Node 20.6+.'
require docker 'Install Docker (used for Postgres).'

# ── 1. .env ──────────────────────────────────────────────────
if [ ! -f .env ]; then
  step 'Creating .env from .env.example with a random JWT_SECRET'
  secret="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
  sed "s/^JWT_SECRET=.*/JWT_SECRET=$secret/" .env.example > .env
else skip '.env exists'; fi

# ── 2. Postgres ──────────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
  echo 'The Docker engine is not running. Start Docker (Desktop) and re-run this script.' >&2
  exit 1
fi
step 'Starting Postgres (docker compose)'
docker compose -f "$COMPOSE" up -d db
for i in $(seq 1 30); do
  docker compose -f "$COMPOSE" exec -T db pg_isready -U triagedesk >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && { echo 'Postgres did not become ready within 30s.' >&2; exit 1; }
  sleep 1
done

# ── 3. Node deps + database ──────────────────────────────────
if [ "$SETUP" = 1 ] || [ ! -d node_modules ]; then
  step 'Installing Node dependencies'
  npm install
else skip 'node_modules exists'; fi

if [ ! -d node_modules/.prisma/client ]; then
  step 'Generating Prisma client'
  npm run db:generate
fi

# Migrations and seed are cheap and idempotent, so always run them: this picks up new
# migrations and keeps the demo agent an AGENT even if the account was registered by hand.
step 'Applying database migrations'
npm run db:migrate:deploy

step 'Seeding demo users (idempotent)'
npm --workspace=services/api run seed

# ── 4. ML service ────────────────────────────────────────────
if [ "$SETUP" = 1 ] || { [ ! -x "$VENV_PY" ] && [ ! -f "$VENV_PY.exe" ]; }; then
  step 'Creating Python venv and installing ML deps'
  PY="$(command -v python3.12 || command -v python3 || command -v python)" \
    || { echo 'Python 3.12 not found.' >&2; exit 1; }
  "$PY" -m venv "$ML_DIR/.venv"
  "$VENV_PY" -m pip install --upgrade pip
  "$VENV_PY" -m pip install -r "$ML_DIR/requirements.txt"
else skip 'Python venv exists'; fi

if [ "$SETUP" = 1 ] || [ ! -f "$ML_DIR/models/model.pkl" ]; then
  step 'Generating data and training the model'
  (cd "$ML_DIR" && "$VENV_PY" training/generate_data.py && "$VENV_PY" training/train.py)
else skip 'models/model.pkl exists'; fi

if [ "$RUN" = 0 ]; then step 'Setup complete.'; exit 0; fi

# ── 5. Run ───────────────────────────────────────────────────
step 'Starting ML service (:8000), API (:4000) and web (:5173) — Ctrl+C to stop'
pids=()
cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; done
}
trap cleanup INT TERM EXIT

(cd "$ML_DIR" && MODEL_VERSION=v1.0.0 exec "$VENV_PY" -m uvicorn app.main:app --port 8000) & pids+=($!)
npm run dev:api & pids+=($!)
npm run dev:web & pids+=($!)

printf '\n\033[32m  Web:   http://localhost:5173\n  API:   http://localhost:4000\n  ML:    http://localhost:8000\n  Login: agent@triagedesk.dev / agent-password\033[0m\n\n'

# Exit when any service dies, so a crash isn't hidden behind the others' output.
wait -n
echo 'A service exited; shutting down the rest.' >&2
