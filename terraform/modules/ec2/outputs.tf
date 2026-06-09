output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}

output "backend_private_ip" {
  value = aws_instance.backend.private_ip
}

output "backend_instance_id" {
  value = aws_instance.backend.id
}

output "frontend_public_ip" {
  value = aws_instance.frontend.public_ip
}

output "frontend_instance_id" {
  value = aws_instance.frontend.id
}
