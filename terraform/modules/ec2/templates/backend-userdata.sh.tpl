#!/bin/bash
exec > /var/log/userdata.log 2>&1

echo "========================================================"
echo "  AgriConnect Backend — Automated Bootstrap"
echo "========================================================"

# ── 1. System packages ────────────────────────────────────────
apt-get update -y
apt-get install -y git curl

# ── 2. Clone repo ─────────────────────────────────────────────
git clone ${github_repo_url} /home/ubuntu/AgriConnect
chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect

# ── 3. Write config file (skips all manual prompts) ──────────
cat > /home/ubuntu/.agriconnect-config <<CONF
export AWS_REGION='${aws_region}'
export SNS_TOPIC_ARN='${sns_topic_arn}'
export EVENTS_TOPIC_ARN='${events_topic_arn}'
export NOTIFICATIONS_QUEUE_URL='${notifications_queue_url}'
CONF
chmod 600 /home/ubuntu/.agriconnect-config
chown ubuntu:ubuntu /home/ubuntu/.agriconnect-config

# ── 4. Write a self-contained bootstrap script ────────────────
# We write to a file first — avoids su -c multiline quoting issues
cat > /tmp/run-backend-install.sh <<'RUNSCRIPT'
#!/bin/bash
set -e
source /home/ubuntu/.agriconnect-config
bash /home/ubuntu/AgriConnect/scripts/backend-install.sh
RUNSCRIPT
chmod +x /tmp/run-backend-install.sh
chown ubuntu:ubuntu /tmp/run-backend-install.sh

# ── 5. Run as ubuntu user ─────────────────────────────────────
su - ubuntu -c "bash /tmp/run-backend-install.sh"

echo "========================================================"
echo "  Bootstrap complete — check: pm2 status"
echo "========================================================"
