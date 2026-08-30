#!/bin/bash
# Called by crontab every 5 minutes on the VPS.
# Triggers the internal scheduler endpoint which handles:
#   - Glucemia reminder push notifications (3 daily, skip if already logged)
#   - Inactivity alerts (7+ days without glucemia)
#   - Persistent critical alert escalation ("Consulta necesaria")
#
# Crontab entry (as deploy user):
#   */5 * * * * /home/deploy/apps/glycofit/scripts/run-scheduler.sh >> /home/deploy/logs/scheduler.log 2>&1

set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3008}"
INTERNAL_KEY="${INTERNAL_SCHEDULER_KEY:-}"

if [ -z "$INTERNAL_KEY" ]; then
  # Read from .env if not in environment
  ENV_FILE="/home/deploy/apps/glycofit/.env"
  if [ -f "$ENV_FILE" ]; then
    INTERNAL_KEY=$(grep -oP '(?<=^INTERNAL_SCHEDULER_KEY=).*' "$ENV_FILE" | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$INTERNAL_KEY" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: INTERNAL_SCHEDULER_KEY not found"
  exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${APP_URL}/api/internal/scheduler" \
  -H "Content-Type: application/json" \
  -H "x-internal-key: ${INTERNAL_KEY}" \
  --max-time 30)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') OK: ${BODY}"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
