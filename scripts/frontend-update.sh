#!/bin/bash
set -e

echo "=============================================="
echo "  AgriConnect Frontend Update"
echo "=============================================="

if [ -z "$BACKEND_URL" ]; then
  read -rp "Enter the Backend ALB DNS or IP: " BACKEND_URL
fi
BACKEND_URL="${BACKEND_URL%/}"

cd /home/ubuntu/AgriConnect

echo "[1/3] Pulling latest code..."
git pull origin main

echo "[2/3] Installing dependencies and rebuilding..."
cd /home/ubuntu/AgriConnect/frontend
npm install
VITE_API_BASE_URL="$BACKEND_URL" npm run build

echo "[3/3] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "Done! Frontend updated."
