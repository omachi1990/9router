#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# 9Router Fork - Automated Upstream Sync & Deploy Script
# Repository: omachi1990/9router (Fork) <- decolua/9router (Upstream)
# ==============================================================================

REPO_DIR="/root/9router"
STATUS_FILE="/root/.9router/upstream_sync_status.json"
LOG_FILE="/root/.9router/logs/auto-sync.log"

mkdir -p "/root/.9router/logs"

log() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

write_status() {
  local status="$1"
  local message="$2"
  local extra="${3:-}"
  local timestamp
  timestamp="$(date -Iseconds)"

  cat <<EOF > "$STATUS_FILE"
{
  "status": "$status",
  "message": "$message",
  "timestamp": "$timestamp"$extra
}
EOF
}

cd "$REPO_DIR"

log "=== Checking for Upstream Updates ==="

# Check if git is currently in a merge or rebase state
if [ -f .git/MERGE_HEAD ] || [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  log "WARNING: Git is currently in an unmerged or rebase state. Aborting auto-sync."
  write_status "busy" "Git workspace is currently in an unmerged or rebase state."
  exit 1
fi

# Ensure clean working tree
if ! git diff-index --quiet HEAD --; then
  log "WARNING: Working directory has uncommitted changes. Stashing before sync..."
  git stash push -m "auto-sync-stash-$(date +%s)" || true
fi

# Fetch upstream and origin
log "Fetching upstream and origin..."
git fetch upstream master --tags --quiet
git fetch origin master --quiet

# Check how many commits upstream is ahead
BEHIND_COUNT="$(git rev-list --count HEAD..upstream/master 2>/dev/null || echo 0)"
LATEST_UPSTREAM_COMMIT="$(git rev-parse --short upstream/master)"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"

log "Current commit: $CURRENT_COMMIT | Upstream master: $LATEST_UPSTREAM_COMMIT | Commits behind: $BEHIND_COUNT"

if [ "$BEHIND_COUNT" -eq 0 ]; then
  log "Already up to date with upstream."
  write_status "up_to_date" "Fork is fully up to date with upstream ($CURRENT_COMMIT)."
  exit 0
fi

log "Detected $BEHIND_COUNT new commit(s) in upstream! Beginning automatic merge..."
BACKUP_BRANCH="backup-auto-sync-$(date '+%Y%m%d-%H%M%S')"
git branch "$BACKUP_BRANCH" HEAD
log "Created safety backup branch: $BACKUP_BRANCH"

# Attempt automatic merge
MERGE_MSG="chore(auto-sync): merge upstream ($LATEST_UPSTREAM_COMMIT) into fork"
if ! git merge upstream/master -m "$MERGE_MSG"; then
  log "Notice: Auto-merge encountered conflicts. Checking if conflicts are auto-resolvable..."
  
  # Try resolving known conflict files (e.g. codex registry plan labels)
  if [ -f "scripts/resolve-codex-conflict.mjs" ]; then
    node scripts/resolve-codex-conflict.mjs || true
    if ! git diff open-sse/providers/registry/codex.js | grep -q '<<<<<<<'; then
      git add open-sse/providers/registry/codex.js 2>/dev/null || true
    fi
  fi

  # Check if there are still unmerged files
  REMAINING_CONFLICTS="$(git diff --name-only --diff-filter=U | tr '\n' ',' | sed 's/,$//')"
  if [ -n "$REMAINING_CONFLICTS" ]; then
    log "CONFLICT: Unresolvable conflicts remain: $REMAINING_CONFLICTS. Aborting merge to prevent repository corruption."
    git merge --abort
    write_status "conflict" "Auto-merge failed due to conflicts. Human or AI resolution required." ",\n  \"conflicts\": \"$REMAINING_CONFLICTS\""
    exit 2
  else
    log "Conflicts were successfully auto-resolved! Concluding merge commit..."
    git commit -m "$MERGE_MSG" || true
  fi
fi

log "Merge succeeded cleanly without conflicts! Updating baseline snapshots..."
node tests/__baseline__/verify-alias.mjs --snapshot || true
node tests/__baseline__/snapshot-providers.mjs || true

if ! git diff-index --quiet HEAD --; then
  git commit -am "chore(auto-sync): update baseline snapshots after merge" || true
fi

log "Checking if package dependencies changed..."
CHANGED_PKG="$(git diff --name-only HEAD~1 HEAD | grep -E 'package\.json|package-lock\.json' || true)"
if [ -n "$CHANGED_PKG" ]; then
  log "package.json changed, running npm install..."
  npm install --prefer-offline --no-audit
fi

log "Building Next.js production build..."
export NODE_OPTIONS="--max-old-space-size=4096"
if ! npm run build; then
  log "BUILD ERROR: npm run build failed after merge. Rolling back to $CURRENT_COMMIT..."
  git reset --hard "$CURRENT_COMMIT"
  write_status "build_error" "Build failed after merging upstream. Rolled back to $CURRENT_COMMIT."
  exit 3
fi

log "Build succeeded! Restarting PM2 process '9router'..."
pm2 restart 9router

log "Pushing updated fork to origin/master..."
git push origin master --tags --quiet

NEW_COMMIT="$(git rev-parse --short HEAD)"
log "SUCCESS: Auto-sync completed! New fork commit: $NEW_COMMIT"
write_status "success" "Successfully merged and deployed upstream updates." ",\n  \"newCommit\": \"$NEW_COMMIT\",\n  \"previousCommit\": \"$CURRENT_COMMIT\""
exit 0
