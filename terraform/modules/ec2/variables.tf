variable "name_prefix" {
  type = string
}

variable "ami_id" {
  type = string
}

variable "key_pair_name" {
  type = string
}

variable "common_sg_id" {
  type = string
}

variable "ec2_instance_profile_name" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "bastion_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "backend_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "frontend_instance_type" {
  type    = string
  default = "t3.small"
}

variable "github_repo_url" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "sns_topic_arn" {
  type    = string
  default = ""
}

variable "events_topic_arn" {
  type    = string
  default = ""
}

variable "notifications_queue_url" {
  type    = string
  default = ""
}

variable "rds_endpoint" {
  type    = string
  default = ""
}

variable "alb_dns_name" {
  type    = string
  default = ""
}

variable "rds_dependency" {
  description = "Dependency placeholder to ensure RDS is created before backend"
  type        = any
  default     = null
}
