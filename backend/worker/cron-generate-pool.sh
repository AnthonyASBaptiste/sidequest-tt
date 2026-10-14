#!/usr/bin/env bash
set -euo pipefail

# SideQuest T&T Daily Quest Pool Generation Cron Job
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$DIR/.." && pwd)"

export PATH="/home/anthony/.local/bin:$PATH"

cd "$BACKEND_DIR"

LOG_FILE="$DIR/cron-pool.log"

echo "[$(date +"%Y-%m-%dT%H:%M:%S%z")] Starting scheduled quest pool generation check..." >> "$LOG_FILE"
/home/anthony/.local/bin/node --env-file=worker/.env worker/generate-quest-pool.mjs >> "$LOG_FILE" 2>&1
echo "[$(date +"%Y-%m-%dT%H:%M:%S%z")] Finished scheduled quest pool generation check." >> "$LOG_FILE"
