output "common_sg_id" {
  value = aws_security_group.common.id
}

output "ec2_instance_profile_name" {
  value = aws_iam_instance_profile.ec2.name
}

output "ec2_role_name" {
  value = aws_iam_role.ec2.name
}

output "lambda_role_arn" {
  value = aws_iam_role.lambda.arn
}

output "scheduler_role_arn" {
  value = aws_iam_role.scheduler.arn
}
