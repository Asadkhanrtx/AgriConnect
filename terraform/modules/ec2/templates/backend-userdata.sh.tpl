#!/bin/bash
set -e
exec > /var/log/backend-init.log 2>&1

echo "=== AgriConnect Backend UserData: $(date) ==="

# ── Environment variables ─────────────────────────────────────────────────────
export AWS_REGION="${aws_region}"
export SNS_TOPIC_ARN="${sns_topic_arn}"
export EVENTS_TOPIC_ARN="${events_topic_arn}"
export NOTIFICATIONS_QUEUE_URL="${notifications_queue_url}"

# Persist so PM2 and future shells can source them
cat > /home/ubuntu/.agriconnect-config <<'ENVEOF'
export AWS_REGION="${aws_region}"
export SNS_TOPIC_ARN="${sns_topic_arn}"
export EVENTS_TOPIC_ARN="${events_topic_arn}"
export NOTIFICATIONS_QUEUE_URL="${notifications_queue_url}"
ENVEOF
chmod 600 /home/ubuntu/.agriconnect-config
echo 'source /home/ubuntu/.agriconnect-config' >> /home/ubuntu/.bashrc

# ── System packages ───────────────────────────────────────────────────────────
echo "[1/7] Installing system packages..."
apt-get update -y
apt-get install -y curl git unzip mysql-client

# AWS CLI v2
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

# ── Node.js 20 ────────────────────────────────────────────────────────────────
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── PM2 ──────────────────────────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install pm2@latest -g

# ── Clone repository (retry 5×) ───────────────────────────────────────────────
echo "[4/7] Cloning AgriConnect repository..."
REPO_DIR="/home/ubuntu/AgriConnect"
for attempt in 1 2 3 4 5; do
  echo "  Clone attempt $attempt..."
  if git clone "${github_repo_url}" "$REPO_DIR"; then
    echo "  Clone succeeded."
    break
  fi
  [ "$attempt" -eq 5 ] && { echo "ERROR: git clone failed after 5 attempts"; exit 1; }
  sleep $((attempt * 5))
done
chown -R ubuntu:ubuntu "$REPO_DIR"

# ── Wait for RDS to be reachable ──────────────────────────────────────────────
echo "[5/7] Waiting for RDS endpoint..."
RDS_HOST="${rds_endpoint}"
for i in $(seq 1 30); do
  if mysql -h "$RDS_HOST" -u admin -pSixninesixtynine --connect-timeout=5 -e "SELECT 1;" > /dev/null 2>&1; then
    echo "  RDS is reachable."
    break
  fi
  echo "  Attempt $i/30 — RDS not ready yet, waiting 10s..."
  [ "$i" -eq 30 ] && { echo "ERROR: RDS not reachable after 300s"; exit 1; }
  sleep 10
done

# ── Install dependencies (retry 3×) ──────────────────────────────────────────
echo "[6/7] Installing npm dependencies..."
install_npm() {
  local dir=$1
  for attempt in 1 2 3; do
    echo "  npm install in $dir (attempt $attempt)..."
    cd "$dir" && npm install && return 0
    sleep $((attempt * 10))
  done
  echo "ERROR: npm install failed in $dir"; exit 1
}

install_npm "$REPO_DIR/shared"
for svc in auth-service marketplace-service order-service media-service notification-service; do
  install_npm "$REPO_DIR/services/$svc"
done

# ── Database migration & seed ──────────────────────────────────────────────────
echo "[7/7] Running migrations and seed..."
cd "$REPO_DIR/shared"
AWS_REGION=$AWS_REGION node scripts/migrate.js
AWS_REGION=$AWS_REGION node scripts/seed.js

# ── Start services with PM2 ───────────────────────────────────────────────────
echo "Starting PM2 services..."
pm2 delete all 2>/dev/null || true

cd "$REPO_DIR/services/auth-service"
AWS_REGION=$AWS_REGION pm2 start index.js --name agriconnect-auth

cd "$REPO_DIR/services/marketplace-service"
AWS_REGION=$AWS_REGION EVENTS_TOPIC_ARN=$EVENTS_TOPIC_ARN pm2 start index.js --name agriconnect-market

cd "$REPO_DIR/services/order-service"
AWS_REGION=$AWS_REGION SNS_TOPIC_ARN=$SNS_TOPIC_ARN EVENTS_TOPIC_ARN=$EVENTS_TOPIC_ARN pm2 start index.js --name agriconnect-order

cd "$REPO_DIR/services/media-service"
AWS_REGION=$AWS_REGION pm2 start index.js --name agriconnect-media

cd "$REPO_DIR/services/notification-service"
AWS_REGION=$AWS_REGION NOTIFICATIONS_QUEUE_URL=$NOTIFICATIONS_QUEUE_URL pm2 start index.js --name agriconnect-notif

pm2 save

# Configure PM2 to start on boot
PM2_STARTUP=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep "^sudo ")
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP"
fi

echo "=== Backend init complete: $(date) ==="
pm2 status
