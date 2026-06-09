variable "alb_dns_name" {
  description = "ALB DNS name (CloudFront origin)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
