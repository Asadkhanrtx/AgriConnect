# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  AgriConnect — Root Terraform Configuration                                ║
# ║  Creates ALL cloud infrastructure from scratch. No import blocks.          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# (JWT secret provided via var.jwt_secret in terraform.tfvars)

# ── Lambda package (index.js only — @aws-sdk/client-sns bundled in Node 18+) ──
data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/weather-alert-processor/index.js"
  output_path = "${path.module}/lambda_package.zip"
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
  source = "./modules/security"
  vpc_id = module.networking.vpc_id
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

# ── Secrets Manager ───────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "database" {
  name                    = "agriconnect/${var.environment}/database"
  description             = "RDS MySQL credentials"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    host     = module.rds.endpoint
    port     = 3306
    database = var.rds_db_name
    username = var.rds_username
    password = var.rds_password
  })
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "agriconnect/${var.environment}/jwt"
  description             = "JWT signing secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id
  secret_string = jsonencode({
    jwt_secret = var.jwt_secret
    jwt_expiry = var.jwt_expiry
  })
}

resource "aws_secretsmanager_secret" "aws_creds" {
  name                    = "agriconnect/${var.environment}/aws"
  description             = "AWS credentials (USE_IAM_ROLE = use instance profile)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "aws_creds" {
  secret_id = aws_secretsmanager_secret.aws_creds.id
  secret_string = jsonencode({
    access_key = "USE_IAM_ROLE"
    secret_key = "USE_IAM_ROLE"
    region     = var.aws_region
  })
}

resource "aws_secretsmanager_secret" "email" {
  name                    = "agriconnect/${var.environment}/email"
  description             = "SMTP email credentials for notifications"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "email" {
  secret_id = aws_secretsmanager_secret.email.id
  secret_string = jsonencode({
    host = var.smtp_host
    port = var.smtp_port
    user = var.smtp_user
    pass = var.smtp_pass
    from = var.smtp_from != "" ? var.smtp_from : var.smtp_user
  })
}

resource "aws_secretsmanager_secret" "s3" {
  name                    = "agriconnect/${var.environment}/s3"
  description             = "S3 bucket names for media uploads"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "s3" {
  secret_id = aws_secretsmanager_secret.s3.id
  secret_string = jsonencode({
    produce_bucket  = var.s3_produce_images_bucket
    delivery_bucket = var.s3_delivery_proofs_bucket
    region          = var.aws_region
  })
}

# ── SNS Topics ────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "weather_alerts" {
  name = "AgriConnect-WeatherAlerts"
}

resource "aws_sns_topic" "events" {
  name = "AgriConnect-Events"
}

# ── SQS Queues ────────────────────────────────────────────────────────────────

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "AgriConnect-Notifications-DLQ"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "notifications" {
  name                       = "AgriConnect-Notifications-Queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "notifications" {
  queue_url = aws_sqs_queue.notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowSNSPublish"
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.notifications.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = aws_sns_topic.events.arn }
      }
    }]
  })
}

resource "aws_sns_topic_subscription" "events_to_sqs" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notifications.arn
}

# ── Lambda Function ───────────────────────────────────────────────────────────

resource "aws_lambda_function" "weather_alert" {
  function_name    = "weather-alert-processor"
  role             = module.security.lambda_role_arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN    = aws_sns_topic.weather_alerts.arn
      EVENTS_TOPIC_ARN = aws_sns_topic.events.arn
    }
  }
}

resource "aws_lambda_permission" "scheduler_invoke" {
  statement_id  = "AllowSchedulerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weather_alert.function_name
  principal     = "scheduler.amazonaws.com"
  # Constructed directly to avoid circular dependency with aws_scheduler_schedule
  source_arn    = "arn:aws:scheduler:${var.aws_region}:${local.account_id}:schedule/default/agriconnect-weather-check"
}

# ── EventBridge Scheduler ─────────────────────────────────────────────────────

resource "aws_scheduler_schedule" "weather_check" {
  name       = "agriconnect-weather-check"
  group_name = "default"
  state      = "ENABLED"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.weather_schedule_expression
  schedule_expression_timezone = "Asia/Kolkata"

  target {
    arn      = aws_lambda_function.weather_alert.arn
    role_arn = module.security.scheduler_role_arn
  }
}
