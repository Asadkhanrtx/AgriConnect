#!/bin/bash
set -e

# ── Detect project root from script location (works wherever repo is cloned) ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DEPLOY_DIR="/var/www/agriconnect"

echo "=============================================="
echo "  AgriConnect Frontend Installer"
echo "  Project root : $PROJECT_ROOT"
echo "  Deploy target: $DEPLOY_DIR"
echo "=============================================="
echo ""
echo "  Architecture: Single-ALB routing"
echo "    ALB /api/* → Backend services"
echo "    ALB /*     → This Nginx (React SPA)"
echo ""
echo "  No BACKEND_URL needed — the ALB handles"
echo "  routing. The React app uses relative API"
echo "  paths (/api/auth/...) which the ALB routes."
echo "=============================================="
echo ""

# ── 1. Node.js ────────────────────────────────────────────────────────────────
echo "[1/5] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "  Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "  Node.js already installed: $(node --version)"
fi

# ── 2. Nginx ──────────────────────────────────────────────────────────────────
echo "[2/5] Checking Nginx..."
if ! command -v nginx &>/dev/null; then
  echo "  Installing Nginx..."
  sudo apt-get install -y nginx
else
  echo "  Nginx already installed: $(nginx -v 2>&1)"
fi

# ── 3. Build React app ────────────────────────────────────────────────────────
echo "[3/5] Building React application..."
cd "$FRONTEND_DIR"
npm install
# No VITE_API_BASE_URL needed — all axios calls use relative paths (/api/...)
# which the ALB resolves to the correct backend service.
npm run build
echo "  Build complete: $FRONTEND_DIR/dist"

# ── 4. Deploy to /var/www/agriconnect ────────────────────────────────────────
echo "[4/5] Deploying static files to $DEPLOY_DIR..."
sudo mkdir -p "$DEPLOY_DIR"

# rsync ensures idempotent deploy (deletes stale files, skips unchanged ones)
if command -v rsync &>/dev/null; then
  sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$DEPLOY_DIR/"
else
  sudo cp -r "$FRONTEND_DIR/dist/." "$DEPLOY_DIR/"
fi

# www-data (nginx worker) must own and be able to read all files
sudo chown -R www-data:www-data "$DEPLOY_DIR"
sudo find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
sudo find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;
echo "  Files deployed and permissions set."

# ── 5. Nginx configuration ────────────────────────────────────────────────────
echo "[5/5] Configuring Nginx..."

# Write config using single-quoted heredoc so no shell expansion happens inside
sudo tee /etc/nginx/sites-available/agriconnect > /dev/null <<'NGINX_CONF'
server {
    listen 80;
    server_name _;

    root /var/www/agriconnect;
    index index.html;

    # React SPA — unknown paths fall back to index.html (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # NOTE: /api/* routing is handled by the ALB, NOT by this nginx.
    # The ALB listener rules forward:
    #   /api/auth/*          → auth-service      (port 3001)
    #   /api/marketplace/*   → marketplace-service (port 3002)
    #   /api/orders/*        → order-service     (port 3003)
    #   /api/media/*         → media-service     (port 3004)
    #   /api/notifications/* → notification-service (port 3005)
    #   /* (default)         → this nginx        (port 80)
    # Do NOT add a proxy_pass here for /api/.

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Cache static assets aggressively, never cache index.html
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/javascript image/svg+xml;
    gzip_min_length 1000;
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/agriconnect /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "  Validating Nginx config..."
if ! sudo nginx -t 2>&1; then
  echo "ERROR: Nginx config invalid. Aborting."
  exit 1
fi

sudo systemctl enable nginx
sudo systemctl restart nginx
echo "  Nginx started successfully."

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Frontend Installation Complete!"
echo ""
echo "  Static files: $DEPLOY_DIR"
echo "  Nginx:        port 80 (serving React SPA)"
echo ""
echo "  NEXT STEP: Add this EC2 to the ALB as the"
echo "  default (/*) target group so users access"
echo "  the app via the ALB DNS — not this IP."
echo ""
echo "  ALB DNS is your single public entry point."
echo "=============================================="
