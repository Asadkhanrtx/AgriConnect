#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DEPLOY_DIR="/var/www/agriconnect"

echo "=============================================="
echo "  AgriConnect Frontend Update"
echo "  Project root : $PROJECT_ROOT"
echo "=============================================="

echo "[1/4] Pulling latest code..."
cd "$PROJECT_ROOT"
git pull origin main

echo "[2/4] Installing dependencies..."
cd "$FRONTEND_DIR"
npm install

echo "[3/4] Building React application..."
npm run build

echo "[4/4] Deploying to $DEPLOY_DIR..."
sudo mkdir -p "$DEPLOY_DIR"

if command -v rsync &>/dev/null; then
  sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$DEPLOY_DIR/"
else
  sudo cp -r "$FRONTEND_DIR/dist/." "$DEPLOY_DIR/"
fi

sudo chown -R www-data:www-data "$DEPLOY_DIR"
sudo find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
sudo find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;

echo "  Validating Nginx config..."
sudo nginx -t

echo "  Reloading Nginx (zero-downtime)..."
sudo systemctl reload nginx

echo ""
echo "Frontend updated successfully."
