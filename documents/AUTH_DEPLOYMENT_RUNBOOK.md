# Authentication deployment runbook

This runbook covers the current Compose-based production stack. Platform-specific
deploy commands are out of scope; the API uses the same environment contract on any
platform. Never run these steps against a development database, and never put database
credentials in this document or in logs.

## 1. Preconditions

- The target is a dedicated production PostgreSQL database and Redis instance/service.
- Secrets are available in the deployment secret manager, not in the repository or image.
- The target PostgreSQL role can create `btree_gist` if migration `0007` has not yet been
  applied.
- A tested backup and restore path exists. Create a fresh backup immediately before any
  migration.
- `NODE_ENV=production` is set. Production startup validation rejects unsafe settings.
- `TRUSTED_PROXY_IP` reflects the actual immediate proxy peer, or is left unset for
  direct socket connections.
- TLS termination is configured outside the API container; published web origins are
  HTTPS.

## 2. Provision secrets

Provide every variable listed in
[`AUTH_PRODUCTION_READINESS.md`](./AUTH_PRODUCTION_READINESS.md) through the platform
secret manager or Compose interpolation environment. Do not use values from
`.env.example`.

Generate a unique `OTP_PEPPER` in the secret manager (for example with
`openssl rand -hex 32`). Rotating it invalidates every outstanding OTP. Use a distinct
reply-to and sender on a verified domain. Set `SMS_MODE=disabled` until a real SMS
provider is implemented; mock delivery is rejected in production.

## 3. Database backup

1. Confirm the target `DATABASE_URL` points to the intended production cluster and
   database. Verify from the platform's secret manager; do not print the value.
2. Take a logical backup with the platform's supported tool (for example `pg_dump` with
   a compressed custom format).
3. Record the backup timestamp, target database identifier and migration state in the
   deployment log. Do not record credentials.
4. Verify the backup can be listed/read. A backup that has never been restored is not a
   recovery plan.

## 4. Check migration state

Drizzle tracks applied migrations in `drizzle.__drizzle_migrations`. From an operator
session with read access to that table, inspect the latest `created_at` and compare it
with `packages/database/src/migrations/meta/_journal.json`. The current latest migration
is `0011_famous_colonel_america.sql`, which adds `users.session_version`.

Do not generate a new migration for deployment; no schema change was required in
Phase 8.6.

## 5. Deploy sequence

1. Build and publish/pin the API and web production images. The API Dockerfile's last
   stage is `production`; never run the `migrate` stage as the API service.
2. Ensure the web image is built with the production `NEXT_PUBLIC_API_URL`. This value is
   inlined at build time; setting it only at runtime is not sufficient.
3. Start or run the one-shot migration job. In Compose this is the `migrate` service,
   which uses `target: migrate`, one `DATABASE_URL`, and `restart: "no"`.
4. Wait for migrations to complete successfully before starting the API. In Compose the
   API waits for `migrate: service_completed_successfully`.
5. Start the API. It validates configuration, requires Redis connectivity, checks
   PostgreSQL/Redis readiness, then starts listening.
6. After the API is healthy, start the web service. Compose gates web on API liveness
   health.

## 6. Applying migrations

Use the project's migration command against the production `DATABASE_URL` only:

```bash
bun run --cwd packages/database migrate
```

Drizzle reads the journal in order and applies all newer migrations in one transaction.
If a statement fails, the batch rolls back and no partial tracking row is written.
Migrations `0006` and `0011` update existing authentication data/schema, so the backup
from step 3 is mandatory.

Never run migrations from multiple API replicas or multiple release jobs concurrently.
The Compose `migrate` service is one-shot; other platforms must use an equivalent single
release step/lock.

## 7. Verify migration completion

1. Re-check `drizzle.__drizzle_migrations` against the journal.
2. Confirm `users.session_version` exists and has the expected default.
3. Run the post-migration health checks below.
4. Spot-check one non-production user login or a synthetic health probe that exercises
   session validation. Do not send real OTPs or recovery emails as a deployment test.

## 8. Post-migration health checks

```bash
curl -fsS https://<api-host>/health
curl -fsS https://<api-host>/readyz
```

Expected responses:

```json
{"status":"ok"}
{"status":"ready"}
```

`/health` is liveness only. `/readyz` checks PostgreSQL and Redis and returns `503`
with `{"status":"unavailable"}` if either is unavailable. Neither endpoint exposes
connection details.

Also verify from the platform:

- logs are reaching stdout/stderr collection;
- no startup configuration errors are present;
- TLS certificate and published HTTPS origin are correct;
- trusted-proxy IP resolution produces distinct client IPs (check rate-limit behavior
  with synthetic traffic, not real accounts).

## 9. Failure handling

### Partially failed migration

- Stop any API rollout that has already started.
- Read the migration error from the migration job logs. Drizzle's batch transaction
  should have rolled back; verify `drizzle.__drizzle_migrations` before retrying.
- Do not hand-edit migration files or journal ordering.
- If the database is inconsistent, restore from the verified pre-migration backup and
  retry after fixing the cause (permissions, extension availability, lock contention).

### Startup configuration failure

The API error names the offending variable category without printing values. Fix the
secret/environment and restart. Common causes: missing `OTP_PEPPER`, `SMS_MODE=mock`,
wildcard `CORS_ORIGIN`, non-HTTPS production origins, missing email/OAuth variables, or
non-TLS public database/Redis URLs.

### Redis unavailable

Authentication is fail-closed where Redis stores required state: sessions, OAuth state
and exchange codes, and OAuth throttling. Password login and OTP IP edge limits retain
their documented fail-open behavior. `/readyz` will return `503`. Do not disable the
probe to restore traffic; restore Redis.

### PostgreSQL unavailable

`/readyz` returns `503`, session validation fails closed, and OTP/recovery state cannot
be consumed. Restore database connectivity. Do not bypass validation.

## 10. Rollback and recovery limitations

- Application rollback: redeploy the previous pinned image after confirming its
  environment contract. Do not change auth API contracts during rollback.
- Schema rollback: Drizzle does not generate down migrations here. Reverse SQL must be
  reviewed and tested; dropping `users.session_version` or OTP/recovery tables can
  destroy data. Prefer forward fixes unless the failed migration is provably inert.
- `OTP_PEPPER` rotation invalidates outstanding OTPs; a rollback to an old pepper
  invalidates OTPs issued under the new one.
- Redis loss invalidates sessions, OAuth state and rate-limit windows. Users must
  reauthenticate and restart OAuth. PostgreSQL OTP/recovery records remain authoritative.
- Restoring a database backup reverts users, sessions versions, OTP history and recovery
  tokens to the backup point. Coordinate with Redis session flush depending on the
  incident.

## 11. Release gate

Before a production release, require all of the following to pass in CI:

- dependency install from `bun.lock`;
- API lint and typecheck;
- database lint, typecheck and `drizzle-kit check`;
- full API test suite against an isolated `fitpal_test` PostgreSQL and Redis;
- production build;
- Docker Compose validation and both production image builds;
- secret scanning/dependency audit if the platform already provides one.

The committed CD workflow is not yet usable: it references a missing `fly.api.toml`
and a placeholder repository guard. Treat deployment as a manual, approved operation
until the deployment target configuration is committed and verified.
