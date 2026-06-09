# ── Application Load Balancer ─────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.common_sg_id]
  subnets            = var.public_subnet_ids

  tags = { Name = "${var.name_prefix}-alb" }
}

# ── Target Groups ─────────────────────────────────────────────────────────────
resource "aws_lb_target_group" "frontend" {
  name     = "${var.name_prefix}-tg-frontend"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200-399"
  }
}

resource "aws_lb_target_group" "auth" {
  name     = "${var.name_prefix}-tg-auth"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "marketplace" {
  name     = "${var.name_prefix}-tg-market"
  port     = 3002
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "orders" {
  name     = "${var.name_prefix}-tg-orders"
  port     = 3003
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "media" {
  name     = "${var.name_prefix}-tg-media"
  port     = 3004
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "notifications" {
  name     = "${var.name_prefix}-tg-notif"
  port     = 3005
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

# ── Target Group Attachments ──────────────────────────────────────────────────
resource "aws_lb_target_group_attachment" "frontend" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = var.frontend_instance_id
  port             = 80
}

resource "aws_lb_target_group_attachment" "auth" {
  target_group_arn = aws_lb_target_group.auth.arn
  target_id        = var.backend_instance_id
  port             = 3001
}

resource "aws_lb_target_group_attachment" "marketplace" {
  target_group_arn = aws_lb_target_group.marketplace.arn
  target_id        = var.backend_instance_id
  port             = 3002
}

resource "aws_lb_target_group_attachment" "orders" {
  target_group_arn = aws_lb_target_group.orders.arn
  target_id        = var.backend_instance_id
  port             = 3003
}

resource "aws_lb_target_group_attachment" "media" {
  target_group_arn = aws_lb_target_group.media.arn
  target_id        = var.backend_instance_id
  port             = 3004
}

resource "aws_lb_target_group_attachment" "notifications" {
  target_group_arn = aws_lb_target_group.notifications.arn
  target_id        = var.backend_instance_id
  port             = 3005
}

# ── HTTP Listener with Path-Based Routing ────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # Default: forward to frontend
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "auth" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth.arn
  }

  condition {
    path_pattern { values = ["/api/auth/*"] }
  }
}

resource "aws_lb_listener_rule" "marketplace" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.marketplace.arn
  }

  condition {
    path_pattern { values = ["/api/marketplace/*"] }
  }
}

resource "aws_lb_listener_rule" "orders" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.orders.arn
  }

  condition {
    path_pattern { values = ["/api/orders/*"] }
  }
}

resource "aws_lb_listener_rule" "media" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.media.arn
  }

  condition {
    path_pattern { values = ["/api/media/*"] }
  }
}

resource "aws_lb_listener_rule" "notifications" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.notifications.arn
  }

  condition {
    path_pattern { values = ["/api/notifications/*"] }
  }
}
