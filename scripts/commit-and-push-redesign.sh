#!/usr/bin/env bash
# Commit and prepare push for fs04_web (redesign-phase-2).
# Run from repo root: ./scripts/commit-and-push-redesign.sh

set -e
cd "$(dirname "$0")/.."

echo "=== fs04_web: staging changes ==="
git add \
  scripts/commit-and-push-redesign.sh \
  scripts/clickhouse-init.sql \
  scripts/clickhouse-init-device-apps-only.sql \
  src/lib/server/action-logger.ts \
  src/lib/server/clickhouse/deviceAppService.ts \
  src/lib/server/mqtt/broadcasters/actionLogEventBroadcaster.ts \
  "src/routes/api/devices/[id]/actions/+server.ts" \
  "src/routes/api/devices/[id]/deployments/+server.ts" \
  "src/routes/user/iot/devices/[id]/+page.svelte" \
  docs/architecture/audit/BRANCH_BUSINESS_LOGIC_AUDIT.md \
  docs/architecture/audit/PUSH_AND_EMULATOR_CHECKLIST.md \
  "src/routes/api/devices/[id]/apps/report/" \
  "src/routes/api/v2/devices/[id]/apps/[packageName]/"

git status -s
echo ""
if git diff --cached --quiet; then
  echo "Nothing staged to commit (already committed?). Push with: git push origin redesign-phase-2"
  exit 0
fi
echo "Committing..."
git commit -m "feat(redesign): device actions, deployments, ClickHouse app service, audit docs

- actions: pin_apps/unpin_app, installApp LOCAL + packageName fix, broadcast init status
- deployments API: access control aligned with device actions (owner/account member)
- deviceAppService: isAvailable, insertDeviceAppReport; throw on query failure (5xx)
- apps/report and v2 apps pin endpoints; ClickHouse init device-apps script
- audit: BRANCH_BUSINESS_LOGIC_AUDIT, PUSH_AND_EMULATOR_CHECKLIST"
echo ""
echo "Done. Push with: git push origin redesign-phase-2"
