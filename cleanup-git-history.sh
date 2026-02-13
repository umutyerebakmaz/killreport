#!/bin/bash

# Quick Git History Cleanup Script for KillReport
# WARNING: This will rewrite git history - USE WITH CAUTION

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  GIT HISTORY CLEANUP - READ CAREFULLY${NC}"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Create a backup of your repository"
echo "2. Remove exposed credentials from git history"
echo "3. Prepare for force push"
echo ""
echo -e "${RED}WARNING: This REWRITES git history!${NC}"
echo "- All commit hashes will change"
echo "- Requires force push to remote"
echo "- Team members must re-clone repository"
echo ""
echo "What will be cleaned:"
echo "  🔴 Database password: YOUR_DB_PASSWORD"
echo "  🟢 EVE credentials: localhost only (optional cleanup)"
echo ""
read -p "Have you rotated production database password? (yes/no/skip): " ROTATED

if [ "$ROTATED" = "no" ]; then
  echo -e "${RED}❌ Please rotate database password FIRST!${NC}"
  echo ""
  echo "If this is a production database:"
  echo "1. Go to DigitalOcean dashboard"
  echo "2. Reset database password"
  echo "3. Update all services with new DATABASE_URL"
  echo ""
  exit 1
elif [ "$ROTATED" = "skip" ]; then
  echo -e "${YELLOW}⚠️  Skipping database password check (dev/test database)${NC}"
fi

echo ""
read -p "Continue with git history cleanup? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🔄 Starting cleanup process..."
echo ""

# Step 1: Backup
echo "📦 Creating backup..."
BACKUP_DIR="../killreport-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . "$BACKUP_DIR"
echo -e "${GREEN}✅ Backup created at: $BACKUP_DIR${NC}"
echo ""

# Step 2: Create credentials replacement file
echo "📝 Creating replacement patterns..."
cat > /tmp/bfg-credentials.txt << 'EOF'
YOUR_EVE_CLIENT_ID==>***REMOVED_EVE_CLIENT_ID***
YOUR_EVE_SECRET==>***REMOVED_EVE_SECRET***
YOUR_DB_PASSWORD==>***REMOVED_DB_PASSWORD***
EOF
echo -e "${GREEN}✅ Replacement patterns created${NC}"
echo ""

# Step 3: Check if BFG is installed
if ! command -v bfg &> /dev/null; then
  echo -e "${YELLOW}⚠️  BFG Repo-Cleaner not found${NC}"
  echo ""
  echo "Install BFG:"
  echo "  macOS:   brew install bfg"
  echo "  Linux:   Download from https://rtyley.github.io/bfg-repo-cleaner/"
  echo "  Manual:  java -jar bfg.jar (requires download)"
  echo ""
  echo "Or use git filter-repo instead:"
  echo "  pip install git-filter-repo"
  echo ""
  exit 1
fi

# Step 4: Run BFG
echo "🧹 Cleaning git history with BFG..."
bfg --replace-text /tmp/bfg-credentials.txt --no-blob-protection .

echo ""
echo "🗑️  Expiring reflog and garbage collecting..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo -e "${GREEN}✅ Git history cleaned!${NC}"
echo ""

# Step 5: Verification
echo "🔍 Verifying cleanup..."
STILL_FOUND=0

if git log --all -S"YOUR_DB_PASSWORD" --oneline | grep -q .; then
  echo -e "${RED}❌ Database password still found in history!${NC}"
  STILL_FOUND=1
else
  echo -e "${GREEN}✅ Database password removed from history${NC}"
fi

# Optional check for EVE credentials (less important)
if git log --all -S"YOUR_EVE_CLIENT" --oneline | grep -q .; then
  echo -e "${YELLOW}ℹ️  EVE credentials still in history (OK - localhost only)${NC}"
fi

if [  $STILL_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ Critical credentials removed${NC}"
else
  echo -e "${YELLOW}⚠️  Some credentials may still exist. Check manually:${NC}"
  echo "  git log --all -S'YOUR_DB_PASSWORD' --oneline"
fi

echo ""
echo "=========================================="
echo "📋 Next Steps:"
echo "=========================================="
echo ""
echo "1. Review changes:"
echo "   git log --oneline -20"
echo ""
echo "2. Test locally:"
echo "   yarn install"
echo "   # Test app works"
echo ""
echo "3. Force push to remote:"
echo -e "   ${YELLOW}git push origin --force --all${NC}"
echo -e "   ${YELLOW}git push origin --force --tags${NC}"
echo ""
echo "4. Notify team members to:"
echo "   rm -rf killreport"
echo "   git clone <repo-url>"
echo ""
echo "5. Make repository public on GitHub"
echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo "Backup location: $BACKUP_DIR"
