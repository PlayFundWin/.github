# Incident & Process Log — `api.playfundwin.com` (pfw_v2) outage investigation

**Date:** 2026-06-05  ·  **Branch:** `claude/pfw-api-outage-WKpYw`  ·  **Status:** API failing; root cause pending stack access.

This document records the full investigation process, what was found, the access
limitations hit, and the plan to resolve. The supporting ops kit lives alongside it in
`ops/` (IAM policy, MCP config, in-VPC ops-box IaC, SessionStart hook, ACCESS runbook).

---

## 1. Trigger
Report: "Play Fund Win pfw_v2 API is down?"

## 2. Findings

### Confirmed: the backend API is failing right now
Both production frontends are logging continuous backend-fetch failures, every ~2 minutes,
across the entire observable window up to the time of investigation:
- **`pfw-next`** (Vercel): `TypeError: fetch failed`, `[ERROR TRACKING SSR] [HIGH]`,
  `Error generating metadata`, plus a flood of `POST /api/errors/track [HIGH]`.
- **`pfw-managed-site`** (Vercel): `[siteContentServer] fetch e…` — non-stop.

Pages still return HTTP 200 because SSR falls back to cached/default content, so the sites
*look* up to a casual visitor while live API-backed features (auth, checkout, draw data)
are broken.

### Healthy: the Vercel frontends themselves
Latest **production** deployments are `READY` for both `pfw-next` (#496) and
`pfw-managed-site` (#560). The `ERROR`/`BLOCKED` deployments are all preview/Dependabot
branches, never production.

### The down component: `api.playfundwin.com` — a separate backend
Per the `pfw_next` repo description (NextJS + AWS Amplify + "centralized API") and commit
#494 ("verified live against api.playfundwin.com … backend owns OAuth state+PKCE"), the API
is a **separate service on AWS** (EC2 + PM2 per operator), backed by RDS (Postgres + MySQL).
The frontends only *call* it.

## 3. Access limitations encountered (the "rejections")
- **GitHub:** this session is scoped to `playfundwin/.github` only. Reads/writes to
  `PFW_V2`, `PFW_API_V3`, `pfw_next`, `PFW_Managed_Site` are **denied at the proxy**
  ("Access denied: repository … is not configured for this session"). Fix = add those repos
  to the environment's repository scope, then restart the session.
- **AWS:** no AWS MCP server attached → cannot reach CloudWatch / EC2 / RDS / ELB / SSM.
  Fix = add the AWS MCP server (creds from the `pfw-claude-ops` role).
- **Network:** the web-session sandbox blocks outbound to non-allowlisted hosts (even
  `playfundwin.com`), so direct `curl`/SSH probes and a sandbox-hosted DB MCP cannot reach
  the API or private RDS. Fix = the in-VPC ops box, or SSM port-forward.

Config (repo scope + MCP servers) is read at **session start**, so the above take effect in
a **new** session, not mid-conversation.

## 4. Resolution plan (next session, once access is wired)
Triage order (see `ops/ACCESS.md`):
1. CloudWatch: API error logs + alarms.
2. ELB / target group: target health.
3. `pm2 list` / `pm2 logs` over SSM: process up / crash-looping / OOM?
4. RDS: connections vs. max, CPU, failover/replica state, slow queries.
5. Correlate with the last deploy; roll back if it lines up.

## 5. Access model delivered in this PR
"Read + controlled actions": read-everything for diagnosis; the only gated mutations are
`pm2 restart` (SSM), Vercel rollback, and deploy triggers — each requiring explicit
approval. IAM design forbids RDS modify/reboot/delete, EC2 stop/terminate, SG/IAM changes,
and DB writes. See `ops/iam/pfw-claude-ops.policy.json`.

> All committed files are placeholder-only — no secrets, account IDs, hostnames, or
> instance IDs. Real values come from env vars / SSM Parameter Store / Secrets Manager.
