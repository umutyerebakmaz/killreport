#!/bin/bash

# Security Configuration Verification Script
# Verifies that all security hardening changes are active

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   KillReport Security Configuration Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Check function
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC} - $2"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - $2"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 1. SSH Port Check
echo -e "\n${YELLOW}[1] SSH Port Configuration${NC}"
SSH_PORT=$(grep "^Port" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -1 | awk '{print $2}')
if [ "$SSH_PORT" = "2222" ]; then
    check_status 0 "SSH Port changed to 2222"
else
    check_status 1 "SSH Port is still $SSH_PORT (should be 2222)"
fi

# 2. Root Login Check
echo -e "\n${YELLOW}[2] Root Login Protection${NC}"
ROOT_LOGIN=$(grep "^PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -1 | awk '{print $2}')
if [ "$ROOT_LOGIN" = "no" ]; then
    check_status 0 "Root login disabled"
else
    check_status 1 "Root login is still enabled: $ROOT_LOGIN"
fi

# 3. Password Authentication Check
echo -e "\n${YELLOW}[3] Password Authentication${NC}"
PASS_AUTH=$(grep "^PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -1 | awk '{print $2}')
if [ "$PASS_AUTH" = "no" ]; then
    check_status 0 "Password authentication disabled"
else
    check_status 1 "Password authentication is still enabled: $PASS_AUTH"
fi

# 4. SSH Service Check
echo -e "\n${YELLOW}[4] SSH Service Status${NC}"
if systemctl is-active --quiet sshd || systemctl is-active --quiet ssh; then
    check_status 0 "SSH service is running"
else
    check_status 1 "SSH service is not running"
fi

# 5. UFW Firewall Check
echo -e "\n${YELLOW}[5] UFW Firewall${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep -i "Status:" | awk '{print $2}')
    if [ "$UFW_STATUS" = "active" ]; then
        check_status 0 "UFW firewall is active"
        echo -e "${BLUE}   Allowed ports:${NC}"
        ufw status numbered | grep "ALLOW" | head -5
    else
        check_status 1 "UFW is installed but not active"
    fi
else
    check_status 1 "UFW is not installed"
fi

# 6. Fail2ban Check
echo -e "\n${YELLOW}[6] Fail2ban Protection${NC}"
if command -v fail2ban-client &> /dev/null; then
    if systemctl is-active --quiet fail2ban; then
        check_status 0 "Fail2ban is running"
        echo -e "${BLUE}   Status:${NC}"
        fail2ban-client status sshd 2>/dev/null || echo "   SSH jail not configured"
    else
        check_status 1 "Fail2ban is installed but not running"
    fi
else
    check_status 1 "Fail2ban is not installed"
fi

# 7. Admin User Check
echo -e "\n${YELLOW}[7] Admin User Configuration${NC}"
if id "killreport" &>/dev/null; then
    check_status 0 "Admin user 'killreport' exists"
    if groups killreport | grep -q sudo; then
        echo -e "${GREEN}   ✓${NC} User has sudo access"
    fi
    if [ -d "/home/killreport/.ssh" ]; then
        echo -e "${GREEN}   ✓${NC} SSH directory configured"
    fi
else
    check_status 1 "Admin user 'killreport' not found"
fi

# 8. Automatic Updates Check
echo -e "\n${YELLOW}[8] Automatic Security Updates${NC}"
if [ -f "/etc/apt/apt.conf.d/50unattended-upgrades" ]; then
    if [ -f "/etc/apt/apt.conf.d/20auto-upgrades" ]; then
        check_status 0 "Automatic security updates configured"
    else
        check_status 1 "Unattended upgrades partial configuration"
    fi
else
    check_status 1 "Automatic updates not configured"
fi

# 9. Active SSH Connections
echo -e "\n${YELLOW}[9] Active SSH Connections${NC}"
ACTIVE_CONN=$(ss -tunap 2>/dev/null | grep -E ":(22|2222)" | grep ESTAB | wc -l)
echo -e "${BLUE}   Currently active connections: $ACTIVE_CONN${NC}"
ss -tunap 2>/dev/null | grep -E ":(22|2222)" | grep ESTAB || echo "   No active connections"

# 10. Recent Attack Attempts
echo -e "\n${YELLOW}[10] Recent Attack Attempts${NC}"
RECENT_ATTACKS=$(grep "Invalid user" /var/log/auth.log 2>/dev/null | tail -20 | wc -l)
if [ $RECENT_ATTACKS -gt 0 ]; then
    echo -e "${YELLOW}   Found $RECENT_ATTACKS recent attack attempts in logs${NC}"
    echo -e "${BLUE}   Last 5 attempts:${NC}"
    grep "Invalid user" /var/log/auth.log 2>/dev/null | tail -5 | awk '{print "   " $1, $2, $3, $9, $10, $11}'
else
    echo -e "${GREEN}   ✓ No recent attack attempts found${NC}"
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All security checks passed! Your droplet is properly hardened.${NC}"
else
    echo -e "\n${YELLOW}⚠️  Some checks failed. Review the results above.${NC}"
fi

# Important reminders
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}IMPORTANT REMINDERS:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}1. New SSH connection command:${NC}"
echo -e "   ssh -p 2222 killreport@YOUR_DROPLET_IP"
echo ""
echo -e "${GREEN}2. Update your ~/.ssh/config:${NC}"
cat << 'EOF'
   Host killreport
       HostName YOUR_DROPLET_IP
       Port 2222
       User killreport
       IdentityFile ~/.ssh/id_ed25519
EOF
echo ""
echo -e "${GREEN}3. Monitor security:${NC}"
echo -e "   sudo fail2ban-client status sshd"
echo -e "   sudo ufw status"
echo -e "   sudo tail -f /var/log/auth.log"
echo ""
echo -e "${YELLOW}4. Don't close this terminal until you verify the new connection works!${NC}"
echo ""
