resource "aws_security_group" "common" {
  name        = "AgriConnect-Common-SG"
  description = "Common security group for all AgriConnect EC2 instances"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend services"
    from_port   = 3001
    to_port     = 3005
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "MySQL"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "AgriConnect-Common-SG" }
}

# ── EC2 IAM Role (imported — read-only, do not modify) ────────────────────────
resource "aws_iam_role" "ec2" {
  name = var.ec2_iam_role_name

  # Placeholder — real trust policy already set in AWS and never changed by Terraform
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = []
  })

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

# ── EC2 IAM Instance Profile (imported — read-only) ───────────────────────────
resource "aws_iam_instance_profile" "ec2" {
  name = var.ec2_iam_role_name
  role = aws_iam_role.ec2.name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}
