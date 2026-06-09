variable "name_prefix" { type = string }
variable "ami_id" { type = string }
variable "key_pair_name" { type = string }
variable "common_sg_id" { type = string }
variable "ec2_instance_profile_name" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "github_repo_url" { type = string }
variable "aws_region" { type = string }

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
