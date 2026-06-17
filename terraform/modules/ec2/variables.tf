variable "name_prefix" { type = string }
variable "ami_id" { type = string }
variable "key_pair_name" { type = string }
variable "common_sg_id" { type = string }
variable "ec2_instance_profile_name" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "github_repo_url" { type = string }
variable "aws_region" { type = string }

# ── Auto-injected into EC2 user data (no manual prompts) ──────
variable "sns_topic_arn" {
  type        = string
  description = "AgriConnect-WeatherAlerts SNS ARN"
  default     = ""
}

variable "events_topic_arn" {
  type        = string
  description = "AgriConnect-Events SNS ARN"
  default     = ""
}

variable "notifications_queue_url" {
  type        = string
  description = "AgriConnect-Notifications-Queue SQS URL"
  default     = ""
}

variable "farmbot_api_url" {
  type        = string
  description = "FarmBot API Gateway URL injected into frontend .env.production"
  default     = ""
}

variable "buyerbot_api_url" {
  type        = string
  description = "BuyerBot API Gateway URL injected into frontend .env.production"
  default     = ""
}

variable "bastion_instance_type" {
  type    = string
  default = "t2.micro"
}

variable "backend_instance_type" {
  type    = string
  default = "t2.micro"
}

variable "frontend_instance_type" {
  type    = string
  default = "t2.micro"
}
