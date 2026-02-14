# Crontab Configuration - KillReport

## 📅 Scheduled Jobs

### Character & Corporation Sync Jobs

```bash
# Every Monday at 16:10 - Add all characters to update queue
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Every Monday at 17:00 - Detect missing corporations and add to queue
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

## 📖 Cron Format Explanation

```
┌───────────── Minute (0 - 59)
│ ┌───────────── Hour (0 - 23)
│ │ ┌───────────── Day of Month (1 - 31)
│ │ │ ┌───────────── Month (1 - 12)
│ │ │ │ ┌───────────── Day of Week (0 - 6) (0=Sunday, 1=Monday, 6=Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *  command
```

### Example Time Formats

```bash
# Every day at 03:00
0 3 * * *

# Every Monday at 16:10
10 16 * * 1

# Every Friday at 23:30
30 23 * * 5

# First day of every month at 00:00
0 0 1 * *

# Every 6 hours (00:00, 06:00, 12:00, 18:00)
0 */6 * * *

# Every 30 minutes
*/30 * * * *

# Weekdays at 09:00 (Monday-Friday)
0 9 * * 1-5

# Weekends at 10:00 (Saturday-Sunday)
0 10 * * 6,0
```

## 🚀 Installation

### 1. Connect to Droplet via SSH

```bash
ssh root@your-droplet-ip
```

### 2. Edit Crontab

```bash
crontab -e
```

### 3. Add Cron Jobs

Copy and paste the jobs above and save (`:wq` or `Ctrl+X` > `Y` > `Enter`)

### 4. Verify Crontab

```bash
crontab -l
```

### 5. Confirm Cron Service is Running

```bash
systemctl status cron
# or
service cron status
```

## 📊 Recommended Cron Schedule

### Production Environment

```bash
# Character update - Once per week (Monday 16:10)
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Corporation scan - Once per week (Monday 17:00)
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1

# Clean log files - Every Sunday 02:00
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete

# Database backup - Every day 04:00
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1

# PM2 logs rotate - Every day 05:00
0 5 * * * pm2 flush && pm2 reloadLogs
```

### Development/Test Environment

```bash
# More frequent for testing - Every day 09:00
0 9 * * * cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1

# Every day 10:00
0 10 * * * cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

## 🔍 Monitoring and Troubleshooting

### Check Cron Logs

```bash
# System cron logs
tail -f /var/log/cron
# or
tail -f /var/log/syslog | grep CRON

# Custom log files
tail -f /var/www/killreport/logs/queue-characters.log
tail -f /var/www/killreport/logs/queue-corporations.log
```

### Manually Test Cron Job

```bash
# Run the full command from terminal
cd /var/www/killreport/backend && yarn queue:characters
```

### Check if Cron Job is Running

```bash
# View recently executed cron jobs
grep CRON /var/log/syslog | tail -20
```

### Environment Variables Issue

Cron jobs run with a minimal environment. If the command works from terminal but not from cron:

```bash
# Add PATH and other env vars to the beginning of crontab
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_ENV=production

# Then add jobs
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
```

### Yarn Command Not Found Error

```bash
# Find yarn's full path
which yarn
# Example output: /usr/bin/yarn

# Use full path in crontab
10 16 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
```

## 🛡️ Best Practices

### 1. Always Create Log Files

```bash
# Redirect STDOUT and STDERR to the same file
>> /path/to/logfile.log 2>&1

# Log only errors
2>> /path/to/error.log

# No logging (not recommended)
> /dev/null 2>&1
```

### 2. Use Absolute Paths

```bash
# ✅ Correct
cd /var/www/killreport/backend && yarn queue:characters

# ❌ Wrong (may not work in cron environment)
cd ~/killreport/backend && yarn queue:characters
```

### 3. Use Lock File (Prevent Concurrent Execution)

```bash
# Prevent the same script from running multiple times simultaneously
10 16 * * 1 flock -n /tmp/queue-characters.lock -c 'cd /var/www/killreport/backend && yarn queue:characters' >> /var/www/killreport/logs/queue-characters.log 2>&1
```

### 4. Email Notification (Optional)

```bash
# Add email address at the beginning of crontab
MAILTO=admin@yourdomain.com

# Email will be sent if job fails
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters
```

### 5. Use Timeout

```bash
# Timeout after 30 minutes
10 16 * * 1 timeout 30m bash -c 'cd /var/www/killreport/backend && yarn queue:characters' >> /var/www/killreport/logs/queue-characters.log 2>&1
```

## 📈 Performance Considerations

### Character Queue Job

- **Duration:** ~2-5 minutes (93K characters)
- **Memory:** ~100MB
- **Recommended Frequency:** 1-2 times per week
- **Timing:** Low traffic hours (night/weekend)

### Corporation Queue Job

- **Duration:** ~1-3 minutes (1.4K corporations)
- **Memory:** ~80MB
- **Recommended Frequency:** Once per week
- **Timing:** After character sync

## 🔄 Update and Maintenance

### Backup Crontab

```bash
# Create backup
crontab -l > ~/crontab-backup-$(date +%Y%m%d).txt

# Restore
crontab ~/crontab-backup-20260105.txt
```

### Remove All Cron Jobs

```bash
crontab -r
```

### Edit Specific User's Crontab

```bash
# For root user
sudo crontab -u root -e

# For another user
sudo crontab -u username -e
```

## 📝 Job Descriptions

### `yarn queue:characters`

- **Purpose:** Adds all characters from the database to the ESI update queue
- **Effect:** worker:info:characters picks up jobs and fetches current information from ESI
- **Expected Result:** 93K+ characters added to queue
- **Processing Time:** ~2 minutes (queue addition), ~4-8 hours (worker processing)

### `yarn queue:character-corporations`

- **Purpose:** Detects missing corporations in characters and adds them to queue
- **Effect:** worker:info:corporations picks up jobs and fetches corporation information from ESI
- **Expected Result:** ~1.4K missing corporations found and added to queue
- **Processing Time:** ~1 minute (scan + queue), ~30-60 minutes (worker processing)

## 🎯 Conclusion

**Minimal Setup (Starter):**

```bash
# Weekly sync only
10 16 * * 1 cd /var/www/killreport/backend && yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
0 17 * * 1 cd /var/www/killreport/backend && yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1
```

**Production Setup (Full-Featured):**

```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_ENV=production

# Weekly sync jobs
10 16 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:characters >> /var/www/killreport/logs/queue-characters.log 2>&1
0 17 * * 1 cd /var/www/killreport/backend && /usr/bin/yarn queue:character-corporations >> /var/www/killreport/logs/queue-corporations.log 2>&1

# Daily maintenance
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete
0 5 * * * pm2 flush && pm2 reloadLogs
```
