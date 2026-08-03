# GlycoFit Backup Procedure

## Overview

Nightly `pg_dump` of the `insulin_tracker` database, uploaded to Backblaze B2. Retention: 30 daily + 6 monthly.

- **Backup script**: `/home/deploy/scripts/backup-glycofit.sh`
- **Restore script**: `/home/deploy/scripts/restore-glycofit.sh`
- **Cron**: daily at 06:00 UTC (03:00 Argentina) as user `deploy`
- **Local dumps**: `/home/deploy/backups/glycofit/`
- **Log**: `/home/deploy/logs/backup-glycofit.log`
- **B2 bucket**: `glycofit-backups` (daily/ and monthly/ folders)

---

## 1. Configure Backblaze B2

### Create bucket

1. Log in at https://secure.backblaze.com
2. Create a bucket named `glycofit-backups`, private
3. Create an application key with read/write access to that bucket only
4. Save the Key ID and Application Key

### Configure rclone on the VPS

```bash
ssh claude-bot
rclone config
```

Follow the prompts:
- **n** (new remote)
- Name: **b2**
- Storage: **6** (Backblaze B2)
- Account: paste your **Key ID**
- Key: paste your **Application Key**
- Leave endpoint blank
- Confirm

Test it:
```bash
rclone lsd b2:glycofit-backups
```

---

## 2. Run a manual backup

```bash
ssh claude-bot "/home/deploy/scripts/backup-glycofit.sh"
```

Check the log:
```bash
ssh claude-bot "tail -10 /home/deploy/logs/backup-glycofit.log"
```

---

## 3. Verify a backup (restore test)

```bash
ssh claude-bot "/home/deploy/scripts/restore-glycofit.sh /home/deploy/backups/glycofit/insulin_tracker_2026-08-03.dump"
```

This will:
1. Create a scratch database `insulin_tracker_restore_test`
2. Restore the dump into it
3. Compare row counts against production for every table
4. Drop the scratch database
5. Report PASS or FAIL

---

## 4. Restore from B2 (disaster recovery)

```bash
# Download latest from B2
ssh claude-bot "rclone copy b2:glycofit-backups/daily/insulin_tracker_YYYY-MM-DD.dump /home/deploy/backups/glycofit/"

# Restore to production (DESTRUCTIVE — drops and recreates)
ssh claude-bot "
  export PGPASSWORD=whdJFH760XtEdQAENCXShqMLMS3n42D0
  pg_restore -h 127.0.0.1 -U insulin_tracker -d insulin_tracker --clean --if-exists /home/deploy/backups/glycofit/insulin_tracker_YYYY-MM-DD.dump
"

# Restart the app
ssh claude-bot "/home/deploy/.local/share/pnpm/pm2 restart glycofit"
```

---

## 5. Verify cron is active

```bash
ssh claude-bot "crontab -l | grep backup"
# Should show: 0 6 * * * /home/deploy/scripts/backup-glycofit.sh
```
