#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/boardgame-crud"
FRONT_SRC="$APP_DIR/frontend/"
FRONT_DST="/var/www/sites/leopoldine/boardgames/"
BACK_DIR="$APP_DIR/backend"
SERVICE="boardgame_crud"

cd "$APP_DIR"
git pull

# Deploy frontend (delete removed files too)
sudo rsync -av --delete "$FRONT_SRC" "$FRONT_DST"

# Backend deps only if requirements changed
cd "$BACK_DIR"
REQ_HASH_FILE=".requirements.sha256"
NEW_HASH="$(sha256sum requirements.txt | awk "{print \$1}")"
OLD_HASH="$(cat "$REQ_HASH_FILE" 2>/dev/null || true)"

if [[ "$NEW_HASH" != "$OLD_HASH" ]]; then
  ./.venv/bin/pip install -r requirements.txt
  echo "$NEW_HASH" > "$REQ_HASH_FILE"
fi

# Restart backend
sudo systemctl restart "$SERVICE"

# Quick sanity checks
curl -fsS http://127.0.0.1:8000/ >/dev/null || true
curl -fsS http://localhost/api/ping >/dev/null || true

echo "Deploy OK."
