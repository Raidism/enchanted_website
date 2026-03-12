#!/usr/bin/env bash
set -euo pipefail

# Update this app on VPS by pulling latest GitHub code and reinstalling deps.
# Usage:
#   ./update-vps.sh
#   ./update-vps.sh --restart
#
# Optional environment variables:
#   APP_DIR=/var/www/imperium_website BRANCH=main REMOTE=origin PM2_APP=imperium-web ./update-vps.sh --restart

APP_DIR="${APP_DIR:-/var/www/imperium_website}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
PM2_APP="${PM2_APP:-imperium-web}"

DO_RESTART="false"
if [[ "${1:-}" == "--restart" ]]; then
  DO_RESTART="true"
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: $APP_DIR is not a Git repository."
  exit 1
fi

cd "$APP_DIR"

echo "==> Fetching latest from $REMOTE/$BRANCH"
git fetch "$REMOTE"

echo "==> Resetting working tree to $REMOTE/$BRANCH"
git reset --hard "$REMOTE/$BRANCH"

echo "==> Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --silent
else
  npm install --silent
fi

if [[ "$DO_RESTART" == "true" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> Restarting PM2 app: $PM2_APP"
    pm2 restart "$PM2_APP"
  else
    echo "WARNING: PM2 not found; skipped restart."
  fi
else
  echo "==> Skipping PM2 restart (manual restart mode)."
fi

echo ""
echo "✅ VPS updated: $(date)"
echo "Latest commit: $(git log -1 --pretty=%h' - '%s)"
