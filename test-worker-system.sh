#!/bin/bash

# ESI Worker System Test Script
# Bu script sistemi test eder ve örnek veri çeker

set -e

echo "🧪 ESI Worker System Test"
echo "=========================="
echo ""

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. PostgreSQL kontrolü
echo -e "${YELLOW}1. Checking PostgreSQL...${NC}"
if pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not ready${NC}"
    echo "Start PostgreSQL: sudo systemctl start postgresql"
    exit 1
fi
echo ""

# 2. RabbitMQ kontrolü
echo -e "${YELLOW}2. Checking RabbitMQ...${NC}"
if sudo rabbitmqctl status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RabbitMQ is ready${NC}"
    if curl -s http://localhost:15672 > /dev/null 2>&1; then
        echo "  Management UI: http://localhost:15672"
    fi
else
    echo -e "${RED}✗ RabbitMQ is not ready${NC}"
    echo "Start RabbitMQ: sudo systemctl start rabbitmq-server"
    exit 1
fi
echo ""

# 3. .env dosyası kontrolü
echo -e "${YELLOW}3. Checking .env file...${NC}"
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Create one from .env.example:"
    echo "  cp backend/.env.example backend/.env"
    echo "  nano backend/.env"
fi
echo ""

# 4. Test alliance queue
echo -e "${YELLOW}4. Testing alliance queue...${NC}"
cd backend

# Tek bir alliance ID'yi queue'ya ekle
echo "Queueing test alliance (ID: 99000006)..."
npm run orchestrator queue alliance 99000006 > /dev/null 2>&1

echo -e "${GREEN}✓ Test message queued${NC}"
echo ""

# 5. Queue durumunu göster
echo -e "${YELLOW}5. Queue status:${NC}"
npm run orchestrator status
echo ""

# 6. Talimatlar
echo -e "${GREEN}=========================="
echo "✓ System is ready!"
echo "==========================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Start worker (in a new terminal):"
echo "   cd backend && npm run worker:alliance"
echo ""
echo "2. Queue all alliances:"
echo "   cd backend && npm run orchestrator sync-alliances"
echo ""
echo "3. Monitor progress:"
echo "   cd backend && npm run orchestrator status"
echo ""
echo "4. Check database:"
echo "   cd backend && npm run prisma:studio"
echo ""
echo "Happy syncing! 🚀"
