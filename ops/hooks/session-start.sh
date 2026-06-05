#!/usr/bin/env bash
# PFW ops SessionStart hook.
# NOTE: In the egress-restricted web sandbox this hook canNOT reach AWS/RDS directly,
# so it only verifies that required credentials/vars are present and prints a checklist.
# Claude then runs the real connectivity probes via the MCP servers at session start.
set -uo pipefail

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "── PFW ops preflight ───────────────────────────────"

req_vars=(PFW_AWS_REGION PFW_OPS_AWS_KEY PFW_OPS_AWS_SECRET \
          PFW_PG_READONLY_URL PFW_MYSQL_HOST PFW_MYSQL_RO_USER PFW_MYSQL_RO_PASS)

missing=0
for v in "${req_vars[@]}"; do
  if [[ -n "${!v:-}" ]]; then ok "$v set"; else warn "$v MISSING"; missing=$((missing+1)); fi
done

if [[ -f .mcp.json ]]; then ok ".mcp.json present"; else warn ".mcp.json not found (copy from ops/mcp/.mcp.example.json)"; fi

echo "────────────────────────────────────────────────────"
if [[ $missing -gt 0 ]]; then
  warn "$missing required var(s) missing — AWS/DB MCP tools will fail until set."
else
  ok "All ops credentials present. Claude: run AWS/RDS/PM2 health probes via MCP now."
fi
exit 0
