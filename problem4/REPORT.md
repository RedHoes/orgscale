# Problem 4 Report

## Problems found

### 1. Nginx was proxying to the wrong API port

- nginx forwarded `/api/` to `http://api:3001`
- the Node app listens on `3000`
- result: requests through nginx fail even if the API container is healthy

### 2. `depends_on` did not guarantee readiness

- Compose starts containers in order, but that does not mean Postgres and Redis are ready to serve traffic
- API startup could race the DB / cache startup
- result: intermittent failures during boot, which matches the "sometimes inaccessible" symptom

### 3. The Postgres init SQL was not mounted

- there was an `init.sql` file but the Compose service did not use it
- result: any intended schema / seed data would never exist

### 4. Nginx only proxied `/api/`

- API also exposed `/status`
- when going through port `8080`, that path was not available

## How I diagnosed it

- read the Compose file first
- checked the nginx config against the API source
- compared the API listen port with the upstream target
- checked whether database initialization was actually wired in
- looked for boot-race conditions between API, Postgres, and Redis

## Fixes applied

- changed nginx upstream to `api:3000`
- routed `/status` and `/healthz` through nginx
- added health checks for Postgres, Redis, and API
- made nginx wait for API health, and API wait for DB / Redis health
- mounted `postgres/init.sql`
- created a simple `users` table with seed rows
- improved `/healthz` so it checks both Postgres and Redis

## Monitoring / alerts I would add

- alert on nginx `5xx` rate
- alert on API container restart count
- alert on Postgres readiness failure
- alert on Redis connection failure
- dashboard for request rate, latency, and error rate
- container log shipping with correlation by service name

## How I would prevent this in production

- CI check that runs `docker compose up` and smoke tests the main endpoints
- a real readiness endpoint used by the reverse proxy / orchestrator
- release checklist for port changes and routing changes
- infrastructure tests for config drift
- better observability from day one
