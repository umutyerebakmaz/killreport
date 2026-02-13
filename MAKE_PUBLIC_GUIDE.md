# 🚀 Making Repository Public - Quick Guide

## 📊 Priority Assessment

**Database Password**: 🔴 **HIGH** - If production database
**EVE SSO Credentials**: 🟢 **LOW** - Localhost only, limited impact

Your repository contains credentials in git history. Prioritize based on environment:

## 🔴 Step 1: Check Database Password (HIGH PRIORITY)

### 1.1 Is this a production database?

Check the exposed password: `YOUR_DB_PASSWORD`

**If production database:**

1. Go to DigitalOcean dashboard
2. Reset database password
3. Update all services:

   ```bash
   # Update backend/.env
   DATABASE_URL="postgresql://username:NEW_PASSWORD@host:25060/killreport?sslmode=require"

   # Update production environment variables
   # (PM2, systemd, or hosting platform)
   ```

**If dev/test database:**

- Lower priority
- Consider rotating anyway for best practice

### 1.2 EVE Online SSO (🟢 LOW PRIORITY)

Exposed credentials are for **localhost only**:

```
EVE_CLIENT_ID=YOUR_EVE_CLIENT_ID (localhost)
EVE_CLIENT_SECRET=... (localhost)
Callback: http://localhost:4000/auth/callback
```

**Impact**: MINIMAL

- Cannot be used in production (callback URL validated)
- Only work on local development
- Production already uses different credentials

**Action**: Optional - no urgent need to rotate

## 🧹 Step 2: Clean Git History (Optional)

**Note**: Only critical if database password is for production.

Run the security check first:

```bash
./security-check.sh
```

If you want to clean history:

```bash
./cleanup-git-history.sh
```

**OR manually with BFG:**

```bash
# Install BFG
brew install bfg  # macOS
# or download: https://rtyley.github.io/bfg-repo-cleaner/

# Create backup
cp -r . ../killreport-backup

# Create replacement file (focus on DB password if production)
cat > creds.txt << 'EOF'
YOUR_DB_PASSWORD_HERE
EOF

# Clean history
bfg --replace-text creds.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## ✅ Step 3: Verify Cleanup

```bash
# Check if database password still in history
git log --all -S"YOUR_DB_PASSWORD" --oneline

# Should return nothing if cleaned!
```

## 🚀 Step 4: Make Repository Public

**Safe to make public if**:

- ✅ Production database password rotated (if applicable)
- ✅ Git history cleaned (optional)
- ✅ .env.example uses placeholders
- ✅ No .env files committed

**You can skip if**:

- Database in git history is dev/test only
- Production uses different credentials
- localhost EVE credentials are not sensitive

**CAUTION**: This rewrites history! Team members must re-clone.

```bash
git push origin --force --all
git push origin --force --tags
```

## 🌐 Step 5: Make Public

1. Go to GitHub repository settings
2. Scroll to "Danger Zone"
3. Click "Change repository visibility"
4. Select "Public"
5. Confirm

## 📋 Final Checklist

- [ ] EVE SSO credentials rotated
- [ ] JWT secret regenerated
- [ ] Database password changed (if needed)
- [ ] Git history cleaned
- [ ] Verified no credentials: `./security-check.sh`
- [ ] Force pushed to GitHub
- [ ] Repository made public
- [ ] Team notified to re-clone

## 🔍 Quick Security Verification

```bash
# Run security check
./security-check.sh

# Should show:
# ✅ No credentials in git history
# ✅ .env.example clean
# ✅ No .env files staged
```

## 📚 Full Documentation

See `SECURITY_AUDIT.md` for complete security report and detailed instructions.

## ⚡ Quick Commands

```bash
# 1. Check security
./security-check.sh

# 2. Rotate credentials (manual step!)
open https://developers.eveonline.com/
openssl rand -base64 32  # for JWT

# 3. Clean git history
./cleanup-git-history.sh

# 4. Verify
./security-check.sh

# 5. Force push
git push origin --force --all

# 6. Make public on GitHub
```

## 🆘 Need Help?

- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- GitHub: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- EVE Developers: https://developers.eveonline.com/

---

**Remember**: Old credentials in git history can NEVER be truly deleted from GitHub once pushed publicly. Always rotate credentials BEFORE cleaning history!
