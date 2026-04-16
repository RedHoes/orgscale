# Problem 4

This folder contains a fixed version of the provided Docker Compose stack plus a short report.

## How to run

```bash
docker compose up --build
```

If `8080` is already in use on your machine, run:

```bash
HOST_PORT=18080 docker compose up --build
```

Then test:

```bash
curl http://localhost:${HOST_PORT:-8080}/
curl http://localhost:${HOST_PORT:-8080}/status
curl http://localhost:${HOST_PORT:-8080}/healthz
curl http://localhost:${HOST_PORT:-8080}/api/users
```

## Summary of fixes

1. Fixed nginx upstream port mismatch
2. Added `/status` and `/healthz` routing through nginx
3. Added service health checks and proper startup ordering
4. Mounted Postgres init script and created actual sample data
5. Added slightly better API health behavior and safer DB usage
6. Added restarts to reduce simple crash-loop downtime
