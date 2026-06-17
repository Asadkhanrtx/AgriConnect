# ── Bastion ───────────────────────────────────────────────────────────────────
resource "aws_instance" "bastion" {
  ami                         = var.ami_id
  instance_type               = var.bastion_instance_type
  subnet_id                   = var.public_subnet_ids[0]
  vpc_security_group_ids      = [var.common_sg_id]
  key_name                    = var.key_pair_name
  iam_instance_profile        = var.ec2_instance_profile_name
  associate_public_ip_address = true

  user_data = base64encode(<<-EOF
    #!/bin/bash
    exec > /var/log/userdata.log 2>&1
    apt-get update -y
    apt-get install -y git
    sudo -u ubuntu git clone ${var.github_repo_url} /home/ubuntu/AgriConnect
    chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect
  EOF
  )

  tags = { Name = "${var.name_prefix}-bastion" }
}

# ── Backend EC2 (private subnet) ──────────────────────────────────────────────
resource "aws_instance" "backend" {
  ami                    = var.ami_id
  instance_type          = var.backend_instance_type
  subnet_id              = var.private_subnet_ids[0]
  vpc_security_group_ids = [var.common_sg_id]
  key_name               = var.key_pair_name
  iam_instance_profile   = var.ec2_instance_profile_name

  user_data = base64encode(templatefile("${path.module}/templates/backend-userdata.sh.tpl", {
    github_repo_url         = var.github_repo_url
    aws_region              = var.aws_region
    sns_topic_arn           = var.sns_topic_arn
    events_topic_arn        = var.events_topic_arn
    notifications_queue_url = var.notifications_queue_url
  }))

  tags = { Name = "${var.name_prefix}-backend" }
}

# ── Frontend EC2 (public subnet) ──────────────────────────────────────────────
resource "aws_instance" "frontend" {
  ami                         = var.ami_id
  instance_type               = var.frontend_instance_type
  subnet_id                   = var.public_subnet_ids[0]
  vpc_security_group_ids      = [var.common_sg_id]
  key_name                    = var.key_pair_name
  iam_instance_profile        = var.ec2_instance_profile_name
  associate_public_ip_address = true

  user_data = base64encode(templatefile("${path.module}/templates/frontend-userdata.sh.tpl", {
    github_repo_url = var.github_repo_url
    farmbot_api_url = var.farmbot_api_url
  }))

  tags = { Name = "${var.name_prefix}-frontend" }
}
