#!/bin/bash
exec > /var/log/userdata.log 2>&1

echo "========================================================"
echo "  AgriConnect Frontend — Automated Bootstrap"
echo "========================================================"

# ── 1. System packages ────────────────────────────────────────
apt-get update -y
apt-get install -y git curl nginx

# ── 2. Clone repo ─────────────────────────────────────────────
git clone ${github_repo_url} /home/ubuntu/AgriConnect
chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect

# ── 3. Write FarmBot env for Vite build ──────────────────────
cat > /home/ubuntu/AgriConnect/frontend/.env.production <<ENVCONF
VITE_FARMBOT_API_URL=${farmbot_api_url}
ENVCONF
chown ubuntu:ubuntu /home/ubuntu/AgriConnect/frontend/.env.production

# ── 4. Start nginx early (install script configures it) ──────
systemctl enable nginx
systemctl start nginx

# ── 5. Write and run install script as ubuntu ─────────────────
cat > /tmp/run-frontend-install.sh <<'RUNSCRIPT'
#!/bin/bash
set -e
bash /home/ubuntu/AgriConnect/scripts/frontend-install.sh
RUNSCRIPT
chmod +x /tmp/run-frontend-install.sh
chown ubuntu:ubuntu /tmp/run-frontend-install.sh

su - ubuntu -c "bash /tmp/run-frontend-install.sh"

echo "========================================================"
echo "  Bootstrap complete — Nginx serving React on port 80"
echo "========================================================"
