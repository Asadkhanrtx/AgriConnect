#!/bin/bash
set -e

echo "=============================================="
echo "  AgriConnect Backend Update"
echo "=============================================="

# ── Load saved config (written by backend-install.sh) ─────────────────────────
if [ -f /home/ubuntu/.agriconnect-config ]; then
  # shellcheck disable=SC1090
  source /home/ubuntu/.agriconnect-config
fi

if [ -z "$AWS_REGION" ]; then
  read -rp "Enter your AWS Region (e.g. ap-south-1): " AWS_REGION
fi
export AWS_REGION

if [ -z "$SNS_TOPIC_ARN" ]; then
  echo "  SNS_TOPIC_ARN not found in saved config."
  echo "  Format: arn:aws:sns:<region>:<account-id>:AgriConnect-WeatherAlerts"
  read -rp "Enter SNS_TOPIC_ARN (or press Enter to skip): " SNS_TOPIC_ARN
fi
export SNS_TOPIC_ARN

if [ -z "$EVENTS_TOPIC_ARN" ]; then
  echo "  EVENTS_TOPIC_ARN not found in saved config."
  echo "  Format: arn:aws:sns:<region>:<account-id>:AgriConnect-Events"
  read -rp "Enter EVENTS_TOPIC_ARN (or press Enter to skip): " EVENTS_TOPIC_ARN
fi
export EVENTS_TOPIC_ARN

if [ -z "$NOTIFICATIONS_QUEUE_URL" ]; then
  echo "  NOTIFICATIONS_QUEUE_URL not found in saved config."
  echo "  Format: https://sqs.<region>.amazonaws.com/<account-id>/AgriConnect-Notifications-Queue"
  read -rp "Enter NOTIFICATIONS_QUEUE_URL (or press Enter to skip): " NOTIFICATIONS_QUEUE_URL
fi
export NOTIFICATIONS_QUEUE_URL

echo ""
echo "  AWS_REGION             : $AWS_REGION"
echo "  SNS_TOPIC_ARN          : ${SNS_TOPIC_ARN:-(not set)}"
echo "  EVENTS_TOPIC_ARN       : ${EVENTS_TOPIC_ARN:-(not set)}"
echo "  NOTIFICATIONS_QUEUE_URL: ${NOTIFICATIONS_QUEUE_URL:-(not set)}"
echo ""

# Persist updated config
{
  echo "export AWS_REGION='$AWS_REGION'"
  [ -n "$SNS_TOPIC_ARN" ]            && echo "export SNS_TOPIC_ARN='$SNS_TOPIC_ARN'"
  [ -n "$EVENTS_TOPIC_ARN" ]         && echo "export EVENTS_TOPIC_ARN='$EVENTS_TOPIC_ARN'"
  [ -n "$NOTIFICATIONS_QUEUE_URL" ]  && echo "export NOTIFICATIONS_QUEUE_URL='$NOTIFICATIONS_QUEUE_URL'"
} > /home/ubuntu/.agriconnect-config
chmod 600 /home/ubuntu/.agriconnect-config

cd /home/ubuntu/AgriConnect

echo "[1/4] Pulling latest code..."
git pull origin main

echo "[2/4] Updating dependencies..."
cd /home/ubuntu/AgriConnect/shared && npm install

SERVICES=("auth-service" "marketplace-service" "order-service" "media-service" "notification-service")
for service in "${SERVICES[@]}"; do
  cd /home/ubuntu/AgriConnect/services/$service && npm install
done

echo "[3/4] Running migrations..."
cd /home/ubuntu/AgriConnect/shared
AWS_REGION=$AWS_REGION node scripts/migrate.js

echo "[4/4] Restarting services..."

# auth, media — no AWS env var changes; plain restart
for name in agriconnect-auth agriconnect-media; do
  pm2 restart "$name" 2>/dev/null || true
done

# marketplace-service — picks up EVENTS_TOPIC_ARN
pm2 restart agriconnect-market --update-env 2>/dev/null || {
  echo "  agriconnect-market not found — starting fresh..."
  cd /home/ubuntu/AgriConnect/services/marketplace-service
  AWS_REGION=$AWS_REGION EVENTS_TOPIC_ARN=$EVENTS_TOPIC_ARN pm2 start index.js --name agriconnect-market
}

# order-service — picks up SNS_TOPIC_ARN + EVENTS_TOPIC_ARN
pm2 restart agriconnect-order --update-env 2>/dev/null || {
  echo "  agriconnect-order not found — starting fresh..."
  cd /home/ubuntu/AgriConnect/services/order-service
  AWS_REGION=$AWS_REGION SNS_TOPIC_ARN=$SNS_TOPIC_ARN EVENTS_TOPIC_ARN=$EVENTS_TOPIC_ARN pm2 start index.js --name agriconnect-order
}

# notification-service — picks up NOTIFICATIONS_QUEUE_URL for SQS polling
pm2 restart agriconnect-notif --update-env 2>/dev/null || {
  echo "  agriconnect-notif not found — starting fresh..."
  cd /home/ubuntu/AgriConnect/services/notification-service
  AWS_REGION=$AWS_REGION NOTIFICATIONS_QUEUE_URL=$NOTIFICATIONS_QUEUE_URL pm2 start index.js --name agriconnect-notif
}

# Save updated process list so PM2 restores correct env on reboot
pm2 save

echo ""
echo "Done! Current PM2 status:"
pm2 status
echo ""
echo "  Env check:"
echo "  — order-service:"
pm2 env agriconnect-order 2>/dev/null | grep -E "SNS_TOPIC_ARN|EVENTS_TOPIC_ARN|AWS_REGION" || echo "    (run: pm2 env agriconnect-order)"
echo "  — notification-service:"
pm2 env agriconnect-notif 2>/dev/null | grep -E "NOTIFICATIONS_QUEUE_URL|AWS_REGION" || echo "    (run: pm2 env agriconnect-notif)"
