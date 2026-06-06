#!/bin/bash
set -e

echo "=============================================="
echo "  AgriConnect Backend Installer"
echo "=============================================="

# ── Collect required inputs ──────────────────────
if [ -z "$AWS_REGION" ]; then
  read -rp "Enter your AWS Region (e.g. us-east-1): " AWS_REGION
fi
if [ -z "$AWS_REGION" ]; then
  echo "ERROR: AWS_REGION is required."
  exit 1
fi

export AWS_REGION

echo ""
echo "AWS Region: $AWS_REGION"
echo ""

# ── 1. System packages ───────────────────────────
echo "[1/6] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y curl git

# ── 2. Node.js ───────────────────────────────────
echo "[2/6] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 3. PM2 ──────────────────────────────────────
echo "[3/6] Installing PM2..."
sudo npm install pm2@latest -g

# ── 4. Dependencies ──────────────────────────────
echo "[4/6] Installing service dependencies..."

cd /home/ubuntu/AgriConnect/shared
npm install

SERVICES=("auth-service" "marketplace-service" "order-service" "media-service" "notification-service")
for service in "${SERVICES[@]}"; do
  echo "  → $service"
  cd /home/ubuntu/AgriConnect/services/$service
  npm install
done

# ── 5. Database setup ────────────────────────────
echo "[5/6] Running database migrations and seeding..."
cd /home/ubuntu/AgriConnect/shared

AWS_REGION=$AWS_REGION node scripts/migrate.js
AWS_REGION=$AWS_REGION node scripts/seed.js

# ── 6. Start services with PM2 ───────────────────
echo "[6/6] Starting services with PM2..."

# Stop existing instances if any
pm2 delete all 2>/dev/null || true

for service in "${SERVICES[@]}"; do
  SERVICE_NAME="agriconnect-${service%-service}"
  # Special case: keep full name for notification-service clarity
  if [ "$service" = "notification-service" ]; then
    SERVICE_NAME="agriconnect-notif"
  fi
  cd /home/ubuntu/AgriConnect/services/$service
  AWS_REGION=$AWS_REGION pm2 start index.js --name "$SERVICE_NAME"
done

# Save PM2 process list and configure startup
pm2 save

# Generate and run the startup command
STARTUP_CMD=$(AWS_REGION=$AWS_REGION pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep "sudo env")
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD"
else
  sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
fi

echo ""
echo "=============================================="
echo "  Backend Installation Complete!"
echo ""
echo "  Service ports:"
echo "    Auth Service        → :3001"
echo "    Marketplace Service → :3002"
echo "    Order Service       → :3003"
echo "    Media Service       → :3004"
echo "    Notification Service→ :3005"
echo ""
echo "  Check status: pm2 status"
echo "  View logs:    pm2 logs"
echo "  Health check: curl http://localhost:3001/health"
echo "=============================================="
