# ── URLs & Endpoints ──────────────────────────────────────────────────────────
output "frontend_url" {
  description = "Frontend URL via ALB"
  value       = module.alb.frontend_url
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "backend_private_ip" {
  description = "Backend EC2 private IP (access via bastion)"
  value       = module.ec2.backend_private_ip
}

output "bastion_public_ip" {
  description = "Bastion host public IP for SSH tunneling"
  value       = module.ec2.bastion_public_ip
}

output "rds_endpoint" {
  description = "RDS MySQL endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

# ── SNS ───────────────────────────────────────────────────────────────────────
output "sns_weather_alerts_arn" {
  description = "SNS topic ARN for weather alerts (email broadcast)"
  value       = aws_sns_topic.weather_alerts.arn
}

output "sns_events_arn" {
  description = "SNS topic ARN for structured events (→ SQS → notification-service)"
  value       = aws_sns_topic.events.arn
}

# ── SQS ───────────────────────────────────────────────────────────────────────
output "sqs_notifications_url" {
  description = "SQS queue URL for notification events"
  value       = aws_sqs_queue.notifications.url
}

output "sqs_dlq_url" {
  description = "SQS dead-letter queue URL"
  value       = aws_sqs_queue.notifications_dlq.url
}

# ── Lambda ────────────────────────────────────────────────────────────────────
output "lambda_arn" {
  description = "Lambda function ARN (weather-alert-processor)"
  value       = aws_lambda_function.weather_alert.arn
}

# ── S3 ────────────────────────────────────────────────────────────────────────
output "s3_produce_images_url" {
  description = "S3 public URL for produce images"
  value       = module.s3.produce_images_bucket_url
}

output "s3_delivery_proofs_bucket" {
  description = "S3 private bucket name for delivery proofs"
  value       = module.s3.delivery_proofs_bucket_name
}

# ── SSH Helper ────────────────────────────────────────────────────────────────
output "ssh_backend_via_bastion" {
  description = "SSH command to reach backend EC2 via bastion"
  value       = "ssh -J ubuntu@${module.ec2.bastion_public_ip} ubuntu@${module.ec2.backend_private_ip}"
}
