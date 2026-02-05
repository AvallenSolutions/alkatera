#!/bin/bash
# ============================================================
# OpenLCA VPS Setup Script for Infomaniak
# Run this on a fresh Ubuntu 22.04 VPS
# ============================================================

set -euo pipefail

echo "=========================================="
echo "OpenLCA Server Setup for Alkatera"
echo "=========================================="

# 1. System updates
echo ""
echo "[1/7] Updating system..."
apt update && apt upgrade -y

# 2. Install Docker
echo ""
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "  Docker installed successfully"
else
    echo "  Docker already installed"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

# 3. Install Certbot for Let's Encrypt
echo ""
echo "[3/7] Installing Certbot..."
apt install -y certbot
echo "  Certbot installed"

# 4. Create directory structure
echo ""
echo "[4/7] Creating directory structure..."
mkdir -p /opt/openlca/data/databases
mkdir -p /var/www/certbot
echo "  Directories created at /opt/openlca/"

# 5. Set up firewall
echo ""
echo "[5/7] Configuring firewall..."
apt install -y ufw
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (certbot + redirect)
ufw allow 443/tcp  # HTTPS
ufw deny 8080/tcp  # Block direct OpenLCA access
echo "y" | ufw enable
echo "  Firewall configured (ports 22, 80, 443 open; 8080 blocked)"

# 6. Generate TLS certificate
echo ""
echo "[6/7] TLS Certificate Setup"
echo "  Before generating the certificate, ensure DNS is configured:"
echo "  openlca.alkatera.com -> $(curl -s ifconfig.me)"
echo ""
read -p "  Is DNS configured and propagated? (y/n): " dns_ready

if [ "$dns_ready" = "y" ]; then
    certbot certonly --standalone -d openlca.alkatera.com
    # Set up auto-renewal
    (crontab -l 2>/dev/null; echo "0 0 1 * * certbot renew --quiet --pre-hook 'docker compose -f /opt/openlca/docker-compose.yml stop nginx' --post-hook 'docker compose -f /opt/openlca/docker-compose.yml start nginx'") | crontab -
    echo "  TLS certificate generated and auto-renewal configured"
else
    echo "  Skipping TLS setup - run 'certbot certonly --standalone -d openlca.alkatera.com' when DNS is ready"
fi

# 7. Generate API key
echo ""
echo "[7/7] Generating API key..."
API_KEY=$(openssl rand -hex 32)
echo ""
echo "=========================================="
echo "  SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Generated API Key (save this securely):"
echo "  $API_KEY"
echo ""
echo "Next steps:"
echo "  1. Upload your ecoinvent .zolca file to the VPS:"
echo "     scp ecoinvent_312_cutoff.zolca root@<vps-ip>:/opt/openlca/data/databases/"
echo ""
echo "  2. Unzip the database:"
echo "     cd /opt/openlca/data/databases"
echo "     unzip ecoinvent_312_cutoff.zolca -d ecoinvent_312_cutoff"
echo ""
echo "  3. Copy Docker files to /opt/openlca/:"
echo "     cp Dockerfile docker-compose.yml nginx.conf /opt/openlca/"
echo ""
echo "  4. Update the API key in nginx.conf:"
echo "     sed -i \"s/YOUR_API_KEY_HERE/$API_KEY/\" /opt/openlca/nginx.conf"
echo ""
echo "  5. Start the server:"
echo "     cd /opt/openlca && docker compose up -d"
echo ""
echo "  6. Verify:"
echo "     curl https://openlca.alkatera.com/api/version"
echo "     curl https://openlca.alkatera.com/data/processes -H 'X-API-Key: $API_KEY' | head -c 200"
echo ""
echo "  7. Set these in Vercel environment variables:"
echo "     OPENLCA_SERVER_URL=https://openlca.alkatera.com"
echo "     OPENLCA_SERVER_ENABLED=true"
echo "     OPENLCA_API_KEY=$API_KEY"
echo ""
