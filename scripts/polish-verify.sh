#!/usr/bin/env bash
# Keep both preview processes owned by the verification run; cleanup only these children.
set -eu
baseline=${1:-/tmp/ujverse-polish/before-dist}
config=${2:-/tmp/ujverse-polish/playwright.json}
mkdir -p /tmp/ujverse-polish
npm run preview -- --host 127.0.0.1 --port 4273 --strictPort > /tmp/ujverse-polish/preview-after.log 2>&1 &
polish_after_pid=$!
npm run preview -- --host 127.0.0.1 --port 4274 --strictPort --outDir "$baseline" > /tmp/ujverse-polish/preview-before.log 2>&1 &
polish_before_pid=$!
trap 'kill "$polish_after_pid" "$polish_before_pid" 2>/dev/null || true' EXIT
for port in 4273 4274; do
  for attempt in {1..40}; do
    if curl --fail --silent --show-error -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then break; fi
    sleep 0.25
  done
done
if [[ ${POLISH_SKIP_PERFORMANCE:-0} != 1 ]]; then
playwright-cli -s=polishfinal open --config="$config" http://127.0.0.1:4274 > /tmp/ujverse-polish/performance-open.log
playwright-cli -s=polishfinal run-code --filename=scripts/polish-performance.js > /tmp/ujverse-polish/performance-measured.log
playwright-cli -s=polishfinal close > /tmp/ujverse-polish/performance-close.log
fi
playwright-cli run-code --filename="${POLISH_BROWSER_CHECKS_FILE:-scripts/polish-browser-checks.js}" > /tmp/ujverse-polish/responsive.log
playwright-cli run-code --filename=scripts/polish-functional-checks.js > /tmp/ujverse-polish/functional.log
