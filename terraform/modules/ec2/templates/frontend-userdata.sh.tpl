#!/bin/bash
exec > /var/log/userdata.log 2>&1
set -e

echo "========================================================"
echo "  AgriConnect Frontend — Automated Bootstrap"
echo "========================================================"

# ── 1. System packages ────────────────────────────────────────
apt-get update -y
apt-get install -y git curl nginx

# ── 2. Clone repo ─────────────────────────────────────────────
git clone ${github_repo_url} /home/ubuntu/AgriConnect
chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect

# ── 3. Inject FarmBot API URL into Vite build env ────────────
# frontend-install.sh runs: npm run build
# Vite picks up .env.production automatically during build.
cat > /home/ubuntu/AgriConnect/frontend/.env.production <<ENVCONF
VITE_FARMBOT_API_URL=${farmbot_api_url}
ENVCONF
chown ubuntu:ubuntu /home/ubuntu/AgriConnect/frontend/.env.production

# ── 4. Start nginx early (install script will configure it) ──
systemctl enable nginx
systemctl start nginx

# ── 5. Run install script as ubuntu ──────────────────────────
su - ubuntu -c "bash /home/ubuntu/AgriConnect/scripts/frontend-install.sh"

echo "========================================================"
echo "  Bootstrap complete — Nginx serving React on port 80"
echo "========================================================"
