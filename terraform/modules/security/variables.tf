variable "vpc_id" {
  type = string
}

variable "ec2_iam_role_name" {
  type    = string
  default = "AgriConnect-EC2-Role"
}
