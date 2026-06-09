variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "common_sg_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "backend_instance_id" {
  type = string
}

variable "frontend_instance_id" {
  type = string
}
