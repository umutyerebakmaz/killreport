#!/bin/bash

# EMERGENCY SSH FIX SCRIPT
# Run this immediately to restore SSH access

set -e

echo "🚨 EMERGENCY SSH FIX - Starting..."

# Detect SSH service name (Ubuntu uses 'ssh', CentOS uses 'sshd')
if systemctl list-units --type=service | grep -q 'ssh.service'; then
    SSH_SERVICE="ssh"
elif systemctl list-units --type=service | grep -q 'sshd.service'; then
    SSH_SERVICE="sshd"
else
    echo "ERROR: Cannot detect SSH service!"
    exit 1
fi

echo "Detected SSH service: $SSH_SERVICE"

# Backup current config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.emergency.backup

echo "Fixing SSH configuration..."

# Remove all Port directives and add Port 7777
sed -i '/^Port /d' /etc/ssh/sshd_config
sed -i '/^#Port /d' /etc/ssh/sshd_config
echo "Port 7777" >> /etc/ssh/sshd_config

# Allow root login temporarily
sed -i 's/^PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config

# Allow password authentication temporarily
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Test config
echo "Testing SSH configuration..."
sshd -t
if [ $? -ne 0 ]; then
    echo "ERROR: SSH config has syntax errors!"
    echo "Restoring backup..."
    cp /etc/ssh/sshd_config.emergency.backup /etc/ssh/sshd_config
    exit 1
fi

echo "Config is valid. Restarting SSH..."

# Enable and restart SSH
systemctl enable $SSH_SERVICE
systemctl restart $SSH_SERVICE

sleep 2

# Verify SSH is running
if systemctl is-active --quiet $SSH_SERVICE; then
    echo "✅ SSH service is RUNNING"
else
    echo "❌ SSH service FAILED to start!"
    systemctl status $SSH_SERVICE
    exit 1
fi

# Check listening port
LISTENING=$(ss -tlnp | grep sshd | head -1)
echo "SSH listening: $LISTENING"

# Configure firewall
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw --force enable
    ufw allow 7777/tcp
    ufw allow 22/tcp
    ufw reload
    echo "✅ Firewall configured"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SSH FIX COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Try connecting from NEW terminal:"
echo "  ssh -p 7777 root@188.166.49.7"
echo ""
echo "Or if port 22 works:"
echo "  ssh root@188.166.49.7"
echo ""
echo "⚠️  KEEP THIS TERMINAL OPEN!"
echo ""
