#!/bin/bash
set -e

echo "=============================================="
echo "  AgriConnect Frontend Installer"
echo "=============================================="

# ── Collect required inputs ──────────────────────
if [ -z "$BACKEND_URL" ]; then
  read -rp "Enter the Backend ALB DNS or IP (e.g. http://agriconnect-alb-xxxx.us-east-1.elb.amazonaws.com): " BACKEND_URL
fi

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL is required."
  exit 1
fi

# Strip trailing slash
BACKEND_URL="${BACKEND_URL%/}"

echo ""
echo "Backend URL: $BACKEND_URL"
echo ""

# ── 1. Node.js & Nginx ───────────────────────────
echo "[1/5] Installing Node.js 20.x and Nginx..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# ── 2. Dependencies ──────────────────────────────
echo "[2/5] Installing frontend dependencies..."
cd /home/ubuntu/AgriConnect/frontend
npm install

# ── 3. Build ─────────────────────────────────────
echo "[3/5] Building React application..."
# VITE_API_BASE_URL is used by vite.config.js for the production proxy base
VITE_API_BASE_URL="$BACKEND_URL" npm run build

# ── 4. Nginx configuration ───────────────────────
echo "[4/5] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/agriconnect > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    root /home/ubuntu/AgriConnect/frontend/dist;
    index index.html;

    # Serve the React SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy all /api/* calls to the backend ALB
    location /api/ {
        proxy_pass ${BACKEND_URL}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
EOF

sudo ln -sf /etc/nginx/sites-available/agriconnect /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── 5. Verify ────────────────────────────────────
echo "[5/5] Verifying..."
sudo systemctl status nginx --no-pager | head -5

echo ""
echo "=============================================="
echo "  Frontend Installation Complete!"
echo "  Open http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}') in your browser."
echo "=============================================="
