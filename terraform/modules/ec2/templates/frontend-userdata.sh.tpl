#!/bin/bash
set -e
exec > /var/log/frontend-init.log 2>&1

echo "=== AgriConnect Frontend UserData: $(date) ==="

# ── System packages ───────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y curl git nginx

# ── Node.js 20 ────────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── Clone repository (retry 5×) ───────────────────────────────────────────────
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

# ── Install frontend dependencies ────────────────────────────────────────────
cd "$REPO_DIR/frontend"
for attempt in 1 2 3; do
  npm install && break
  sleep $((attempt * 10))
done

# Build will be triggered by frontend-install.sh after ALB is known.
# If ALB_DNS is set (future re-run), build now; otherwise skip build step.
if [ -n "${alb_dns_name}" ]; then
  REACT_APP_API_URL="http://${alb_dns_name}" npm run build
  echo "Frontend build complete."
else
  echo "NOTE: ALB DNS not set at boot time — run scripts/frontend-install.sh"
  echo "      after terraform apply completes to perform the React build."
fi

# Configure Nginx to serve from /home/ubuntu/AgriConnect/frontend/build
cat > /etc/nginx/sites-available/default <<'NGINX'
server {
    listen 80 default_server;
    root /home/ubuntu/AgriConnect/frontend/build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
systemctl restart nginx
systemctl enable nginx

echo "=== Frontend init complete: $(date) ==="
