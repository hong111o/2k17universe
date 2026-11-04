#!/usr/bin/env bash
# Runs every browser check against index.html with your workbook.
# Usage: tests/run-all.sh /path/to/2K17.xlsm
# Needs Node.js and Playwright with Chromium: run `npm install` in this folder once
# (and `npx playwright install chromium` if no Chromium is installed yet).
# The workbook is never copied into the repo; screenshots land in tests/out/.
set -u
XLSM="${1:?Usage: tests/run-all.sh /path/to/2K17.xlsm}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PW="${PW_DIR:-$HERE}"            # folder whose node_modules holds playwright and xlsx
OUT="$HERE/out"; mkdir -p "$OUT"
PORT=8765
python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
fail=0
for t in "$HERE"/test*.cjs; do
  name="$(basename "$t" .cjs)"
  target="$ROOT/index.html"
  [ "$name" = "test_v30" ] && target="http://localhost:$PORT/index.html"   # needs a real page origin
  printf '== %s\n' "$name"
  if ! result="$(cd "$HERE" && timeout 300 node "$t" "$PW" "$target" "$XLSM" "$OUT" 2>&1)"; then
    echo "$result" | tail -15; fail=1; continue
  fi
  # Each test prints its findings as JSON; any page error shows up in an "errors" list
  if echo "$result" | grep -Eq '"(desk |phone |)?errors": \[[^]]'; then echo "$result" | grep -A3 -E 'rrors'; fail=1; else echo "ok"; fi
done
exit $fail
