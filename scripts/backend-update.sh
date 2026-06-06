#!/bin/bash
set -e

echo "=============================================="
echo "  AgriConnect Backend Update"
echo "=============================================="

if [ -z "$AWS_REGION" ]; then
  read -rp "Enter your AWS Region (e.g. us-east-1): " AWS_REGION
fi
export AWS_REGION

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
pm2 restart all

echo ""
echo "Done! Current PM2 status:"
pm2 status
