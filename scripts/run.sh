#!/bin/bash
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_DIR/scripts/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y-%m-%d).log"

exec >>"$LOG" 2>&1

echo
echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') start ===="

cd "$REPO_DIR"

# Pull first to avoid push conflicts
git pull --rebase --autostash || {
  echo "git pull failed, aborting"
  exit 1
}

cd scripts
node crawler.js
RC=$?

cd "$REPO_DIR"

# Sanity check: refuse to commit if latest.json is suspiciously small
SIZE=$(wc -c < data/latest.json | tr -d ' ')
if [ "$SIZE" -lt 5000 ]; then
  echo "latest.json is only ${SIZE} bytes (< 5000), refusing to commit (likely block)"
  exit 1
fi

git add data/
if git diff --staged --quiet; then
  echo "no data changes"
  exit 0
fi

git commit -m "chore: snapshot $(date -u '+%Y-%m-%d %H:%M UTC')"
for i in 1 2 3; do
  git pull --rebase --autostash && git push && {
    echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') done (crawler rc=$RC) ===="
    exit 0
  }
  echo "push attempt $i failed"
  sleep 10
done
echo "push failed after retries"
exit 1
