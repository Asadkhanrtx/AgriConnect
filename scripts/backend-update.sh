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
  echo "  SNS Topic ARN not found in saved config."
  echo "  Format: arn:aws:sns:<region>:<account-id>:AgriConnect-WeatherAlerts"
  read -rp "Enter SNS Topic ARN (or press Enter to skip): " SNS_TOPIC_ARN
fi
export SNS_TOPIC_ARN

if [ -n "$SNS_TOPIC_ARN" ]; then
  echo "  AWS Region     : $AWS_REGION"
  echo "  SNS Topic ARN  : $SNS_TOPIC_ARN"
else
  echo "  AWS Region     : $AWS_REGION"
  echo "  SNS Topic ARN  : (not set)"
fi

# Persist updated config
{
  echo "export AWS_REGION='$AWS_REGION'"
  [ -n "$SNS_TOPIC_ARN" ] && echo "export SNS_TOPIC_ARN='$SNS_TOPIC_ARN'"
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
# Restart auth, market, media, notif — they have no new env vars
for name in agriconnect-auth agriconnect-market agriconnect-media agriconnect-notif; do
  pm2 restart "$name" 2>/dev/null || true
done

# Order service — restart with updated env (picks up SNS_TOPIC_ARN from current shell)
export SNS_TOPIC_ARN
pm2 restart agriconnect-order --update-env 2>/dev/null || {
  echo "  agriconnect-order not found — starting it fresh..."
  cd /home/ubuntu/AgriConnect/services/order-service
  AWS_REGION=$AWS_REGION SNS_TOPIC_ARN=$SNS_TOPIC_ARN pm2 start index.js --name agriconnect-order
}

# Save updated process list so PM2 restores correct env on reboot
pm2 save

echo ""
echo "Done! Current PM2 status:"
pm2 status
echo ""
echo "  SNS env check for order-service:"
pm2 env agriconnect-order 2>/dev/null | grep -E "SNS_TOPIC_ARN|AWS_REGION" || echo "  (run: pm2 env agriconnect-order)"
