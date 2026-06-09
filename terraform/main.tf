# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  AgriConnect — Root Terraform Configuration                                ║
# ║  Terraform 1.5+  |  import blocks replace CLI `terraform import`           ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── Data sources ──────────────────────────────────────────────────────────────

# Existing Secrets Manager secrets (read-only — never recreated)
data "aws_secretsmanager_secret" "database" {
  name = local.secret_ids.database
}
data "aws_secretsmanager_secret" "jwt" {
  name = local.secret_ids.jwt
}
data "aws_secretsmanager_secret" "aws_creds" {
  name = local.secret_ids.aws
}
data "aws_secretsmanager_secret" "email" {
  name = local.secret_ids.email
}
data "aws_secretsmanager_secret" "s3" {
  name = local.secret_ids.s3
}

# ── Modules ───────────────────────────────────────────────────────────────────

module "networking" {
  source               = "./modules/networking"
  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}

module "security" {
  source            = "./modules/security"
  vpc_id            = module.networking.vpc_id
  ec2_iam_role_name = var.ec2_iam_role_name
}

module "rds" {
  source             = "./modules/rds"
  name_prefix        = local.name_prefix
  private_subnet_ids = module.networking.private_subnet_ids
  common_sg_id       = module.security.common_sg_id
  rds_instance_class = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  db_name            = var.rds_db_name
  db_username        = var.rds_username
  db_password        = var.rds_password
}

module "s3" {
  source                 = "./modules/s3"
  produce_images_bucket  = var.s3_produce_images_bucket
  delivery_proofs_bucket = var.s3_delivery_proofs_bucket
}

module "ec2" {
  source                    = "./modules/ec2"
  name_prefix               = local.name_prefix
  ami_id                    = var.ami_id
  key_pair_name             = var.key_pair_name
  common_sg_id              = module.security.common_sg_id
  ec2_instance_profile_name = module.security.ec2_instance_profile_name
  public_subnet_ids         = module.networking.public_subnet_ids
  private_subnet_ids        = module.networking.private_subnet_ids
  bastion_instance_type     = var.bastion_instance_type
  backend_instance_type     = var.backend_instance_type
  frontend_instance_type    = var.frontend_instance_type
  github_repo_url           = var.github_repo_url
  aws_region                = var.aws_region
  sns_topic_arn             = aws_sns_topic.weather_alerts.arn
  events_topic_arn          = aws_sns_topic.events.arn
  notifications_queue_url   = aws_sqs_queue.notifications.url
  rds_endpoint              = module.rds.endpoint
  # alb_dns_name passed as empty — frontend-install.sh reads ALB_DNS from env
  # which is set post-deploy. The frontend serves the React build via Nginx.
  alb_dns_name              = ""
  rds_dependency            = module.rds.db_instance
}

module "alb" {
  source               = "./modules/alb"
  name_prefix          = local.name_prefix
  vpc_id               = module.networking.vpc_id
  common_sg_id         = module.security.common_sg_id
  public_subnet_ids    = module.networking.public_subnet_ids
  backend_instance_id  = module.ec2.backend_instance_id
  frontend_instance_id = module.ec2.frontend_instance_id
}

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  EXISTING RESOURCES — imported via Terraform 1.5+ import blocks            ║
# ║  These already exist in AWS. Import blocks wire them to Terraform state     ║
# ║  without recreating them.  lifecycle.prevent_destroy keeps them safe from  ║
# ║  `terraform destroy`.                                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── EC2 IAM Role (existing — import into security module) ─────────────────────
import {
  to = module.security.aws_iam_role.ec2
  id = "AgriConnectEC2Role"
}

import {
  to = module.security.aws_iam_instance_profile.ec2
  id = "AgriConnectEC2Role"
}

# ── SNS Topics ────────────────────────────────────────────────────────────────
import {
  to = aws_sns_topic.weather_alerts
  id = "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts"
}

resource "aws_sns_topic" "weather_alerts" {
  name = var.sns_weather_topic_name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

import {
  to = aws_sns_topic.events
  id = "arn:aws:sns:ap-south-1:978594443309:AgriConnect-Events"
}

resource "aws_sns_topic" "events" {
  name = var.sns_events_topic_name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

# ── SQS Queues ────────────────────────────────────────────────────────────────
import {
  to = aws_sqs_queue.notifications_dlq
  id = "https://sqs.ap-south-1.amazonaws.com/978594443309/AgriConnect-Notifications-DLQ"
}

resource "aws_sqs_queue" "notifications_dlq" {
  name = var.sqs_dlq_name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

import {
  to = aws_sqs_queue.notifications
  id = "https://sqs.ap-south-1.amazonaws.com/978594443309/AgriConnect-Notifications-Queue"
}

resource "aws_sqs_queue" "notifications" {
  name = var.sqs_notifications_queue_name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

# ── Lambda Function ───────────────────────────────────────────────────────────
import {
  to = aws_lambda_function.weather_alert
  id = "weather-alert-processor"
}

resource "aws_lambda_function" "weather_alert" {
  function_name = var.lambda_function_name
  role          = data.aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60

  # filename required by schema — ignored after import; real code stays in AWS
  filename = "${path.module}/lambda_placeholder.zip"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

# ── EventBridge Scheduler (existing — not a CloudWatch Event Rule) ────────────
# This is an aws_scheduler_schedule, not aws_cloudwatch_event_rule.
# Import ID format: <group_name>/<schedule_name>
import {
  to = aws_scheduler_schedule.weather_check
  id = "default/agriconnect-weather-check"
}

resource "aws_scheduler_schedule" "weather_check" {
  name       = var.eventbridge_rule_name
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(6 hours)"

  target {
    arn      = aws_lambda_function.weather_alert.arn
    role_arn = data.aws_iam_role.lambda.arn
  }

  lifecycle {
    prevent_destroy = true
    # ignore_changes = all keeps the existing schedule config untouched —
    # the scheduler was already wired correctly in AWS before Terraform managed it
    ignore_changes = all
  }
}

# ── IAM Role data sources (existing — read-only) ──────────────────────────────
data "aws_iam_role" "lambda" {
  name = var.lambda_iam_role_name
}
