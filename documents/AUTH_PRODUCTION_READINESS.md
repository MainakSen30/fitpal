# Authentication production readiness

Phase 8.6 audit and deployment guidance for the custom Hono/Drizzle authentication
stack. This document describes the code as it exists in this repository; anything that
requires real infrastructure or credentials is listed as an external prerequisite.

## Initial audit (before Phase 8.6 changes)

### Already production-ready

- Session cookies use `HttpOnly; Secure; SameSite=Lax; Path=/` with a seven-day
  `Max-Age` matching the Redis session TTL (`apps/api/src/lib/cookies.ts`).
- CSRF uses a double-submit token for cookie-authenticated mutations; Bearer requests
  are exempt and non-browser unsafe requests with a foreign `Origin` are rejected
  (`apps/api/src/middleware/csrf.ts`).
- `X-Forwarded-For` is ignored unless `TRUSTED_PROXY_IP` exactly matches the socket
  peer (`apps/api/src/lib/client-ip.ts`).
- Session validation is PostgreSQL-authoritative: `users.session_version` is checked
  on every request and malformed session records fail closed
  (`apps/api/src/services/auth.ts`).
- OAuth state, nonce, issuer, audience, RS256 signature, `email_verified`, redirect
  target, mobile scheme, and one-time exchange-code validation are unchanged from
  Phase 8.5 (`apps/api/src/services/google-oauth.ts`).
- OTP, reset-token and session-version operations use PostgreSQL transactions; Redis
  outages do not bypass OTP cooldowns, quotas or lockout
  (`apps/api/src/services/otp/engine.ts`, `apps/api/src/services/auth.ts`).
- Request logs use pathname only, so OAuth codes, state and nonce query values are not
  logged; unhandled errors log only the error class (`apps/api/src/app.ts`).
- Email failures are classified and logged as provider name plus reason; provider
  text, recipient and message body are not logged
  (`apps/api/src/services/email/email.service.ts`).
- Mock SMS never claims real delivery and never logs the destination, body or code
  (`apps/api/src/services/sms/providers/mock-sms.provider.ts`).
- Rate-limit counters use atomic `INCR`/`EXPIRE` Lua scripts and SHA-256 hashed keys
  (`apps/api/src/services/rate-limit-counter.ts`).
- `git diff --check`, API lint/typecheck/build, database lint/typecheck, and
  `drizzle-kit check` passed at the start of this phase.

### Development-only

- Gmail SMTP is the only implemented email provider and is documented as development-
  only (`documents/EMAIL_SMTP_SETUP.md`).
- `SMS_MODE=mock` is the only currently implemented SMS mode; it sends nothing.
- Expo Go's `exp` scheme is allowed in `.env.example`; it must not be in a production
  allowlist unless a production Expo Go build is deliberately required.
- `.env.example` contains local database, Redis, MinIO and Meilisearch defaults.
- `docker/docker-compose.yml` is a local stack with published database/Redis ports.
- Mobile logout removes only the SecureStore token and does not call `/auth/logout`;
  the server session remains valid until TTL or revocation.

### Unsafe defaults

- `REDIS_URL` silently falls back to `redis://localhost:6379`
  (`apps/api/src/lib/redis.ts`).
- `CORS_ORIGIN` silently falls back to two localhost origins
  (`apps/api/src/lib/origins.ts`).
- `EMAIL_PROVIDER` silently defaults to `gmail`
  (`apps/api/src/services/email/email.config.ts`).
- `PORT` accepts malformed values through `Number.parseInt`
  (`apps/api/src/index.ts`).
- `DATABASE_URL` is only checked for presence at module import
  (`apps/api/src/db/index.ts`); `drizzle.config.ts` has no runtime guard.
- Production Compose builds the wrong API image stage (`migrate`, the last stage of
  `Dockerfile.api`) and omits `OTP_PEPPER`, `SMS_MODE`, and all email/SMTP settings.
- Production Compose requires healthy Postgres/Redis services but defines no
  healthchecks for them (`docker/docker-compose.prod.yml`).
- Production Compose passes stale/unused `SESSION_SECRET`, `BETTER_AUTH_SECRET` and
  `BETTER_AUTH_URL` variables while omitting variables the API actually reads.
- The web image bakes `NEXT_PUBLIC_API_URL` at build time, but production Compose sets
  it only at runtime (`docker/Dockerfile.web`, `docker/docker-compose.prod.yml`).
- There is no `NODE_ENV` or equivalent mode detection, so production cannot reject
  mock/dev configuration.
- CSRF Bearer detection is case-sensitive (`Bearer `) while authorization parsing is
  case-insensitive; this is stricter, not weaker, but is inconsistent.
- The `csrf_token` is not bound to a session and is not rotated, relying on the
  host-only double-submit design rather than session binding.

### Requires deployment-specific configuration

- `DATABASE_URL`, including TLS mode, pool limits and migration execution path.
- `REDIS_URL`, including auth, TLS, timeouts, eviction policy and persistence.
- `OTP_PEPPER`, unique per environment and at least 32 characters.
- `CLIENT_URL`, `CORS_ORIGIN`, `GOOGLE_REDIRECT_URI`, `MOBILE_OAUTH_SCHEMES` and
  `TRUSTED_PROXY_IP`.
- `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD`, `EMAIL_FROM`, and a production reply-to address.
- A production-safe SMS choice. No real SMS provider is implemented, so phone OTP
  delivery requires a provider implementation before it can be enabled.
- Secret storage and injection; secrets must never be baked into images or docs.
- TLS termination ownership and the actual reverse-proxy peer address.
- Container platform health checks, restart policy and migration ordering.

### Cannot be verified without real infrastructure or credentials

- Actual Postgres host, credentials, TLS certificate trust, role privileges for
  `CREATE EXTENSION btree_gist`, current migration state, and backups.
- Redis endpoint auth/TLS, `maxmemory`/eviction policy, persistence and network path.
- Google Cloud Console OAuth client configuration, consent screen and exact redirect
  URI registration.
- Gmail/SMTP account validity, outbound network access, provider limits and delivery.
- Real SMS delivery: no real provider exists in the repository.
- Published origins behind the real proxy and the real `TRUSTED_PROXY_IP` value.
- Fly/Vercel settings. `.github/workflows/cd.yml` references a missing `fly.api.toml`
  and is gated on a placeholder repository name.
- Whether the Compose file or the platform CD workflow is the authoritative deploy
  path.

## Phase 8.6 configuration changes

- `apps/api/src/config/production.ts` performs a fail-fast check when `NODE_ENV=production`
  or `prod`. It validates variables without printing values. Errors name only the
  offending variable and category.
- `apps/api/src/index.ts` validates configuration, requires a valid `PORT`, connects
  Redis, checks PostgreSQL/Redis readiness, then starts the server.
- `apps/api/src/lib/redis.ts` no longer falls back to localhost. It requires
  `REDIS_URL` and sets bounded connect, command and retry limits.
- `apps/api/src/db/index.ts` sets explicit pool and timeout limits and exposes a close
  hook for graceful shutdown.
- `apps/api/src/lib/origins.ts` rejects wildcard, malformed and (in production)
  non-HTTPS CORS origins. `CORS_ORIGIN` must include `CLIENT_URL`.
- `apps/api/src/services/google-oauth.ts` validates the exact callback URL, rejects
  unsafe mobile schemes, rejects CLIENT_URL paths/queries/fragments, and bounds the
  Google token exchange request to 10 seconds.
- `apps/api/src/services/email/providers/gmail-smtp.provider.ts` sets bounded SMTP
  timeouts, pool limits, `requireTLS` for plaintext ports and an explicit reply-to.
- SMS gains an explicit `disabled` production mode. `mock` is rejected at production
  startup; disabled delivery returns a safe configuration failure and never activates
  an OTP.
- `GET /readyz` checks PostgreSQL and Redis with a two-second bound per dependency and
  returns only `{"status":"ready"}` or `{"status":"unavailable"}`. `GET /health` remains
  a static liveness probe.
- Graceful shutdown stops the HTTP server before closing PostgreSQL and Redis, with
  bounded best-effort cleanup.

## Production environment inventory

Values are supplied by the deployment secret manager or environment. Never commit them.

| Variable | Required | Validation / production rule |
| --- | --- | --- |
| `NODE_ENV` | Yes | Must be `production` to enable fail-fast validation. |
| `PORT` | Yes | Integer 1–65535. |
| `DATABASE_URL` | Yes | `postgres://` / `postgresql://`, host and database required; public DNS hosts require `sslmode=verify-full`. |
| `REDIS_URL` | Yes | `redis://` / `rediss://`; public DNS hosts require `rediss://`. |
| `OTP_PEPPER` | Yes | ≥32 chars, distinct from `JWT_SECRET`; rotation invalidates outstanding OTPs. |
| `SMS_MODE` | Yes | Must be `disabled` in production; `mock` is rejected. No real provider exists yet. |
| `EMAIL_PROVIDER` | Yes | Must explicitly select `gmail` today; no implicit default in production. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Yes | Non-empty; errors name keys only. |
| `SMTP_PORT`, `SMTP_SECURE` | Yes | Port 1–65535; boolean `true`/`false` (or `1`/`0`). |
| `REPLY_TO` | Yes | Explicit reply-to identity; no fallback to the development sender. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Yes | Required for token exchange and OIDC audience. |
| `GOOGLE_REDIRECT_URI` | Yes | Exact HTTPS callback `https://<api-host>/api/v1/auth/google/callback`; no query/fragment/userinfo. |
| `CLIENT_URL` | Yes | Bare HTTPS origin, no path/query/fragment; fixed web redirect target. |
| `MOBILE_OAUTH_SCHEMES` | Yes | Bare schemes only; `http`, `https`, `javascript`, `data` and `exp` must not be used in production unless deliberately required. |
| `CORS_ORIGIN` | Yes | Comma-separated exact HTTPS origins; no wildcard; must include `CLIENT_URL`. |
| `TRUSTED_PROXY_IP` | No | Exact immediate proxy peer IP when a trusted reverse proxy sets/sanitises `X-Forwarded-For`. |

`JWT_SECRET` is legacy and only checked for inequality with `OTP_PEPPER`. Stale
`SESSION_SECRET`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` variables were removed from
production Compose. Meilisearch is unused by the API and was removed from the production
Compose stack; other unused variables in `.env.example` remain development-only.

### Connection and migration configuration

- PostgreSQL uses postgres.js with `max: 10`, `idle_timeout: 30s`, `connect_timeout: 10s`.
  Public DNS database hosts must set `sslmode=verify-full` in `DATABASE_URL`; internal
  single-label service hosts rely on network isolation and must be documented by the
  deployment.
- Drizzle migrations are not run by the API process. Compose uses a one-shot `migrate`
  service and gates API startup on `service_completed_successfully`.
- `drizzle.config.ts` now refuses to run without a valid PostgreSQL URL. No migration
  was generated or applied in this phase.
- Redis uses one ioredis client with `connectTimeout: 5s`, `commandTimeout: 5s`,
  `maxRetriesPerRequest: 3` and a capped retry strategy.

## Provider safeguards

### Email

- Production requires explicit `EMAIL_PROVIDER=gmail`, SMTP credentials, sender and
  reply-to. There is no mock email fallback and no implicit Gmail default in production.
- Nodemailer uses a pooled transport with `connectionTimeout=10s`, `greetingTimeout=10s`,
  `socketTimeout=30s`, `maxConnections=5`, `maxMessages=100`, and `requireTLS` when
  `secure=false`.
- Provider failures are classified into `authentication`, `connection`, `rejected`,
  `temporary` or `unknown`. Logs include provider name and reason only. No OTP, reset
  token, recipient, subject or body is logged.
- Gmail SMTP remains a development-only provider. Production requires a verified-domain
  sender and a supported production provider before high-volume use.

### SMS

- `SMS_MODE=mock` is valid only in development/test. Production startup rejects it.
- `SMS_MODE=disabled` returns `{ status: "failed", reason: "configuration" }`; the OTP
  engine never activates a challenge on failed delivery and no success is reported.
- Real phone verification/recovery remains blocked until an `SmsProvider` implementation
  and mode are added behind the existing interface.

### Google OAuth

- Production requires client ID, client secret, exact HTTPS callback URI, HTTPS web
  origin and non-dangerous mobile schemes. `exp` is a development-only scheme.
- Issuer, audience, RS256 signature, nonce, `email_verified`, state single-use, scheme
  binding and one-time exchange-code validation are unchanged.
- OAuth request logs use pathname only; codes, state, nonce and tokens are never logged.
- Initiation throttling and failure throttling remain fail-closed and use the trusted
  client-IP resolver.
- PKCE remains deferred. Complete S256 needs a coordinated web/API/mobile cutover with
  a client-held verifier; an API-only verifier would not protect against replay.

## Cookie, CSRF, CORS and proxy assumptions

- Session cookies are host-only (`HttpOnly; Secure; SameSite=Lax; Path=/`) with a
  seven-day `Max-Age` matching the Redis session TTL. No `Domain` is set.
- CSRF uses double-submit tokens rather than session-bound tokens. The cookie is
  host-only, non-HttpOnly because the web client echoes it, `Secure`, and `SameSite=Lax`.
  Cross-site origin checks cover sessionless unsafe requests. Bearer requests remain
  exempt because a cross-site page cannot attach SecureStore-held tokens.
- CORS always uses an explicit array with `credentials: true`; wildcard is rejected.
  `Authorization` and `X-CSRF-Token` are allowed headers.
- `X-Forwarded-For` is used only when `TRUSTED_PROXY_IP` exactly matches the immediate
  socket peer. Set it to the proxy that actually connects to the API. If no proxy is
  configured, per-client limits use the socket IP and forwarded headers are ignored.
- TLS termination is the deployment platform's responsibility. Secure cookies require
  the published web origin to be HTTPS, even if the container itself listens on HTTP.
- API and web containers listen on all container interfaces. Host binding, reverse proxy
  placement and firewalling are deployment-specific.

## Redis and PostgreSQL failure behavior

| Function | Behavior |
| --- | --- |
| Session validation | Fail closed; PostgreSQL-version check on every request. |
| Session creation | Fail closed; an unusable session is not issued when Redis storage fails. |
| Logout | Clear the client cookie; Redis delete is best-effort. |
| Password login limiting | Existing documented fail-open behavior; Redis is not authoritative for identity. |
| OTP authoritative state | PostgreSQL remains authoritative for cooldown, quota, attempts and locks. |
| OTP IP edge limit | Existing documented fail-open behavior. |
| OAuth throttling | Fail closed. |
| OAuth state/exchange | Fail closed; state and exchange codes live only in Redis. |
| Readiness | `/readyz` returns 503 when either dependency is unavailable. |

Redis production requirements: use password auth and TLS for non-local hosts; set
`maxmemory` with a policy that does not evict live session or OAuth keys (`noeviction`
or a carefully sized `volatile-*` policy); enable persistence if sessions must survive a
Redis restart, accepting the slower failover and possible replay window. Session records
live 7 days, session-version cache 60s, OAuth state 10 minutes, mobile exchange codes
60s, login/OAuth/OTP counters 10–15 minutes. Redis loss invalidates sessions and OAuth
state; PostgreSQL still holds OTP and recovery authority.

## Logging, monitoring and alerts

Existing logs are unstructured but deliberately minimal: request method/pathname/status,
error class, email provider/reason, and generic cache/database warnings. No metric or
alerting stack exists in the repository; use the platform's log-based alerting.

Recommended log-based alerts (no user identifiers in labels):

- sustained API 5xx rate above baseline;
- repeated `429` responses or a sharp rise in auth failures;
- `[email] delivery failed` (especially reason `authentication` or `connection`);
- readiness failures reported by the platform probe;
- Redis or PostgreSQL connection failures from the platform dependency view;
- any production startup failure mentioning mock SMS, wildcard CORS or missing secrets.

Operational events to track when adding structured logging later: login success/failure,
OTP send/verify/delivery, recovery request/reset/failure, OAuth initiation/callback/
exchange, rate-limit rejection, session validation failure, and provider latency. Keep
tokens, codes, passwords, message bodies, emails, phones and IPs out of logs and labels.

## Health checks

- `GET /health`: static liveness. Use it for process restart decisions only.
- `GET /readyz`: checks PostgreSQL and Redis with a two-second bound per dependency and
  returns a minimal generic status. Use it for load-balancer/orchestrator readiness.
- Do not expose dependency addresses, versions or connection details through an external
  diagnostics endpoint.

## Known limitations and external prerequisites

- Runtime images still include the workspace `node_modules` tree because Bun's isolated
  layout and the native bcrypt addon need validated re-rooting. Pruning dev dependencies
  requires a separate image build change and was not done here.
- No real SMS provider exists; phone-first production flows remain blocked.
- Gmail SMTP is development-only; a production provider with a verified domain is an
  external prerequisite.
- Live Google OAuth, SMTP delivery, Redis/Postgres TLS, proxy IP and platform health
  checks cannot be verified from this repository.
- The CD workflow still references a missing `fly.api.toml` and a placeholder repository
  guard. Release gating is documented in
  [`AUTH_DEPLOYMENT_RUNBOOK.md`](./AUTH_DEPLOYMENT_RUNBOOK.md); fix the deployment target
  before enabling CD.
- Mobile logout does not call `/auth/logout`; the server session remains valid until TTL
  or revocation. Mobile signup/recovery screens and cold-start deep-link handling also
  need client work outside this phase.
- Web routes `/dashboard` and `/login` are not present in `apps/web/app`; OAuth web
  redirects require those client routes.
- PKCE remains deferred as described above.
