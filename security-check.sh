#!/bin/bash

# KillReport Security Check Script
# Searches for potential credentials in git history and current files

set -e

echo "🔍 KillReport Security Audit"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Known exposed credentials (for git history check)
# Priority levels: HIGH = production risk, LOW = localhost only
CREDENTIALS=(
  "YOUR_DB_PASSWORD:HIGH:Database Password"
  "YOUR_EVE_CLIENT_ID:LOW:EVE Client ID (localhost)"
  "YOUR_EVE_CLIENT_SECRET:LOW:EVE Secret (localhost)"
)

# Check 1: Git history
echo "📚 Checking git history for exposed credentials..."
FOUND_IN_HISTORY=0
FOUND_HIGH_PRIORITY=0

for cred_entry in "${CREDENTIALS[@]}"; do
  IFS=':' read -r cred priority desc <<< "$cred_entry"

  if git log --all --full-history -S"$cred" --pretty=format:"%h %s" | grep -q .; then
    if [ "$priority" = "HIGH" ]; then
      echo -e "${RED}❌ HIGH PRIORITY${NC} - $desc in git history:"
      FOUND_HIGH_PRIORITY=1
    else
      echo -e "${YELLOW}⚠️  LOW PRIORITY${NC} - $desc in git history:"
    fi
    git log --all --full-history -S"$cred" --pretty=format:"   %h %s" | head -2
    echo ""
    FOUND_IN_HISTORY=1
  fi
done

if [ $FOUND_IN_HISTORY -eq 0 ]; then
  echo -e "${GREEN}✅ No known credentials found in git history${NC}"
else
  echo -e "${RED}⚠️  Credentials found! Git history must be cleaned!${NC}"
fi
echo ""

# Check 2: Current .env files
echo "📄 Checking for uncommitted .env files..."
if [ -f "backend/.env" ]; then
  echo -e "${YELLOW}⚠️  backend/.env exists (should not be committed)${NC}"
  # Check if it's in .gitignore
  if git check-ignore backend/.env > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Properly ignored by .gitignore${NC}"
  else
    echo -e "${RED}   ❌ NOT ignored! Add to .gitignore!${NC}"
  fi
else
  echo -e "${GREEN}✅ No backend/.env file${NC}"
fi

if [ -f "frontend/.env" ]; then
  echo -e "${YELLOW}⚠️  frontend/.env exists${NC}"
  if git check-ignore frontend/.env > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Properly ignored${NC}"
  else
    echo -e "${RED}   ❌ NOT ignored!${NC}"
  fi
else
  echo -e "${GREEN}✅ No frontend/.env file${NC}"
fi
echo ""

# Check 3: .env.example has placeholders
echo "🔑 Checking .env.example for real credentials..."
if grep -q "YOUR_EVE_ID_PARTIAL" backend/.env.example 2>/dev/null; then
  echo -e "${RED}❌ Real EVE_CLIENT_ID found in .env.example!${NC}"
elif grep -q "YOUR_SECRET_PARTIAL" backend/.env.example 2>/dev/null; then
  echo -e "${RED}❌ Real EVE_CLIENT_SECRET found in .env.example!${NC}"
elif grep -q "AVNS_" backend/.env.example 2>/dev/null; then
  echo -e "${RED}❌ Real DATABASE_URL password found in .env.example!${NC}"
else
  echo -e "${GREEN}✅ .env.example appears clean${NC}"
fi
echo ""

# Check 4: Staged files
echo "📦 Checking staged git files..."
STAGED_ENV=$(git diff --cached --name-only | grep -E '\.env$' || true)
if [ -n "$STAGED_ENV" ]; then
  echo -e "${RED}❌ .env files are staged for commit:${NC}"
  echo "$STAGED_ENV" | sed 's/^/   /'
  echo -e "${YELLOW}   Run: git reset HEAD ${STAGED_ENV}${NC}"
else
  echo -e "${GREEN}✅ No .env files staged${NC}"
fi
echo ""

# Check 5: Search source code for patterns
echo "🔎 Searching source code for credential patterns..."
PATTERNS=(
  "password.*=.*['\"].*['\"]"
  "secret.*=.*['\"].*['\"]"
  "api[_-]?key.*=.*['\"].*['\"]"
)

FOUND_PATTERNS=0
for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(grep -rn -E -i "$pattern" backend/src frontend/src 2>/dev/null | grep -v "\.example" | grep -v "placeholder" | grep -v "your_" || true)
  if [ -n "$MATCHES" ]; then
    echo -e "${YELLOW}⚠️  Potential credential pattern:${NC} $pattern"
    echo "$MATCHES" | head -3 | sed 's/^/   /'
    FOUND_PATTERNS=1
  fi
done

if [ $FOUND_PATTERNS -eq 0 ]; then
  echo -e "${GREEN}✅ No obvious credential patterns in source code${NC}"
fi
echo ""

# Summary
echo "=============================="
echo "📊 Summary"
echo "=============================="

if [ $FOUND_HIGH_PRIORITY -eq 1 ]; then
  echo -e "${RED}🔴 HIGH PRIORITY: Database password in git history${NC}"
  echo "   → Rotate production database password if applicable"
  echo "   → Optional: Clean git history with BFG"
  echo "   → See SECURITY_AUDIT.md for instructions"
  echo ""
fi

if [ $FOUND_IN_HISTORY -eq 1 ] && [ $FOUND_HIGH_PRIORITY -eq 0 ]; then
  echo -e "${YELLOW}🟡 LOW PRIORITY: Localhost credentials in history${NC}"
  echo "   → EVE SSO credentials are for localhost only"
  echo "   → Not critical for production"
  echo "   → Optional: Clean for best practice"
  echo ""
fi

if [ -n "$STAGED_ENV" ]; then
  echo -e "${RED}❌ .env files staged - DO NOT COMMIT${NC}"
  echo ""
fi

if [ $FOUND_IN_HISTORY -eq 0 ] && [ -z "$STAGED_ENV" ]; then
  echo -e "${GREEN}✅ Repository appears safe for public release${NC}"
  echo ""
fi

echo "Priority Assessment:"
echo "  🔴 Database Password: HIGH (if production)"
echo "  🟢 EVE SSO Credentials: LOW (localhost only)"
echo ""
echo "📖 Full report: SECURITY_AUDIT.md"
