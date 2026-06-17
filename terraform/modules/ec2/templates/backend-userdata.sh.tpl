#!/bin/bash
exec > /var/log/userdata.log 2>&1
set -e

echo "========================================================"
echo "  AgriConnect Backend — Automated Bootstrap"
echo "========================================================"

# ── 1. System packages ────────────────────────────────────────
apt-get update -y
apt-get install -y git curl

# ── 2. Clone repo ─────────────────────────────────────────────
git clone ${github_repo_url} /home/ubuntu/AgriConnect
chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect

# ── 3. Write config file (no manual prompts needed) ──────────
# backend-install.sh checks: if [ -z "$VAR" ]; then read -rp ...
# Pre-setting these vars skips ALL prompts automatically.
cat > /home/ubuntu/.agriconnect-config <<CONF
export AWS_REGION='${aws_region}'
export SNS_TOPIC_ARN='${sns_topic_arn}'
export EVENTS_TOPIC_ARN='${events_topic_arn}'
export NOTIFICATIONS_QUEUE_URL='${notifications_queue_url}'
CONF
chmod 600 /home/ubuntu/.agriconnect-config
chown ubuntu:ubuntu /home/ubuntu/.agriconnect-config

# ── 4. Run install script as ubuntu (env vars pre-injected) ──
su - ubuntu -c "
  set -e
  export AWS_REGION='${aws_region}'
  export SNS_TOPIC_ARN='${sns_topic_arn}'
  export EVENTS_TOPIC_ARN='${events_topic_arn}'
  export NOTIFICATIONS_QUEUE_URL='${notifications_queue_url}'
  bash /home/ubuntu/AgriConnect/scripts/backend-install.sh
"

echo "========================================================"
echo "  Bootstrap complete — check: pm2 status"
echo "========================================================"
