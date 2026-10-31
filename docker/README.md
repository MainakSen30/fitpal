# Docker Setup

This setup runs Postgres, Redis, API, and Web in Docker. The mobile app runs locally on the host machine (not containerized).

## Services

- **postgres** - PostgreSQL 17 (port 5432)
- **redis** - Redis 7 (port 6379)
- **migrate** - One-off service that runs Drizzle migrations on startup
- **api** - Hono API (port 3001)
- **web** - Next.js app (port 3000)

## Usage

### Start all services (fresh DB will be migrated automatically)

```bash
cd docker
docker compose up -d
```

### Start with rebuild

```bash
cd docker
docker compose up -d --build
```

### Stop services

```bash
cd docker
docker compose down
```

### Stop and remove volumes (reset DB)

```bash
cd docker
docker compose down -v
```

## Mobile App

Run the mobile app separately on your host machine:

```bash
cd apps/mobile
EXPO_TYPED_ROUTES=0 bun expo start --clear
```

## Notes

- Inside containers, use `postgres:5432` and `redis:6379` for service connections
- On the host, use `localhost:5432` and `localhost:6379`
- Migrations are applied automatically by the `migrate` service when containers start
- MinIO and Meilisearch have been removed as they're not needed currently
