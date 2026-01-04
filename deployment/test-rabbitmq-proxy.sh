#!/bin/bash

# RabbitMQ Reverse Proxy Test Script
# Bu script RabbitMQ'nun reverse proxy arkasında düzgün çalışıp çalışmadığını test eder

echo "=== RabbitMQ Reverse Proxy Test ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# RabbitMQ credentials (change if needed)
RABBITMQ_USER="${RABBITMQ_USER:-guest}"
RABBITMQ_PASS="${RABBITMQ_PASS:-guest}"
BASE_URL="https://api.killreport.com"

echo "Testing with user: $RABBITMQ_USER"
echo ""

# Test 1: Direct local access
echo "Test 1: Direct local access (localhost:15672)"
if curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASS" http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RabbitMQ API accessible locally${NC}"
else
    echo -e "${RED}✗ RabbitMQ API NOT accessible locally${NC}"
    echo "  Run: sudo systemctl status rabbitmq-server"
fi
echo ""

# Test 2: Nginx proxy access
echo "Test 2: Nginx reverse proxy ($BASE_URL/rabbitmq/api/overview)"
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$RABBITMQ_USER:$RABBITMQ_PASS" "$BASE_URL/rabbitmq/api/overview" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Reverse proxy working (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Reverse proxy NOT working (HTTP $HTTP_CODE)${NC}"
    if [ "$HTTP_CODE" = "404" ]; then
        echo -e "  ${YELLOW}Hint: Check management.path_prefix in /etc/rabbitmq/rabbitmq.conf${NC}"
    fi
fi
echo ""

# Test 3: Check if path_prefix is configured
echo "Test 3: Checking RabbitMQ path_prefix configuration"
if sudo grep -q "management.path_prefix.*rabbitmq" /etc/rabbitmq/rabbitmq.conf 2>/dev/null; then
    echo -e "${GREEN}✓ path_prefix configured in rabbitmq.conf${NC}"
    sudo grep "management.path_prefix" /etc/rabbitmq/rabbitmq.conf
elif sudo grep -q "path_prefix" /etc/rabbitmq/rabbitmq.config 2>/dev/null; then
    echo -e "${GREEN}✓ path_prefix configured in rabbitmq.config${NC}"
    sudo grep "path_prefix" /etc/rabbitmq/rabbitmq.config
else
    echo -e "${RED}✗ path_prefix NOT configured${NC}"
    echo -e "  ${YELLOW}Add to /etc/rabbitmq/rabbitmq.conf:${NC}"
    echo -e "  ${YELLOW}management.path_prefix = /rabbitmq${NC}"
fi
echo ""

# Test 4: Check Nginx config
echo "Test 4: Checking Nginx X-Forwarded-Prefix header"
if sudo grep -q "X-Forwarded-Prefix /rabbitmq" /etc/nginx/sites-available/killreport-backend 2>/dev/null; then
    echo -e "${GREEN}✓ X-Forwarded-Prefix header configured in Nginx${NC}"
else
    echo -e "${YELLOW}⚠ X-Forwarded-Prefix header might be missing${NC}"
    echo -e "  Add to Nginx: proxy_set_header X-Forwarded-Prefix /rabbitmq;"
fi
echo ""

# Test 5: Try to fetch queues list
echo "Test 5: Fetching queues list via API"
QUEUES_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$RABBITMQ_USER:$RABBITMQ_PASS" "$BASE_URL/rabbitmq/api/queues" 2>&1)
QUEUES_HTTP_CODE=$(echo "$QUEUES_RESPONSE" | tail -n1)

if [ "$QUEUES_HTTP_CODE" = "200" ]; then
    QUEUE_COUNT=$(echo "$QUEUES_RESPONSE" | sed '$d' | grep -o '"name"' | wc -l)
    echo -e "${GREEN}✓ Queues API working (found $QUEUE_COUNT queues)${NC}"
else
    echo -e "${RED}✗ Queues API failed (HTTP $QUEUES_HTTP_CODE)${NC}"
fi
echo ""

# Test 6: Check RabbitMQ version
echo "Test 6: RabbitMQ version"
VERSION=$(sudo rabbitmqctl version 2>/dev/null | head -n1)
if [ -n "$VERSION" ]; then
    echo -e "${GREEN}✓ RabbitMQ version: $VERSION${NC}"

    # Parse major.minor version
    MAJOR=$(echo "$VERSION" | cut -d. -f1)
    MINOR=$(echo "$VERSION" | cut -d. -f2)

    if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 9 ]; then
        echo "  Use rabbitmq.conf format (modern)"
    else
        echo -e "  ${YELLOW}Consider upgrading to 3.9+ for better reverse proxy support${NC}"
    fi
else
    echo -e "${RED}✗ Could not determine RabbitMQ version${NC}"
fi
echo ""

# Summary
echo "=== Summary ==="
if [ "$HTTP_CODE" = "200" ] && [ "$QUEUES_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}All tests passed! RabbitMQ reverse proxy is working correctly.${NC}"
    echo ""
    echo "You should now be able to:"
    echo "  1. Access UI: $BASE_URL/rabbitmq/"
    echo "  2. Click on queues and see details"
    echo "  3. Use management actions (purge, delete, etc.)"
else
    echo -e "${RED}Some tests failed. Please check the errors above.${NC}"
    echo ""
    echo "Quick fix steps:"
    echo "  1. sudo nano /etc/rabbitmq/rabbitmq.conf"
    echo "  2. Add: management.path_prefix = /rabbitmq"
    echo "  3. sudo systemctl restart rabbitmq-server"
    echo "  4. Clear browser cache and try again"
fi
