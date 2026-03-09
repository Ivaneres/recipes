#!/usr/bin/env bash
# Launch frontend and backend for recipes-app.
# Usage: ./scripts/start.sh   (from repo root)

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PID=
FRONTEND_PID=

cleanup() {
  echo ""
  echo "Shutting down..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Backend (with venv) — use "python -m uvicorn" so we don't rely on venv bin shebangs (e.g. after Python upgrade)
if [[ -d "$ROOT/backend/venv" ]]; then
  if ! "$ROOT/backend/venv/bin/python" -c "" 2>/dev/null; then
    echo "Backend venv has no valid Python (e.g. interpreter was upgraded). Recreate it:"
    echo "  cd backend && rm -rf venv && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    echo ""
  else
    echo "Starting backend (http://localhost:8000)..."
    (
      cd "$ROOT/backend"
      source venv/bin/activate
      exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ) &
    BACKEND_PID=$!
  fi
else
  echo "Backend venv not found. Run: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
fi

# Frontend
if [[ -d "$ROOT/frontend/node_modules" ]]; then
  echo "Starting frontend (http://localhost:5173)..."
  (cd "$ROOT/frontend" && npm run dev) &
  FRONTEND_PID=$!
else
  echo "Frontend deps not installed. Run: cd frontend && npm install"
fi

[[ -z "$BACKEND_PID" && -z "$FRONTEND_PID" ]] && echo "Nothing to run." && exit 1

echo ""
echo "Press Ctrl+C to stop both servers."
wait
