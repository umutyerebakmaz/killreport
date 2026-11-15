# Crontab Configuration - KillReport

## 📅 Scheduled Jobs

The crontab holds server maintenance only: log cleanup, the database backup
and PM2 log rotation (see [Recommended Cron Schedule](#-recommended-cron-schedule)).

`queue:characters` and `queue:character-corporations` are **not** scheduled
here. They run under PM2 `cron_restart` in `ecosystem.config.js`, every
Monday at 16:10 and 17:00 — see [PM2](./pm2.md). They used to be crontab
entries as well; do not add them back, or they run twice.

## 📖 Cron Format Explanation

```text
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
# Clean log files - Every Sunday 02:00
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete

# Database backup - Every day 04:00
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1

# PM2 logs rotate - Every day 05:00
0 5 * * * pm2 flush && pm2 reloadLogs
```

### Development/Test Environment

To run the character jobs outside their PM2 schedule, trigger them by hand
rather than adding a crontab entry:

```bash
pm2 trigger queue-characters
pm2 trigger queue-character-corporations
```

## 🔍 Monitoring and Troubleshooting

### Check Cron Logs

```bash
# System cron logs
tail -f /var/log/cron
# or
tail -f /var/log/syslog | grep CRON

# Custom log files
tail -f /var/www/killreport/logs/backup.log
```

### Manually Test Cron Job

```bash
# Run the full command from terminal
cd /var/www/killreport/backend/scripts && bash backup-db.sh
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
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1
```

### Command Not Found Error

```bash
# Find the command's full path
which pm2
# Example output: /usr/bin/pm2

# Use full path in crontab
0 5 * * * /usr/bin/pm2 flush && /usr/bin/pm2 reloadLogs
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
cd /var/www/killreport/backend/scripts && bash backup-db.sh

# ❌ Wrong (may not work in cron environment)
cd ~/killreport/backend/scripts && bash backup-db.sh
```

### 3. Use Lock File (Prevent Concurrent Execution)

```bash
# Prevent the same script from running multiple times simultaneously
0 4 * * * flock -n /tmp/backup-db.lock -c 'cd /var/www/killreport/backend/scripts && bash backup-db.sh' >> /var/www/killreport/logs/backup.log 2>&1
```

### 4. Email Notification (Optional)

```bash
# Add email address at the beginning of crontab
MAILTO=admin@yourdomain.com

# Email will be sent if job fails
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh
```

### 5. Use Timeout

```bash
# Timeout after 30 minutes
0 4 * * * timeout 30m bash -c 'cd /var/www/killreport/backend/scripts && bash backup-db.sh' >> /var/www/killreport/logs/backup.log 2>&1
```

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

## 🎯 Conclusion

**Minimal Setup (Starter):**

```bash
# Nightly database backup only
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1
```

**Production Setup (Full-Featured):**

```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_ENV=production

# Daily maintenance
0 4 * * * cd /var/www/killreport/backend/scripts && bash backup-db.sh >> /var/www/killreport/logs/backup.log 2>&1
0 2 * * 0 find /var/www/killreport/logs -name "*.log" -type f -mtime +30 -delete
0 5 * * * pm2 flush && pm2 reloadLogs
```
