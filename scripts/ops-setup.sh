#!/usr/bin/env bash
# PFW environment setup — ensures `uvx` is available so the AWS MCP servers in
# .mcp.json can launch. Point your Claude Code environment's setup script at this
# file (or copy the install line below into it). Safe to run repeatedly.
set -euo pipefail

if ! command -v uvx >/dev/null 2>&1; then
  echo "[ops-setup] installing uv (provides uvx)…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "[ops-setup] uvx: $(command -v uvx || echo MISSING)"

# Warn early if the AWS credentials the MCP servers need aren't set.
for v in PFW_OPS_AWS_KEY PFW_OPS_AWS_SECRET; do
  [ -n "${!v:-}" ] || echo "[ops-setup] WARNING: $v is not set — AWS MCP servers will fail to authenticate."
done

echo "[ops-setup] done. Restart the session after setting secrets + network allowlist."
