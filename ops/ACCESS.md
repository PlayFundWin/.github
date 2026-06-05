# PFW Claude Ops — Access Runbook

How Claude Code gets controlled access to the Play Fund Win stack, and how to escalate
from read-only diagnosis to gated actions. **No secrets live in this repo** — all real
values are env vars / Parameter Store / Secrets Manager.

## Posture: "read + controlled actions"
- **Read everything** needed to diagnose: CloudWatch logs/metrics/alarms, EC2/ELB/ASG/RDS
  describe, `pm2 list`/`pm2 logs` over SSM, read-only DB `SELECT`s.
- **Controlled (gated) actions**: `pm2 restart` via SSM `SendCommand`, Vercel rollback,
  deploy triggers. Claude always asks for explicit approval before any mutation.
- **Cannot** (by IAM design): modify/reboot/delete RDS, stop/terminate/reboot EC2, change
  security groups, touch IAM, or write to the databases.

## Access channels
1. **MCP servers** (preferred) — route through Anthropic infra, not the local firewall:
   `aws` (CloudWatch first), `pfw-postgres`, `pfw-mysql`, plus GitHub & Vercel.
2. **AWS SSM** — Session Manager for an interactive shell on the API boxes (PM2), and
   `SendCommand` (AWS-RunShellScript) for the one gated mutation: `pm2 restart`.

## Network reality
RDS sits in private subnets and the web-session sandbox blocks outbound. So **direct DB +
live PM2 access requires being inside the VPC** — either an SSM port-forward through an API
box, or (recommended) the **in-VPC ops box** in `ops/opsbox/`.

## Setup checklist
1. Create IAM role `pfw-claude-ops` from `ops/iam/pfw-claude-ops.policy.json`
   (replace `<REGION>` / `<ACCOUNT_ID>`).
2. Tag API EC2 instances **and** the ops box `Project=pfw` (the IAM conditions require it).
3. Create read-only DB users: Postgres (`GRANT pg_read_all_data`), MySQL (`GRANT SELECT`).
4. Put connection details in Parameter Store under `/pfw/claude-ops/*`.
5. `terraform apply` in `ops/opsbox/` to stand up the ops box (or wire the MCP servers into
   a web environment for AWS-only, read-only investigation).
6. Add the repos to the Claude session scope: `PFW_V2`, `PFW_API_V3`, `pfw_next`,
   `PFW_Managed_Site`. **Restart the session** for scope/MCP changes to load.

## Escalation: read-only → write (break-glass)
Write/admin DB credentials live in a **separate** Secrets Manager entry
(`pfw/claude-ops/break-glass`), NOT granted to the default role. Pull only for an
authorized change, with a human approving, and rotate after use.

## Audit
CloudTrail (AWS API), SSM session logs (shell history), and Vercel audit log capture every
action. Review periodically.

## First-response triage order for an API outage
1. CloudWatch: API service error logs + alarms.
2. ELB/target group: are targets healthy?
3. `pm2 list` / `pm2 logs` on the API box (SSM): is the process up / crash-looping / OOM?
4. RDS: connection count vs. max, CPU, failover/replica state, recent slow queries.
5. Correlate with last deploy (GitHub Actions / commit) and roll back if it lines up.
