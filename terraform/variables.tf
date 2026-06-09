# ── Region & Naming ───────────────────────────────────────────────────────────
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "agriconnect"
}

# ── Networking ────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

# ── EC2 ───────────────────────────────────────────────────────────────────────
variable "ami_id" {
  description = "Ubuntu 24.04 LTS AMI for ap-south-1"
  type        = string
  default     = "ami-0388e3ada3d9812da"
}

variable "key_pair_name" {
  type = string
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "rds_db_name" {
  type    = string
  default = "agriconnect"
}

variable "rds_username" {
  type      = string
  sensitive = true
  default   = "admin"
}

variable "rds_password" {
  type      = string
  sensitive = true
}

# ── S3 ────────────────────────────────────────────────────────────────────────
variable "s3_produce_images_bucket" {
  type = string
}

variable "s3_delivery_proofs_bucket" {
  type = string
}

# ── SMTP (stored in Secrets Manager / used by notification emails) ─────────────
variable "smtp_host" {
  type    = string
  default = "smtp.gmail.com"
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "smtp_user" {
  description = "Gmail address used as sender"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_pass" {
  description = "Gmail App Password (16-char from Google Account → Security → App Passwords)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  description = "Display name + address shown as sender, e.g. AgriConnect <you@gmail.com>"
  type        = string
  default     = ""
}

# ── Application ───────────────────────────────────────────────────────────────
variable "github_repo_url" {
  type    = string
  default = "https://github.com/Asadkhanrtx/AgriConnect.git"
}

variable "jwt_secret" {
  description = "JWT signing secret (hex string)"
  type        = string
  sensitive   = true
}

variable "jwt_expiry" {
  description = "JWT token expiry duration"
  type        = string
  default     = "24h"
}

# ── Lambda / EventBridge ──────────────────────────────────────────────────────
variable "weather_schedule_expression" {
  description = "EventBridge Scheduler rate expression for weather checks"
  type        = string
  default     = "rate(6 hours)"
}
