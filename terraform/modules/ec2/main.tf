# ── Bastion Host ──────────────────────────────────────────────────────────────
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
    set -e
    exec > /var/log/bastion-init.log 2>&1

    echo "=== Bastion init: $(date) ==="
    apt-get update -y
    apt-get install -y curl git unzip

    # AWS CLI v2
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws

    # Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    echo "=== Bastion init complete: $(date) ==="
  EOF
  )

  tags = { Name = "${var.name_prefix}-bastion" }
}

# ── Backend EC2 ───────────────────────────────────────────────────────────────
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
    rds_endpoint            = var.rds_endpoint
  }))

  depends_on = [var.rds_dependency]

  tags = { Name = "${var.name_prefix}-backend" }
}

# ── Frontend EC2 ──────────────────────────────────────────────────────────────
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
    alb_dns_name    = var.alb_dns_name
  }))

  tags = { Name = "${var.name_prefix}-frontend" }
}
