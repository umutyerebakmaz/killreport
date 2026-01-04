#!/bin/bash

# SSH Attack Analysis Script
# Analyzes auth.log for brute-force attempts

echo "=== SSH Attack Analysis Report ==="
echo "Generated: $(date)"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

LOG_FILE="/var/log/auth.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "Error: $LOG_FILE not found"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ATTACK STATISTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Total invalid user attempts
TOTAL_INVALID=$(grep "Invalid user" $LOG_FILE | wc -l)
echo "Total Invalid User Attempts: $TOTAL_INVALID"

# Total failed password attempts
TOTAL_FAILED=$(grep "Failed password" $LOG_FILE | wc -l)
echo "Total Failed Password Attempts: $TOTAL_FAILED"

# Unique attacking IPs
UNIQUE_IPS=$(grep -E "Invalid user|Failed password" $LOG_FILE | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | sort -u | wc -l)
echo "Unique Attacking IPs: $UNIQUE_IPS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 TOP 10 ATTACKING IPs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

grep -E "Invalid user|Failed password" $LOG_FILE | \
    grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | \
    sort | uniq -c | sort -rn | head -10 | \
    awk '{printf "%5d attempts - %s\n", $1, $2}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👤 TOP 20 TARGETED USERNAMES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

grep "Invalid user" $LOG_FILE | \
    awk '{print $8}' | \
    sort | uniq -c | sort -rn | head -20 | \
    awk '{printf "%5d attempts - %s\n", $1, $2}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌍 IP GEOLOCATION (Top 10)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOP_IPS=$(grep -E "Invalid user|Failed password" $LOG_FILE | \
    grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | \
    sort | uniq -c | sort -rn | head -10 | awk '{print $2}')

for IP in $TOP_IPS; do
    # Using ipinfo.io API (rate limited, use sparingly)
    INFO=$(curl -s "https://ipinfo.io/$IP/json" 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$INFO" ]; then
        COUNTRY=$(echo $INFO | grep -o '"country":"[^"]*"' | cut -d'"' -f4)
        CITY=$(echo $INFO | grep -o '"city":"[^"]*"' | cut -d'"' -f4)
        ORG=$(echo $INFO | grep -o '"org":"[^"]*"' | cut -d'"' -f4)
        echo "$IP → $CITY, $COUNTRY ($ORG)"
    else
        echo "$IP → Location lookup failed"
    fi
    sleep 0.5  # Rate limiting
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏰ ATTACK TIMELINE (Last 24 Hours)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get last 24 hours attacks by hour
grep "Invalid user" $LOG_FILE | \
    tail -1000 | \
    awk '{print $3}' | \
    cut -d':' -f1 | \
    sort | uniq -c | \
    awk '{printf "%02d:00 - %5d attempts\n", $2, $1}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  FAIL2BAN STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v fail2ban-client &> /dev/null; then
    echo "Fail2ban: INSTALLED"
    echo ""
    fail2ban-client status sshd 2>/dev/null || echo "Fail2ban not configured for SSH"
else
    echo "❌ Fail2ban: NOT INSTALLED"
    echo "⚠️  WARNING: Your server is vulnerable to brute-force attacks!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 CURRENT ACTIVE CONNECTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ss -tunap | grep ':22' | grep ESTAB || echo "No active SSH connections"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 RECOMMENDATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔴 CRITICAL - Immediate Actions:"
echo "   1. Run security hardening script: ./deployment/security-hardening.sh"
echo "   2. Change SSH port from 22 to 2222"
echo "   3. Disable root login"
echo "   4. Disable password authentication"
echo "   5. Install and configure Fail2ban"
echo ""
echo "🟡 RECOMMENDED - Additional Protection:"
echo "   1. Use SSH keys only (no passwords)"
echo "   2. Enable UFW firewall"
echo "   3. Set up automatic security updates"
echo "   4. Consider IP whitelisting if possible"
echo "   5. Monitor logs regularly"
echo ""
echo "🔗 See full security guide: deployment/SECURITY.md"
echo ""
