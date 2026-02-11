#!/bin/bash
# ============================================================
# Agribalyse gdt-server Setup (runs alongside existing ecoinvent)
# Run this on your existing Infomaniak VPS
# ============================================================

set -euo pipefail

echo "=========================================="
echo "Agribalyse OpenLCA Server Setup"
echo "=========================================="

# 1. Check existing ecoinvent server is running
echo ""
echo "[1/5] Checking existing ecoinvent server..."
if docker ps --format '{{.Names}}' | grep -q "openlca-server"; then
    echo "  ✓ ecoinvent gdt-server is running"
else
    echo "  ⚠ ecoinvent gdt-server not found (container: openlca-server)"
    echo "  This is fine — the Agribalyse server is independent."
fi

# Check available memory
TOTAL_MEM_MB=$(free -m | awk '/Mem:/ {print $2}')
echo "  Total VPS memory: ${TOTAL_MEM_MB}MB"
if [ "$TOTAL_MEM_MB" -lt 14000 ]; then
    echo ""
    echo "  ⚠ WARNING: Your VPS has ${TOTAL_MEM_MB}MB RAM."
    echo "  Running both servers needs ~14-16GB. Consider upgrading."
    read -p "  Continue anyway? (y/n): " continue_setup
    if [ "$continue_setup" != "y" ]; then
        echo "  Setup cancelled."
        exit 0
    fi
fi

# 2. Create directory structure
echo ""
echo "[2/5] Creating directory structure..."
mkdir -p /opt/openlca-agribalyse/data/databases
echo "  Created /opt/openlca-agribalyse/"

# 3. Generate TLS certificate for the Agribalyse subdomain
echo ""
echo "[3/5] TLS Certificate Setup"
VPS_IP=$(curl -s ifconfig.me)
echo "  Before continuing, add this DNS record:"
echo ""
echo "    openlca-agribalyse.alkatera.com  →  A  →  ${VPS_IP}"
echo ""
read -p "  Is the DNS record configured and propagated? (y/n): " dns_ready

if [ "$dns_ready" = "y" ]; then
    # Stop existing nginx temporarily for standalone cert generation
    echo "  Stopping existing nginx containers temporarily..."
    docker stop openlca-nginx 2>/dev/null || true
    docker stop openlca-agribalyse-nginx 2>/dev/null || true

    certbot certonly --standalone -d openlca-agribalyse.alkatera.com

    # Restart existing nginx
    docker start openlca-nginx 2>/dev/null || true

    # Update cert renewal cron to handle both servers
    (crontab -l 2>/dev/null | grep -v "certbot renew" ; echo "0 0 1 * * certbot renew --quiet --pre-hook 'docker stop openlca-nginx openlca-agribalyse-nginx 2>/dev/null || true' --post-hook 'docker start openlca-nginx openlca-agribalyse-nginx 2>/dev/null || true'") | crontab -
    echo "  ✓ TLS certificate generated and auto-renewal updated"
else
    echo "  Skipping TLS — run setup.sh again when DNS is ready."
    exit 0
fi

# 4. Generate API key
echo ""
echo "[4/5] Generating API key..."
API_KEY=$(openssl rand -hex 32)
echo "  ✓ API key generated"

# 5. Firewall — allow 8443 for the Agribalyse nginx
echo ""
echo "[5/5] Updating firewall..."
ufw allow 8443/tcp comment "Agribalyse OpenLCA HTTPS" 2>/dev/null || true
echo "  ✓ Port 8443 opened"

echo ""
echo "=========================================="
echo "  SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Generated API Key (save this securely):"
echo "  $API_KEY"
echo ""
echo "Next steps:"
echo ""
echo "  1. EXPORT the Agribalyse database from OpenLCA desktop:"
echo "     - Open OpenLCA desktop on your computer"
echo "     - Right-click the 'agribalyse_32' database"
echo "     - Select 'Export' → Save as .zolca file"
echo ""
echo "  2. UPLOAD the .zolca file to the VPS:"
echo "     scp agribalyse_32.zolca root@${VPS_IP}:/opt/openlca-agribalyse/data/databases/"
echo ""
echo "  3. UNZIP the database:"
echo "     cd /opt/openlca-agribalyse/data/databases"
echo "     unzip agribalyse_32.zolca -d agribalyse_32"
echo ""
echo "  4. COPY Docker files:"
echo "     cp Dockerfile docker-compose.yml nginx.conf /opt/openlca-agribalyse/"
echo ""
echo "  5. SET the API key in nginx.conf:"
echo "     sed -i \"s/YOUR_API_KEY_HERE/$API_KEY/\" /opt/openlca-agribalyse/nginx.conf"
echo ""
echo "  6. START the Agribalyse server:"
echo "     cd /opt/openlca-agribalyse && docker compose up -d --build"
echo ""
echo "  7. VERIFY it's working (wait ~2 minutes for startup):"
echo "     curl https://openlca-agribalyse.alkatera.com/api/version"
echo "     curl -H 'X-API-Key: $API_KEY' https://openlca-agribalyse.alkatera.com/data/processes | head -c 200"
echo ""
echo "  8. SET Netlify environment variables:"
echo "     OPENLCA_AGRIBALYSE_SERVER_URL=https://openlca-agribalyse.alkatera.com"
echo "     OPENLCA_AGRIBALYSE_API_KEY=$API_KEY"
echo ""
echo "  9. REDEPLOY your Netlify site and test:"
echo "     curl -X POST https://www.alkatera.com/api/openlca/test-connection \\"
echo "       -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       -H 'Content-Type: application/json'"
echo ""
