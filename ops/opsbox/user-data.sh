#!/usr/bin/env bash
# Cloud-init bootstrap for the PFW Claude ops box.
# Pulls read-only ops secrets from SSM Parameter Store at boot — nothing baked into the image.
set -euxo pipefail

# Node 20 + git
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs git jq

# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Fetch ops secrets from Parameter Store (role is scoped to /pfw/claude-ops/*)
REGION="$(curl -s http://169.254.169.254/latest/meta-data/placement/region)"
get() { aws ssm get-parameter --with-decryption --region "$REGION" --name "$1" --query Parameter.Value --output text; }

mkdir -p /opt/pfw-ops && cd /opt/pfw-ops
cat > .env <<EOF
PFW_AWS_REGION=$REGION
PFW_PG_READONLY_URL=$(get /pfw/claude-ops/pg_readonly_url)
PFW_MYSQL_HOST=$(get /pfw/claude-ops/mysql_host)
PFW_MYSQL_RO_USER=$(get /pfw/claude-ops/mysql_ro_user)
PFW_MYSQL_RO_PASS=$(get /pfw/claude-ops/mysql_ro_pass)
PFW_MYSQL_DB=$(get /pfw/claude-ops/mysql_db)
EOF
chmod 600 .env

# .mcp.json is templated from the committed example; AWS creds come from the instance role,
# so no AWS keys are written to disk here.
echo "PFW ops box ready. SSM in, 'cd /opt/pfw-ops && set -a && . .env && claude'."
