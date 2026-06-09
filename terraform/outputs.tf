# ── URLs ──────────────────────────────────────────────────────────────────────
output "frontend_url" {
  description = "Frontend URL (via ALB)"
  value       = "http://${module.alb.alb_dns_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "bastion_public_ip" {
  description = "Bastion host public IP"
  value       = module.ec2.bastion_public_ip
}

output "frontend_public_ip" {
  description = "Frontend EC2 public IP"
  value       = module.ec2.frontend_public_ip
}

output "backend_private_ip" {
  description = "Backend EC2 private IP (reach via bastion)"
  value       = module.ec2.backend_private_ip
}

output "rds_endpoint" {
  description = "RDS MySQL endpoint hostname"
  value       = module.rds.endpoint
  sensitive   = true
}

# ── SNS ───────────────────────────────────────────────────────────────────────
output "sns_weather_alerts_arn" {
  value = aws_sns_topic.weather_alerts.arn
}

output "sns_events_arn" {
  value = aws_sns_topic.events.arn
}

# ── SQS ───────────────────────────────────────────────────────────────────────
output "sqs_notifications_url" {
  value = aws_sqs_queue.notifications.url
}

output "sqs_dlq_url" {
  value = aws_sqs_queue.notifications_dlq.url
}

# ── Lambda ────────────────────────────────────────────────────────────────────
output "lambda_arn" {
  value = aws_lambda_function.weather_alert.arn
}

# ── S3 ────────────────────────────────────────────────────────────────────────
output "s3_produce_images_url" {
  value = "https://${var.s3_produce_images_bucket}.s3.${var.aws_region}.amazonaws.com"
}

# ── Secrets Manager ───────────────────────────────────────────────────────────
output "secret_database_arn" {
  value = aws_secretsmanager_secret.database.arn
}

output "jwt_secret_note" {
  value = "JWT secret stored in Secrets Manager: ${aws_secretsmanager_secret.jwt.name}"
}

# ── SSH helpers ───────────────────────────────────────────────────────────────
output "ssh_bastion" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${module.ec2.bastion_public_ip}"
}

output "ssh_backend" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem -J ubuntu@${module.ec2.bastion_public_ip} ubuntu@${module.ec2.backend_private_ip}"
}

output "ssh_frontend" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${module.ec2.frontend_public_ip}"
}
