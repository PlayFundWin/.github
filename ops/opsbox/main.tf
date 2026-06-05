# PFW Claude ops box — small in-VPC EC2 that runs Claude Code with native access
# to PM2 (API instances, via SSM) and RDS (Postgres + MySQL), without exposing
# anything publicly. Managed entirely through SSM Session Manager (no inbound SSH).
#
# Fill the variables (or pass -var) — no real values are committed here.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

variable "region"            { type = string }
variable "vpc_id"            { type = string }
variable "private_subnet_id" { type = string }
variable "rds_postgres_sg_id" { type = string }
variable "rds_mysql_sg_id"   { type = string }
variable "instance_type"     { type = string  default = "t4g.small" }

# --- IAM: instance role = read + gated SendCommand + SSM core + scoped secrets ---
resource "aws_iam_role" "ops" {
  name = "pfw-claude-ops"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ops_inline" {
  name   = "pfw-claude-ops"
  role   = aws_iam_role.ops.id
  policy = file("${path.module}/../iam/pfw-claude-ops.policy.json")
}

# SSM agent connectivity for the ops box itself
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ops.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ops" {
  name = "pfw-claude-ops"
  role = aws_iam_role.ops.name
}

# --- SG: egress only (RDS + 443). No inbound rules at all. ---
resource "aws_security_group" "ops" {
  name        = "pfw-claude-ops"
  description = "PFW Claude ops box - egress only"
  vpc_id      = var.vpc_id

  egress {
    description     = "Postgres to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_postgres_sg_id]
  }
  egress {
    description     = "MySQL to RDS"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [var.rds_mysql_sg_id]
  }
  egress {
    description = "HTTPS (GitHub, Vercel, Anthropic, AWS APIs, SSM)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Project = "pfw" }
}

# Allow the ops box to reach each RDS instance (inbound on the RDS SGs from this SG only)
resource "aws_security_group_rule" "pg_from_ops" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = var.rds_postgres_sg_id
  source_security_group_id = aws_security_group.ops.id
  description              = "PFW Claude ops box"
}

resource "aws_security_group_rule" "mysql_from_ops" {
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = var.rds_mysql_sg_id
  source_security_group_id = aws_security_group.ops.id
  description              = "PFW Claude ops box"
}

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]
  filter { name = "name"          values = ["al2023-ami-*-arm64"] }
  filter { name = "architecture"  values = ["arm64"] }
}

resource "aws_instance" "ops" {
  ami                    = data.aws_ami.al2023_arm.id
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_id
  iam_instance_profile   = aws_iam_instance_profile.ops.name
  vpc_security_group_ids = [aws_security_group.ops.id]
  user_data              = file("${path.module}/user-data.sh")

  metadata_options {        # IMDSv2 only
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  tags = { Name = "pfw-claude-ops", Project = "pfw" }
}

output "connect_hint" {
  value = "aws ssm start-session --target ${aws_instance.ops.id} --region ${var.region}"
}
