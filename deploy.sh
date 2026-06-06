#!/usr/bin/env bash
set -euo pipefail

APP="glycofit"
REMOTE="claude-bot"
REMOTE_USER="deploy"
REMOTE_DIR="/home/${REMOTE_USER}/apps/${APP}"

echo "==> Building Next.js (standalone)..."
npm run build

echo "==> Syncing standalone output to ${REMOTE}..."
rsync -az --delete \
  .next/standalone/ \
  "${REMOTE_USER}@${REMOTE}:${REMOTE_DIR}/"

echo "==> Syncing static assets..."
rsync -az --delete \
  .next/static/ \
  "${REMOTE_USER}@${REMOTE}:${REMOTE_DIR}/.next/static/"

echo "==> Syncing public directory..."
rsync -az --delete \
  public/ \
  "${REMOTE_USER}@${REMOTE}:${REMOTE_DIR}/public/"

echo "==> Restarting PM2 process..."
# Note: ecosystem.config.js lives on the server (has env secrets). Not synced from repo.
ssh "${REMOTE}" "sudo su - ${REMOTE_USER} -c '
  export PATH=\$PATH:/home/${REMOTE_USER}/.local/share/pnpm
  cd ${REMOTE_DIR}
  pm2 restart ${APP} || pm2 start ecosystem.config.js
  pm2 save
'"

echo "==> Done! ${APP} deployed to ${REMOTE}"
