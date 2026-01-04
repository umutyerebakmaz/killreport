#!/bin/bash

# DigitalOcean Droplet Security Hardening Script
# Run this script as root on a fresh Ubuntu 22.04 droplet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== KillReport Droplet Security Hardening ===${NC}\n"

# Configuration
NEW_SSH_PORT=2222
ADMIN_USER="killreport"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will:${NC}"
echo "1. Change SSH port from 22 to $NEW_SSH_PORT"
echo "2. Disable root SSH login"
echo "3. Create admin user: $ADMIN_USER"
echo "4. Setup SSH key-based authentication"
echo "5. Install and configure UFW firewall"
echo "6. Install and configure Fail2ban"
echo "7. Enable automatic security updates"
echo "8. Configure SSH timeout settings"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. System Update
echo -e "\n${GREEN}[1/8] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# 2. Create Admin User
echo -e "\n${GREEN}[2/8] Creating admin user: $ADMIN_USER${NC}"
if id "$ADMIN_USER" &>/dev/null; then
    echo "User $ADMIN_USER already exists"
else
    adduser --disabled-password --gecos "" $ADMIN_USER
    usermod -aG sudo $ADMIN_USER
    echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$ADMIN_USER

    # Setup SSH directory
    mkdir -p /home/$ADMIN_USER/.ssh
    chmod 700 /home/$ADMIN_USER/.ssh

    # Copy root's authorized_keys if exists
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/$ADMIN_USER/.ssh/
        chown -R $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh
        chmod 600 /home/$ADMIN_USER/.ssh/authorized_keys
        echo "Copied SSH keys from root to $ADMIN_USER"
    else
        echo -e "${YELLOW}WARNING: No SSH keys found in /root/.ssh/authorized_keys${NC}"
        echo "Please add your public key to /home/$ADMIN_USER/.ssh/authorized_keys manually"
    fi
fi

# 3. Configure SSH
echo -e "\n${GREEN}[3/8] Configuring SSH...${NC}"

# Backup original SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)

# Configure SSH settings
cat > /etc/ssh/sshd_config.d/99-security-hardening.conf << EOF
# Security Hardening Configuration
Port $NEW_SSH_PORT
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
MaxSessions 10
Protocol 2
EOF

echo "SSH will now listen on port $NEW_SSH_PORT"
echo "Root login has been disabled"
echo "Password authentication has been disabled"

# 4. Install and Configure UFW
echo -e "\n${GREEN}[4/8] Installing and configuring UFW firewall...${NC}"
apt-get install -y ufw

# Reset UFW to default
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH on new port
ufw allow $NEW_SSH_PORT/tcp comment 'SSH'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow backend API (if accessed directly)
ufw allow 4000/tcp comment 'Backend API'

# Allow frontend (if accessed directly)
ufw allow 3000/tcp comment 'Frontend'

# Enable UFW
ufw --force enable

echo "UFW firewall configured and enabled"

# 5. Install and Configure Fail2ban
echo -e "\n${GREEN}[5/8] Installing and configuring Fail2ban...${NC}"
apt-get install -y fail2ban

# Configure Fail2ban for SSH
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = $NEW_SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo "Fail2ban configured and enabled"

# 6. Configure Automatic Security Updates
echo -e "\n${GREEN}[6/8] Configuring automatic security updates...${NC}"
apt-get install -y unattended-upgrades apt-listchanges

cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "Automatic security updates enabled"

# 7. Additional Security Settings
echo -e "\n${GREEN}[7/8] Applying additional security settings...${NC}"

# Disable IPv6 if not needed
echo "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf
echo "net.ipv6.conf.default.disable_ipv6 = 1" >> /etc/sysctl.conf
echo "net.ipv6.conf.lo.disable_ipv6 = 1" >> /etc/sysctl.conf

# Kernel hardening
cat >> /etc/sysctl.conf << EOF

# Security hardening
net.ipv4.conf.default.rp_filter=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.tcp_syncookies=1
net.ipv4.conf.all.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.all.accept_source_route=0
net.ipv6.conf.all.accept_source_route=0
net.ipv4.conf.all.log_martians=1
EOF

sysctl -p

# 8. Install monitoring tools
echo -e "\n${GREEN}[8/8] Installing monitoring tools...${NC}"
apt-get install -y htop iotop nethogs ncdu

# Restart SSH service
echo -e "\n${YELLOW}Restarting SSH service...${NC}"
systemctl restart sshd

# Summary
echo -e "\n${GREEN}=== Security Hardening Complete ===${NC}\n"
echo -e "${YELLOW}IMPORTANT NOTES:${NC}"
echo "1. SSH port changed to: $NEW_SSH_PORT"
echo "2. Admin user created: $ADMIN_USER"
echo "3. Root login disabled"
echo "4. Password authentication disabled"
echo "5. UFW firewall enabled"
echo "6. Fail2ban protection active"
echo "7. Automatic security updates enabled"
echo ""
echo -e "${RED}CRITICAL: Test SSH connection before closing this session!${NC}"
echo ""
echo "To test, open a NEW terminal and run:"
echo -e "${GREEN}ssh -p $NEW_SSH_PORT $ADMIN_USER@YOUR_DROPLET_IP${NC}"
echo ""
echo "UFW Status:"
ufw status numbered
echo ""
echo "Fail2ban Status:"
fail2ban-client status sshd
echo ""
echo -e "${YELLOW}Keep this terminal open until you confirm the new connection works!${NC}"
