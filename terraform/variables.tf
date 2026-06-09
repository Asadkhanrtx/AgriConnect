# ── Region & Naming ───────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "agriconnect"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# ── Networking ────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "availability_zones" {
  description = "Availability zones to use (must match subnet count)"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

# ── EC2 ───────────────────────────────────────────────────────────────────────
variable "bastion_instance_type" {
  description = "EC2 instance type for the bastion host"
  type        = string
  default     = "t3.micro"
}

variable "backend_instance_type" {
  description = "EC2 instance type for backend services"
  type        = string
  default     = "t3.medium"
}

variable "frontend_instance_type" {
  description = "EC2 instance type for the frontend"
  type        = string
  default     = "t3.small"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI ID for the target region"
  type        = string
  # ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server — update per region
  default     = "ami-0f5ee92e2d63afc18"
}

variable "key_pair_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

# ── RDS ───────────────────────────────────────────────────────────────────────
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Allocated storage in GiB for RDS"
  type        = number
  default     = 20
}

variable "rds_db_name" {
  description = "Initial database name"
  type        = string
  default     = "agriconnect"
}

variable "rds_username" {
  description = "Master username for RDS"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "rds_password" {
  description = "Master password for RDS"
  type        = string
  sensitive   = true
}

# ── S3 ────────────────────────────────────────────────────────────────────────
variable "s3_produce_images_bucket" {
  description = "S3 bucket name for produce images (public read)"
  type        = string
  default     = "agriconnect-produce-images-978594443309"
}

variable "s3_delivery_proofs_bucket" {
  description = "S3 bucket name for delivery proofs (private)"
  type        = string
  default     = "agriconnect-delivery-proofs-978594443309"
}

# ── Existing AWS Resources (imported) ─────────────────────────────────────────
variable "lambda_function_name" {
  description = "Name of the existing Lambda function"
  type        = string
  default     = "weather-alert-processor"
}

variable "eventbridge_rule_name" {
  description = "Name of the existing EventBridge rule"
  type        = string
  default     = "agriconnect-weather-check"
}

variable "sns_weather_topic_name" {
  description = "Name of the existing SNS WeatherAlerts topic"
  type        = string
  default     = "AgriConnect-WeatherAlerts"
}

variable "sns_events_topic_name" {
  description = "Name of the existing SNS Events topic"
  type        = string
  default     = "AgriConnect-Events"
}

variable "sqs_notifications_queue_name" {
  description = "Name of the existing SQS notifications queue"
  type        = string
  default     = "AgriConnect-Notifications-Queue"
}

variable "sqs_dlq_name" {
  description = "Name of the existing SQS dead-letter queue"
  type        = string
  default     = "AgriConnect-Notifications-DLQ"
}

variable "lambda_iam_role_name" {
  description = "Name of the existing IAM role for Lambda"
  type        = string
  default     = "AgriConnectLambdaRole"
}

variable "ec2_iam_role_name" {
  description = "Name of the existing IAM role for EC2 instances"
  type        = string
  default     = "AgriConnectEC2Role"
}

variable "aws_account_id" {
  description = "AWS account ID (used for documentation; Terraform resolves it automatically via data source)"
  type        = string
  default     = "978594443309"
}

# ── Application ───────────────────────────────────────────────────────────────
variable "github_repo_url" {
  description = "GitHub repository URL for the AgriConnect project"
  type        = string
  default     = "https://github.com/Asadkhanrtx/AgriConnect.git"
}

variable "openweather_api_key" {
  description = "OpenWeatherMap API key for Lambda function"
  type        = string
  sensitive   = true
  default     = ""
}
