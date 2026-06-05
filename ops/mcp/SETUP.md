# Enabling the AWS MCP servers

`.mcp.json` (repo root) wires two official AWS Labs MCP servers — `aws-api`
(broad read access: EC2/RDS/ELB/CloudWatch/SSM describe) and `cloudwatch`
(logs/metrics/alarms). To turn them on in a Claude Code session:

## 1. Config — DONE (this PR)
`.mcp.json` is committed. Credentials and region come from env vars; nothing
secret is in the file.

## 2. Install `uvx`
The servers are Python (run via `uvx`). Point the environment's **setup script**
at `scripts/ops-setup.sh`, or add this line to it:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 3. Set secrets (environment variables / secrets — never commit)
- `PFW_OPS_AWS_KEY` / `PFW_OPS_AWS_SECRET` — access key for the `pfw-claude-ops`
  IAM role (see `ops/iam/pfw-claude-ops.policy.json`).
- `PFW_AWS_REGION` — optional; defaults to `eu-west-2`. Set if your stack is elsewhere.

## 4. ⚠️ Widen the network allowlist
The MCP servers run inside the sandbox, so their AWS calls hit the egress
firewall. Allow outbound to **`*.amazonaws.com`** in the environment's network
policy, or the calls are rejected.

## 5. Restart the session
MCP config, env vars, and network policy load at session start. After restarting,
tools appear as `mcp__aws-api__*` and `mcp__cloudwatch__*`.

> Note: this gets AWS APIs + CloudWatch + SSM (enough for `pm2 logs`/`pm2 restart`
> and most outage triage). Direct private-RDS SQL still needs the in-VPC ops box or
> an SSM port-forward — see `ops/ACCESS.md`.
