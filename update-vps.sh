#!/usr/bin/env bash
set -euo pipefail

# Update this app on VPS by pulling latest GitHub code and reinstalling deps.
# Usage:
#   ./update-vps.sh
#   ./update-vps.sh --restart
#
# Optional environment variables:
#   APP_DIR=/var/www/imperium_website BRANCH=main REMOTE=origin PM2_APP=imperium_website BACKUP_RETENTION_DAYS=7 ./update-vps.sh --restart

# Default to the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
PM2_APP="${PM2_APP:-imperium_website}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

DO_RESTART="false"
if [[ "${1:-}" == "--restart" ]]; then
  DO_RESTART="true"
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: $APP_DIR is not a Git repository."
  exit 1
fi

cd "$APP_DIR"
PRE_RESET_HEAD="$(git rev-parse --verify HEAD 2>/dev/null || true)"

BACKUP_ROOT="$APP_DIR/server"
BACKUP_DIR="$BACKUP_ROOT/data_backup_$(date +"%Y-%m-%d_%H-%M-%S")"

echo "==> Backing up server data to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
if [[ -d "$APP_DIR/server/data" ]]; then
  cp -a "$APP_DIR/server/data/." "$BACKUP_DIR/"
fi

DEPLOY_TARGET="$REMOTE/$BRANCH"
DEPLOY_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

node_json_update() {
  local js="$1"
  node -e "$js"
}

set_maintenance_state() {
  local enabled="$1"
  local message="$2"
  MAINT_ENABLED="$enabled" MAINT_MESSAGE="$message" node_json_update '
    const enabled = String(process.env.MAINT_ENABLED || "false") === "true";
    const message = String(process.env.MAINT_MESSAGE || "");
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "server", "data");
    const file = path.join(dataDir, "site_settings.json");
    fs.mkdirSync(dataDir, { recursive: true });
    let current = {};
    if (fs.existsSync(file)) {
      try { current = JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { current = {}; }
    }
    current.maintenanceMode = enabled;
    current.maintenanceMessage = message;
    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
  '
}

set_deploy_status() {
  local active="$1"
  local phase="$2"
  local progress="$3"
  local message="$4"
  local completedAt="$5"
  local failedAt="$6"
  local commit="$7"
  local releaseTag="$8"

  DEPLOY_ACTIVE="$active" DEPLOY_PHASE="$phase" DEPLOY_PROGRESS="$progress" DEPLOY_MESSAGE="$message" DEPLOY_COMPLETED_AT="$completedAt" DEPLOY_FAILED_AT="$failedAt" DEPLOY_COMMIT="$commit" DEPLOY_RELEASE_TAG="$releaseTag" DEPLOY_STARTED_AT="$DEPLOY_STARTED_AT" DEPLOY_TARGET="$DEPLOY_TARGET" node_json_update '
    const active = String(process.env.DEPLOY_ACTIVE || "false") === "true";
    const phase = String(process.env.DEPLOY_PHASE || "idle");
    const progress = Number(process.env.DEPLOY_PROGRESS || 0) || 0;
    const message = String(process.env.DEPLOY_MESSAGE || "");
    const completedAt = String(process.env.DEPLOY_COMPLETED_AT || "");
    const failedAt = String(process.env.DEPLOY_FAILED_AT || "");
    const commit = String(process.env.DEPLOY_COMMIT || "");
    const releaseTag = String(process.env.DEPLOY_RELEASE_TAG || "");
    const startedAt = String(process.env.DEPLOY_STARTED_AT || "");
    const target = String(process.env.DEPLOY_TARGET || "");
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "server", "data");
    const file = path.join(dataDir, "deploy_status.json");
    fs.mkdirSync(dataDir, { recursive: true });
    let current = {
      active: false,
      phase: "idle",
      message: "No deployment in progress.",
      progress: 0,
      startedAt: "",
      updatedAt: "",
      completedAt: "",
      failedAt: "",
      target: "",
      commit: "",
      releaseTag: "",
    };
    if (fs.existsSync(file)) {
      try { current = { ...current, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch (_) {}
    }
    current.active = active;
    current.phase = phase;
    current.progress = progress;
    current.message = message;
    current.startedAt = current.startedAt || startedAt;
    current.updatedAt = new Date().toISOString();
    current.completedAt = completedAt;
    current.failedAt = failedAt;
    current.target = target;
    current.commit = commit;
    current.releaseTag = releaseTag;
    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
  '
}

on_error() {
  local line="$1"
  echo "❌ Update failed at line $line"
  set_deploy_status "false" "failed" "100" "Deployment failed. Check VPS logs." "" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "" ""
  set_maintenance_state "true" "Update failed during deployment. We are working to restore service."
}

trap 'on_error "$LINENO"' ERR

set_maintenance_state "true" "Maintenance mode: update in progress. Please wait while we deploy the latest version."
set_deploy_status "true" "starting" "5" "Preparing deployment..." "" "" "" ""

echo "==> Fetching latest from $REMOTE/$BRANCH"
git fetch "$REMOTE"
set_deploy_status "true" "fetching" "20" "Fetching latest code from GitHub..." "" "" "" ""

echo "==> Resetting working tree to $REMOTE/$BRANCH"
git reset --hard "$REMOTE/$BRANCH"
set_deploy_status "true" "syncing" "45" "Applying repository update..." "" "" "" ""

echo "==> Restoring data files (ensuring persistence against git resets)"
# Restore only files that are missing after reset.
# This avoids overwriting fresh GitHub updates (for example users.json/account changes).
if [[ -d "$BACKUP_DIR" ]]; then
  mkdir -p "$APP_DIR/server/data"
  shopt -s nullglob
  for source_file in "$BACKUP_DIR"/*; do
    file_name="$(basename "$source_file")"
    target_file="$APP_DIR/server/data/$file_name"
    if [[ ! -e "$target_file" ]]; then
      cp -a "$source_file" "$target_file"
      echo "Restored missing data file: $file_name"
    fi
  done
  shopt -u nullglob
  echo "Data restore complete (missing files only)."
fi

echo "==> Installing dependencies"
set_deploy_status "true" "installing" "65" "Checking dependency changes..." "" "" "" ""

NEEDS_INSTALL="true"
if [[ -n "$PRE_RESET_HEAD" && -d node_modules ]]; then
  DEPS_CHANGED="$(git diff --name-only "$PRE_RESET_HEAD" HEAD -- package.json package-lock.json 2>/dev/null || true)"
  if [[ -z "$DEPS_CHANGED" ]]; then
    NEEDS_INSTALL="false"
  fi
fi

if [[ "$NEEDS_INSTALL" == "true" ]]; then
  echo "==> Dependency update needed (this can take 1-3 minutes)"
  set_deploy_status "true" "installing" "70" "Installing dependencies (npm)..." "" "" "" ""
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund --prefer-offline
  else
    npm install --no-audit --no-fund --prefer-offline
  fi
  echo "==> Dependency install complete"
else
  echo "==> Dependencies unchanged and node_modules exists; skipping npm install"
  set_deploy_status "true" "installing" "70" "Dependencies unchanged, install skipped." "" "" "" ""
fi

if [[ "$DO_RESTART" == "true" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> Restarting PM2 app: $PM2_APP"
    set_deploy_status "true" "restarting" "90" "Restarting application service..." "" "" "" ""
    if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
      pm2 restart "$PM2_APP"
    else
      echo "==> PM2 app $PM2_APP not found, starting new process from server/index.js"
      pm2 start server/index.js --name "$PM2_APP"
    fi
    pm2 save >/dev/null 2>&1 || true
  else
    echo "WARNING: PM2 not found; skipped restart."
    set_deploy_status "true" "restart-skipped" "90" "PM2 not found, restart skipped." "" "" "" ""
  fi
else
  echo "==> Skipping PM2 restart (manual restart mode)."
  set_deploy_status "true" "restart-skipped" "90" "Restart skipped (manual mode)." "" "" "" ""
fi

LATEST_COMMIT="$(git rev-parse --short HEAD)"
LATEST_SUBJECT="$(git log -1 --pretty=%s)"
RELEASE_TAG="$LATEST_COMMIT - $LATEST_SUBJECT"
set_deploy_status "false" "completed" "100" "Deployment completed successfully." "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "" "$LATEST_COMMIT" "$RELEASE_TAG"
set_maintenance_state "false" "Imperium MUN is temporarily under maintenance. Please check back soon."

echo "==> Cleaning old backups (older than ${BACKUP_RETENTION_DAYS} days)"
find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'data_backup_*' -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "✅ VPS updated: $(date)"
echo "Latest commit: $(git log -1 --pretty=%h' - '%s)"
