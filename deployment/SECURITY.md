# KillReport Droplet Security Guide

## 🔒 Security Hardening Overview

This guide covers security best practices for your DigitalOcean droplet running KillReport.

## Quick Setup

### Automated Security Hardening

```bash
# Download and run the security script
curl -o security-hardening.sh https://raw.githubusercontent.com/umutyerebakmaz/killreport/main/deployment/security-hardening.sh
chmod +x security-hardening.sh
sudo ./security-hardening.sh
```

**What it does:**

- Changes SSH port from 22 to 2222
- Disables root login
- Creates admin user: `killreport`
- Enforces SSH key-based authentication
- Configures UFW firewall
- Installs Fail2ban
- Enables automatic security updates

---

## 🛡️ Security Features

### 1. SSH Port Change (Port 2222)

**Why?** Port 22 is targeted by automated bot attacks. Changing it reduces attack surface.

**Configuration:**

```bash
# SSH config: /etc/ssh/sshd_config.d/99-security-hardening.conf
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
```

**Connect:**

```bash
ssh -p 2222 killreport@YOUR_DROPLET_IP
```

### 2. Firewall (UFW)

**Allowed ports:**

- 2222/tcp - SSH
- 80/tcp - HTTP
- 443/tcp - HTTPS
- 3000/tcp - Next.js Frontend (optional)
- 4000/tcp - GraphQL Backend (optional)

**Status:**

```bash
sudo ufw status numbered
```

**Add custom port:**

```bash
sudo ufw allow 8080/tcp comment 'Custom Service'
```

**Remove port:**

```bash
sudo ufw delete <rule_number>
```

### 3. Fail2ban Protection

**Protects against brute-force attacks**

**Configuration:** `/etc/fail2ban/jail.local`

- Ban time: 2 hours (7200 seconds)
- Max retries: 3 attempts
- Find time: 10 minutes (600 seconds)

**Check status:**

```bash
sudo fail2ban-client status sshd
```

**Unban IP:**

```bash
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>
```

**Check banned IPs:**

```bash
sudo fail2ban-client status sshd | grep "Banned IP"
```

### 4. Automatic Security Updates

**Enabled for:**

- Ubuntu security updates
- Critical patches
- Kernel updates

**Configuration:** `/etc/apt/apt.conf.d/50unattended-upgrades`

**Manual update check:**

```bash
sudo unattended-upgrade --dry-run --debug
```

### 5. User Management

**Admin user:** `killreport` (sudo access)
**Root login:** Disabled

**Switch to admin user:**

```bash
sudo su - killreport
```

**Add new admin user:**

```bash
sudo adduser newadmin
sudo usermod -aG sudo newadmin
```

### 6. SSH Key Management

**Add SSH key for new user:**

```bash
# On your local machine
ssh-copy-id -p 2222 killreport@YOUR_DROPLET_IP

# Or manually
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Paste your public key
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

**Generate new SSH key (local machine):**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

---

## 🔍 Monitoring & Maintenance

### Check Security Status

**1. SSH Audit:**

```bash
sudo sshd -T | grep -E 'port|permitroot|passwordauth'
```

**2. Active Connections:**

```bash
sudo ss -tunap | grep :2222
```

**3. Failed Login Attempts:**

```bash
sudo grep "Failed password" /var/log/auth.log | tail -20
```

**4. Firewall Status:**

```bash
sudo ufw status verbose
```

**5. Fail2ban Statistics:**

```bash
sudo fail2ban-client status
```

### Log Monitoring

**SSH logs:**

```bash
sudo tail -f /var/log/auth.log
```

**Fail2ban logs:**

```bash
sudo tail -f /var/log/fail2ban.log
```

**System logs:**

```bash
sudo journalctl -f
```

### Resource Monitoring

**Installed tools:**

- `htop` - Interactive process viewer
- `iotop` - I/O usage per process
- `nethogs` - Network bandwidth per process
- `ncdu` - Disk usage analyzer

**Usage:**

```bash
htop          # CPU and memory
sudo iotop    # Disk I/O
sudo nethogs  # Network usage
ncdu /        # Disk space
```

---

## 🚨 Emergency Procedures

### Lost SSH Access

**Via DigitalOcean Console:**

1. Go to DigitalOcean Dashboard
2. Select your droplet
3. Click "Access" → "Launch Console"
4. Login as `killreport`
5. Fix SSH configuration

**Reset SSH port to 22 (emergency only):**

```bash
sudo sed -i 's/Port 2222/Port 22/' /etc/ssh/sshd_config.d/99-security-hardening.conf
sudo systemctl restart sshd
sudo ufw allow 22/tcp
```

### Locked Out by Fail2ban

**Unban yourself:**

```bash
sudo fail2ban-client set sshd unbanip YOUR_IP
```

**Disable Fail2ban temporarily:**

```bash
sudo systemctl stop fail2ban
```

### Firewall Blocking Service

**Disable UFW temporarily:**

```bash
sudo ufw disable
```

**Check what's blocking:**

```bash
sudo ufw status numbered
sudo tail -f /var/log/ufw.log
```

---

## 🔐 Advanced Security

### 1. Two-Factor Authentication (2FA)

**Install Google Authenticator:**

```bash
sudo apt-get install libpam-google-authenticator
```

**Configure for user:**

```bash
google-authenticator
```

**Enable in SSH:**

```bash
sudo nano /etc/pam.d/sshd
# Add: auth required pam_google_authenticator.so

sudo nano /etc/ssh/sshd_config
# Set: ChallengeResponseAuthentication yes
sudo systemctl restart sshd
```

### 2. IP Whitelist (High Security)

**Allow only specific IPs:**

```bash
# Remove all SSH rules
sudo ufw delete allow 2222/tcp

# Add only your IP
sudo ufw allow from YOUR_IP to any port 2222 proto tcp comment 'SSH - Your IP'

# Add office IP
sudo ufw allow from OFFICE_IP to any port 2222 proto tcp comment 'SSH - Office'
```

### 3. Port Knocking

**Install knockd:**

```bash
sudo apt-get install knockd
```

**Example config:** `/etc/knockd.conf`

```ini
[openSSH]
sequence = 7000,8000,9000
seq_timeout = 5
command = /sbin/ufw allow from %IP% to any port 2222 proto tcp
tcpflags = syn

[closeSSH]
sequence = 9000,8000,7000
seq_timeout = 5
command = /sbin/ufw delete allow from %IP% to any port 2222 proto tcp
```

### 4. Intrusion Detection (OSSEC)

**Install OSSEC:**

```bash
wget -q -O - https://updates.atomicorp.com/installers/atomic | sudo bash
sudo apt-get install ossec-hids-server
```

---

## 📋 Security Checklist

### Initial Setup

- [ ] Run `security-hardening.sh` script
- [ ] Test SSH connection on port 2222
- [ ] Verify UFW is active
- [ ] Confirm Fail2ban is running
- [ ] Add SSH keys for all admins
- [ ] Disable password authentication

### Weekly Tasks

- [ ] Check failed login attempts
- [ ] Review Fail2ban bans
- [ ] Monitor system resources
- [ ] Check for security updates

### Monthly Tasks

- [ ] Review UFW rules
- [ ] Audit user accounts
- [ ] Check system logs for anomalies
- [ ] Backup security configurations

### Quarterly Tasks

- [ ] Rotate SSH keys
- [ ] Review and update firewall rules
- [ ] Security audit with `lynis`
- [ ] Update documentation

---

## 🔧 Configuration Files

### SSH Configuration

```
/etc/ssh/sshd_config.d/99-security-hardening.conf
```

### UFW Rules

```
/etc/ufw/user.rules
/etc/ufw/user6.rules
```

### Fail2ban Configuration

```
/etc/fail2ban/jail.local
/etc/fail2ban/filter.d/sshd.conf
```

### Automatic Updates

```
/etc/apt/apt.conf.d/50unattended-upgrades
/etc/apt/apt.conf.d/20auto-upgrades
```

### System Security

```
/etc/sysctl.conf
```

---

## 📞 Support

### Verify Security

**Run security audit:**

```bash
sudo apt-get install lynis
sudo lynis audit system
```

**Check open ports:**

```bash
sudo ss -tulpn
```

**Check running services:**

```bash
sudo systemctl list-units --type=service --state=running
```

### Quick Reference

**Change SSH port (if needed):**

```bash
sudo nano /etc/ssh/sshd_config.d/99-security-hardening.conf
# Change Port value
sudo systemctl restart sshd
sudo ufw allow NEW_PORT/tcp
sudo ufw delete allow OLD_PORT/tcp
```

**Harden Nginx (if installed):**

```bash
# Add to nginx.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

## 🔗 Additional Resources

- [DigitalOcean Security Best Practices](https://www.digitalocean.com/community/tutorials/recommended-security-measures-to-protect-your-servers)
- [Ubuntu Security Guide](https://ubuntu.com/security)
- [CIS Ubuntu Benchmark](https://www.cisecurity.org/benchmark/ubuntu_linux)
- [Fail2ban Documentation](https://www.fail2ban.org/)

---

**Last Updated:** 2026-01-04
**Version:** 1.0
