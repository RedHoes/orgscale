# Problem 3

## Context

We have an Ubuntu 24.04 VM with 64GB disk, and monitoring shows storage usage is constantly at 99%.

This VM only runs one main service: `nginx`, acting as a load balancer / traffic router for upstream services.

The way I would handle this is:

1. confirm whether this is just a capacity alert or already a customer-facing incident
2. identify what is consuming disk
3. stop the disk from reaching 100%
4. recover the service safely
5. add prevention so it does not happen again

## What I would check first

### 1. Confirm the alert and current impact

Commands:

```bash
df -h
df -i
sudo systemctl status nginx
sudo journalctl -u nginx -n 100 --no-pager
curl -I http://127.0.0.1
```

What I want to know:

- is the filesystem actually 99% full
- is it block usage or inode usage
- is nginx still healthy
- are there already write errors or restart failures
- is the load balancer still serving traffic

### 2. Find where the disk is being used

Commands:

```bash
sudo du -xh / --max-depth=1 2>/dev/null | sort -h
sudo du -xh /var --max-depth=2 2>/dev/null | sort -h
sudo find /var/log -type f -size +100M -ls | sort -k7 -n
sudo find / -xdev -type f -size +500M 2>/dev/null
sudo lsof +L1
```

What I want to learn:

- whether the growth is in `/var/log`, `/var/cache`, `/tmp`, or something unexpected
- whether deleted files are still held open by a process
- whether nginx logs are the main problem

### 3. Check recent changes

Commands:

```bash
sudo ls -lh /var/log/nginx
sudo ls -lh /etc/logrotate.d
sudo grep -R "access_log\\|error_log" /etc/nginx /etc/nginx/sites-enabled 2>/dev/null
sudo journalctl --disk-usage
sudo apt clean
```

What I want to verify:

- has logging suddenly increased
- is log rotation missing or broken
- is `journald` consuming too much space
- is package cache taking unnecessary disk

## Most likely root causes I expect

For a VM that only runs nginx, I would expect the problem to be one of these.

### Root cause 1: NGINX access or error logs grew too large

#### Why I expect this

This is the most likely scenario.

A load balancer can generate a lot of access logs, especially if:

- traffic increased
- a noisy health check is hitting very frequently
- bots or attacks are generating traffic
- upstream errors are causing lots of retries and error logs
- log rotation is missing or not working

#### How I would confirm it

```bash
sudo du -sh /var/log/nginx
sudo ls -lh /var/log/nginx
sudo logrotate -d /etc/logrotate.d/nginx
```

#### Impact

- disk eventually reaches 100%
- nginx may fail to write logs
- config reloads or service restarts can fail
- the whole VM may become unstable because other system writes also fail

#### Recovery

Short term:

```bash
sudo truncate -s 0 /var/log/nginx/access.log
sudo truncate -s 0 /var/log/nginx/error.log
sudo systemctl reload nginx
```

If rotated logs are the issue:

```bash
sudo gzip /var/log/nginx/*.log.1
sudo find /var/log/nginx -type f -name "*.gz" -mtime +7 -delete
```

Longer term:

- fix or enable log rotation
- lower unnecessary log verbosity
- send nginx logs to a centralized logging system
- review traffic spikes, bots, or abusive clients

### Root cause 2: `journald` logs consumed too much disk

#### Why I expect this

On Ubuntu, systemd journal can quietly grow if retention is not controlled, especially if nginx or system services are noisy.

#### How I would confirm it

```bash
sudo journalctl --disk-usage
sudo journalctl -p err -n 200 --no-pager
```

#### Impact

- same storage pressure problem as large nginx logs
- system services may become harder to operate
- troubleshooting gets worse because the VM is low on space while still generating logs

#### Recovery

```bash
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M
```

Longer term:

- configure `SystemMaxUse` in `/etc/systemd/journald.conf`
- restart `systemd-journald`
- forward logs externally instead of keeping too much local history

### Root cause 3: Deleted file still held open by a process

#### Why I expect this

This is a classic Linux issue.

Someone may delete a large log file, but nginx or another process still has the file descriptor open, so disk space is not actually released.

#### How I would confirm it

```bash
sudo lsof +L1
```

If I see a large deleted file still opened by `nginx` or another process, that is the cause.

#### Impact

- `df -h` still shows high usage even after files were deleted
- engineers think cleanup happened, but storage does not go down
- service may continue operating until disk fills completely

#### Recovery

```bash
sudo systemctl reload nginx
```

If reload is not enough:

```bash
sudo systemctl restart nginx
```

Then verify:

```bash
df -h
sudo lsof +L1
```

Longer term:

- use proper log rotation with `postrotate`
- avoid manually deleting active logs

### Root cause 4: Inode exhaustion instead of real disk-size exhaustion

#### Why I expect this

Sometimes the disk looks "full" because there are too many small files rather than large files.

#### How I would confirm it

```bash
df -i
sudo find /var/log -xdev -type f | wc -l
sudo find /tmp -xdev -type f | wc -l
```

#### Impact

- nginx and system processes may fail to create new files
- logs may stop writing
- behavior can be confusing because `df -h` and `df -i` tell different stories

#### Recovery

- remove unneeded small files
- rotate and compress logs
- clear temp directories carefully

## Final answer

The most likely cause on this kind of VM is oversized local logs, especially nginx logs or system journal logs.

The main production risk is not just "disk is full", but that nginx as the load balancer becomes unable to write, reload, or recover, which can turn a storage alert into a traffic outage.

So my approach is:

- confirm customer impact
- find the exact disk consumer
- free space safely
- recover nginx if needed
- fix retention and observability so it does not happen again
