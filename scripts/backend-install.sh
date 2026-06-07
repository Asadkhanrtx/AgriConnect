#!/bin/bash
set -e

# ── Detect project root from script location ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=============================================="
echo "  AgriConnect Backend Installer"
echo "  Project root: $PROJECT_ROOT"
echo "=============================================="

# ── Collect required inputs ────────────────────────────────────────────────────
if [ -z "$AWS_REGION" ]; then
  read -rp "Enter your AWS Region (e.g. ap-south-1): " AWS_REGION
fi
if [ -z "$AWS_REGION" ]; then
  echo "ERROR: AWS_REGION is required."
  exit 1
fi
export AWS_REGION
echo "  AWS Region: $AWS_REGION"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/6] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y curl git

# ── 2. Node.js ────────────────────────────────────────────────────────────────
echo "[2/6] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "  Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "  Node.js already installed: $(node --version)"
fi

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
echo "[3/6] Checking PM2..."
if ! command -v pm2 &>/dev/null; then
  echo "  Installing PM2..."
  sudo npm install pm2@latest -g
else
  echo "  PM2 already installed: $(pm2 --version)"
fi

# ── 4. Dependencies ───────────────────────────────────────────────────────────
echo "[4/6] Installing service dependencies..."

cd "$PROJECT_ROOT/shared"
npm install

SERVICES=("auth-service" "marketplace-service" "order-service" "media-service" "notification-service")
for service in "${SERVICES[@]}"; do
  echo "  → $service"
  cd "$PROJECT_ROOT/services/$service"
  npm install
done

# ── 5. Database setup ──────────────────────────────────────────────────────────
echo "[5/6] Running database migrations and seeding..."
cd "$PROJECT_ROOT/shared"

echo "  Running migrations..."
AWS_REGION=$AWS_REGION node scripts/migrate.js

echo "  Running seeders..."
AWS_REGION=$AWS_REGION node scripts/seed.js

# ── 6. Start services with PM2 ────────────────────────────────────────────────
echo "[6/6] Starting services with PM2..."

# Stop all existing instances cleanly before re-starting
pm2 delete all 2>/dev/null || true

declare -A SERVICE_NAMES=(
  ["auth-service"]="agriconnect-auth"
  ["marketplace-service"]="agriconnect-market"
  ["order-service"]="agriconnect-order"
  ["media-service"]="agriconnect-media"
  ["notification-service"]="agriconnect-notif"
)

for service in "${SERVICES[@]}"; do
  NAME="${SERVICE_NAMES[$service]}"
  echo "  Starting $NAME..."
  cd "$PROJECT_ROOT/services/$service"
  AWS_REGION=$AWS_REGION pm2 start index.js --name "$NAME"
done

# Persist process list so PM2 restores it on EC2 reboot
pm2 save

# Configure systemd startup (idempotent — safe to run multiple times)
echo "  Configuring PM2 systemd startup..."
STARTUP_OUT=$(AWS_REGION=$AWS_REGION pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1)
STARTUP_CMD=$(echo "$STARTUP_OUT" | grep -E "^sudo ")
if [ -n "$STARTUP_CMD" ]; then
  echo "  Running: $STARTUP_CMD"
  eval "$STARTUP_CMD"
else
  echo "  PM2 startup already configured or no command needed."
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Backend Installation Complete!"
echo ""
echo "  Service status:"
pm2 status
echo ""
echo "  Health checks:"
for port in 3001 3002 3003 3004 3005; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "ERR")
  echo "    :$port/health → HTTP $STATUS"
done
echo ""
echo "  Useful commands:"
echo "    pm2 status          — process list"
echo "    pm2 logs            — all logs"
echo "    pm2 restart all     — restart everything"
echo "=============================================="
