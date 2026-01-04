#!/bin/bash

# RabbitMQ Complete Reinstall Script for DigitalOcean Droplet
# This script completely removes RabbitMQ and installs it fresh with reverse proxy support

set -e  # Exit on error

echo "=================================================="
echo "RabbitMQ Complete Reinstall Script"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ask for confirmation
echo -e "${YELLOW}WARNING: This will completely remove RabbitMQ and all its data!${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "=== Step 1: Stopping RabbitMQ ==="
sudo systemctl stop rabbitmq-server || true
sudo systemctl disable rabbitmq-server || true
echo -e "${GREEN}✓ RabbitMQ stopped${NC}"

echo ""
echo "=== Step 2: Removing RabbitMQ packages ==="
sudo apt-get remove --purge -y rabbitmq-server || true
sudo apt-get autoremove -y
echo -e "${GREEN}✓ Packages removed${NC}"

echo ""
echo "=== Step 3: Cleaning up config and data files ==="
sudo rm -rf /etc/rabbitmq/
sudo rm -rf /var/lib/rabbitmq/
sudo rm -rf /var/log/rabbitmq/
sudo rm -rf /usr/lib/rabbitmq/
echo -e "${GREEN}✓ Config and data cleaned${NC}"

echo ""
echo "=== Step 4: Updating package list ==="
sudo apt-get update
echo -e "${GREEN}✓ Package list updated${NC}"

echo ""
echo "=== Step 5: Installing RabbitMQ ==="

# Install prerequisites
sudo apt-get install -y curl gnupg apt-transport-https

# Add RabbitMQ repository
curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | sudo gpg --dearmor | sudo tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null

# Add RabbitMQ APT repository
sudo tee /etc/apt/sources.list.d/rabbitmq.list > /dev/null <<EOF
## Provides modern Erlang/OTP releases
deb [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-erlang/deb/ubuntu jammy main
deb-src [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-erlang/deb/ubuntu jammy main

## Provides RabbitMQ
deb [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-server/deb/ubuntu jammy main
deb-src [signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://ppa1.novemberain.com/rabbitmq/rabbitmq-server/deb/ubuntu jammy main
EOF

# Update and install
sudo apt-get update -y
sudo apt-get install -y erlang-base \
                        erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
                        erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
                        erlang-runtime-tools erlang-snmp erlang-ssl \
                        erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl

sudo apt-get install -y rabbitmq-server

echo -e "${GREEN}✓ RabbitMQ installed${NC}"

echo ""
echo "=== Step 6: Configuring RabbitMQ for reverse proxy ==="

# Create config directory
sudo mkdir -p /etc/rabbitmq/

# Create rabbitmq.conf with reverse proxy support
sudo tee /etc/rabbitmq/rabbitmq.conf > /dev/null <<EOF
# Basic configuration
loopback_users.guest = false

# Management plugin configuration
management.tcp.port = 15672
management.tcp.ip = 127.0.0.1

# CRITICAL: Path prefix for reverse proxy
management.path_prefix = /rabbitmq

# Logging
log.file.level = info
log.console = true
log.console.level = info
EOF

# Set correct permissions
sudo chown rabbitmq:rabbitmq /etc/rabbitmq/rabbitmq.conf
sudo chmod 644 /etc/rabbitmq/rabbitmq.conf

echo -e "${GREEN}✓ Configuration created${NC}"

echo ""
echo "=== Step 7: Starting RabbitMQ ==="
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server

# Wait for RabbitMQ to start
sleep 5

echo -e "${GREEN}✓ RabbitMQ started${NC}"

echo ""
echo "=== Step 8: Enabling management plugin ==="
sudo rabbitmq-plugins enable rabbitmq_management
echo -e "${GREEN}✓ Management plugin enabled${NC}"

echo ""
echo "=== Step 9: Creating admin user ==="
read -p "Enter admin username (default: admin): " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -sp "Enter admin password (default: auto-generated): " ADMIN_PASS
echo ""
if [ -z "$ADMIN_PASS" ]; then
    ADMIN_PASS=$(openssl rand -base64 16)
    echo "Generated password: $ADMIN_PASS"
fi

# Create user
sudo rabbitmqctl add_user "$ADMIN_USER" "$ADMIN_PASS" || true
sudo rabbitmqctl set_user_tags "$ADMIN_USER" administrator
sudo rabbitmqctl set_permissions -p / "$ADMIN_USER" ".*" ".*" ".*"

# Optionally disable guest user for security
read -p "Disable guest user? (yes/no, default: yes): " DISABLE_GUEST
DISABLE_GUEST=${DISABLE_GUEST:-yes}
if [ "$DISABLE_GUEST" = "yes" ]; then
    sudo rabbitmqctl delete_user guest || true
    echo -e "${GREEN}✓ Guest user disabled${NC}"
fi

echo -e "${GREEN}✓ Admin user created${NC}"

echo ""
echo "=== Step 10: Restarting RabbitMQ ==="
sudo systemctl restart rabbitmq-server
sleep 5
echo -e "${GREEN}✓ RabbitMQ restarted${NC}"

echo ""
echo "=== Step 11: Verifying installation ==="

# Check service status
if sudo systemctl is-active --quiet rabbitmq-server; then
    echo -e "${GREEN}✓ RabbitMQ service is running${NC}"
else
    echo -e "${RED}✗ RabbitMQ service is NOT running${NC}"
    exit 1
fi

# Check management plugin
if curl -s -u "$ADMIN_USER:$ADMIN_PASS" http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Management API is accessible${NC}"
else
    echo -e "${RED}✗ Management API is NOT accessible${NC}"
    exit 1
fi

# Check RabbitMQ version
VERSION=$(sudo rabbitmqctl version 2>/dev/null)
echo -e "${GREEN}✓ RabbitMQ version: $VERSION${NC}"

echo ""
echo "=== Step 12: Testing reverse proxy ==="

# Restart Nginx to ensure config is loaded
sudo systemctl restart nginx

sleep 2

# Test reverse proxy
if curl -s -u "$ADMIN_USER:$ADMIN_PASS" https://api.killreport.com/rabbitmq/api/overview > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Reverse proxy is working${NC}"
else
    echo -e "${YELLOW}⚠ Reverse proxy test failed (might be normal if SSL not configured yet)${NC}"
fi

echo ""
echo "=================================================="
echo "Installation Complete!"
echo "=================================================="
echo ""
echo "RabbitMQ Management UI: https://api.killreport.com/rabbitmq/"
echo "Username: $ADMIN_USER"
echo "Password: $ADMIN_PASS"
echo ""
echo "IMPORTANT: Save these credentials securely!"
echo ""
echo "Configuration file: /etc/rabbitmq/rabbitmq.conf"
echo "Logs: /var/log/rabbitmq/"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status rabbitmq-server    # Check status"
echo "  sudo rabbitmqctl list_queues             # List queues"
echo "  sudo rabbitmqctl list_users              # List users"
echo "  sudo journalctl -u rabbitmq-server -f    # View logs"
echo ""
echo "Next steps:"
echo "  1. Open https://api.killreport.com/rabbitmq/ in browser"
echo "  2. Login with credentials above"
echo "  3. Test queue operations (click on a queue, try delete/purge)"
echo "  4. Clear browser cache if needed (Ctrl+Shift+Delete)"
echo ""
