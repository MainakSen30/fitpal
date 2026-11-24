# FitPal authentication — Phase 5 login matrix

## Pre-implementation audit

The following table is a historical snapshot of the pre-Phase-5 baseline (commit
`322b93a`), not a description of current code. Later rows in this document record the
implemented Phase 5–8.7 behavior.

| Area | Existing behavior | Callers that depend on it |
| --- | --- | --- |
| Password login | `POST /api/v1/auth/login` accepted only `{ email, password }`. `loginWithPassword()` looked up by email, compared bcrypt, and rejected pending signup accounts. It did **not** check `emailVerified`. Every success called the shared `createSession()`. | `apps/web/lib/auth.ts`, `apps/mobile/app/(auth)/login.tsx`, API tests |
| OTP login | `POST /api/v1/auth/otp/send` accepted `{ email, purpose: "login" }`; `/otp/verify` accepted `{ email, code, purpose }`. The server mapped legacy `login` to engine purpose `email_login`. Unknown accounts returned generic success on send. There was no phone OTP login. | Older email OTP login clients, `apps/api/test/otp.test.ts` |
| OTP verification | All OTP state, cooldowns, quotas, locks, expiry, and atomic consumption live in `apps/api/src/services/otp/engine.ts`. Purposes are fixed by `PURPOSE_CHANNEL`; clients cannot supply arbitrary engine purposes today. | Phase 3/4 tests and all OTP routes |
| Sessions | Opaque UUID tokens with seven-day Redis lifetime; web HttpOnly cookie and mobile Bearer token; CSRF token created on login; `createSession()` rejects pending accounts. | Web/mobile apps, `requireAuth`, `/auth/me` |
| Google OAuth | `/auth/google` and `/auth/google/callback` had a client-round-tripped state and userinfo-only identity check; mobile received a live session token in the deep link. Pending password accounts could not be linked. | Web/mobile Google sign-in |
| Password rate limiting | None dedicated. Only the OTP engine's PostgreSQL limits and best-effort Redis IP limiter existed. | — |
| Login contacts | An account can hold email and phone independently; `emailVerified` and `phoneVerified` are independent. The UI does not yet consume verification screens. | Phase 4 signup/verification APIs |

No frontend or mobile caller sends a phone number to login today. To avoid forcing client
changes, the existing `email` field remains valid and a new `identifier` field is added.

Password/account recovery builds on these contracts; see
[`AUTH_RECOVERY.md`](./AUTH_RECOVERY.md) for its API, OTP purposes, atomicity, and
session-revocation design. Phase 7 OAuth state, OIDC validation, linking, and mobile
exchange are documented in [`AUTH_GOOGLE_OAUTH.md`](./AUTH_GOOGLE_OAUTH.md).

## Implemented API contract

### Password login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "identifier": "user@example.com", "password": "..." }
```

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "identifier": "+919876543210", "password": "..." }
```

Legacy shape remains valid:

```json
{ "email": "user@example.com", "password": "..." }
```

Exactly one of `identifier` or `email` is required. `identifier` is normalized as an
email (trim + lowercase) or an E.164 phone using the existing `normalizePhone()`
utility. No default country code is assumed. Invalid input, unknown accounts, wrong
passwords, Google-only accounts, unverified contacts, and pending accounts all return
the same generic `401 { error: "Invalid login credentials" }`.

Success is unchanged:

```json
{
  "user": { "id": "...", "email": "...", "name": "...", "avatarUrl": null },
  "token": "<opaque session UUID>"
}
```

The response also sets the existing session cookie and CSRF token.

### OTP login

```http
POST /api/v1/auth/otp/send
Content-Type: application/json

{ "identifier": "user@example.com" }
```

```http
POST /api/v1/auth/otp/send
Content-Type: application/json

{ "identifier": "+919876543210" }
```

```http
POST /api/v1/auth/otp/verify
Content-Type: application/json

{ "identifier": "+919876543210", "code": "123456" }
```

The server derives the channel and engine purpose from the normalized identifier and
stored verification flags: email -> `email_login`, phone -> `phone_login`. The legacy
`purpose: "login"` and `email` fields remain accepted and are treated as email login
when the legacy `email` field is used. `purpose: "email_verification"` retains its
existing later-verification behavior.

Unknown or unverified contacts receive `200 { success: true }` on send but no message
is issued. Wrong, expired, consumed, or cross-purpose OTPs never create a session and
receive a generic `401`; locked and rate-limited requests keep their existing Phase 3
`400` messages. Successful login returns the same body/cookie as password login. As of
Phase 8.5, `/otp/send` is uniformly generic: cooldowns, exhausted quotas, provider
failures (including mock SMS) and edge throttling all return `200 { success: true }`.
No OTP or session token is ever returned by a send endpoint.

### Password login rate limit

The limiter uses bounded 15-minute Redis counters:

- with a trustworthy client IP: a composite IP + hashed normalized-identifier counter,
  limit 5 attempts per window, plus an IP-only counter, limit 20 attempts per window;
- without a trustworthy client IP: one global counter, limit 20 attempts per window.

Only SHA-256 hashes appear in Redis keys. There is deliberately no identifier/account-
only counter, so an attacker targeting one identifier cannot keep another account
locked. Keys expire after 15 minutes. Redis failures fail open in the limiter, matching
the Phase 3 edge limiter; successful logins still require Redis to create a session and
return a generic error if session storage is unavailable. OTP limits remain in the
PostgreSQL engine and are independent.

**Success-counter policy (Phase 8.5):** the 5/IP+identifier and 20/IP password counters
count every attempt, including successful logins, to preserve the existing volume caps;
the PostgreSQL OTP `failedAttempts`/lockout counter is failure-only. The OTP verify IP
edge counter also counts successes as an absolute volume cap. Phase 8.5 makes the
`INCR`/`EXPIRE` pairs atomic in one Redis script so a failed TTL write cannot leak keys.

### Client IP trust

The API uses the socket peer address as the client IP by default. `X-Forwarded-For`
is ignored unless `TRUSTED_PROXY_IP` names the exact immediate proxy peer; when it
does, the right-most valid forwarded address is used. No reverse proxy is configured
in the committed deployment files, so the safe default is direct socket IP. If a
platform injects a forwarding header, set `TRUSTED_PROXY_IP` to that proxy's address
or per-client limits degrade to the proxy IP. No-IP requests use the global counter,
never an identifier-only bucket.

### Production configuration guard

`NODE_ENV=production` enables fail-fast validation in
`apps/api/src/config/production.ts`. Production refuses to start with missing secrets,
wildcard or non-HTTPS `CORS_ORIGIN`, unsafe mobile OAuth schemes, mock SMS, implicit
email providers, malformed URLs/ports, or non-TLS public database/Redis hosts. `REDIS_URL`
and `CORS_ORIGIN` no longer fall back to localhost defaults at runtime. `GET /readyz`
checks PostgreSQL and Redis; `GET /health` remains liveness-only. See
[`AUTH_PRODUCTION_READINESS.md`](./AUTH_PRODUCTION_READINESS.md).

### Phase 8.7 final consolidated capability matrix

Source is authoritative; this table reconciles web/mobile clients, the API, and the
evidence used to verify each capability. Status labels are the final audit labels:
**Code verified** (behaviour established from source/tests), **Configuration required**
(operator must supply values/topology), **External dependency** (provider/platform outside
the repository), **Deferred** (known gap with separate corrective work), and
**Unverified** (cannot be established locally).

| Capability | Web | Mobile | Verification behavior / evidence | Final status |
| --- | --- | --- | --- | --- |
| Password login | `POST /auth/login`; session cookie plus double-submit CSRF; web helper exists | Same endpoint; returned token stored in Expo `SecureStore` and sent as Bearer | Login/session/auth-journey tests; generic `401`; Redis login limiter and PostgreSQL session validation | **Code verified** |
| Email OTP login/send | `POST /auth/otp/send|verify`; no code returned; generic send response | Same API; Bearer session on verify | OTP engine DB tests; PostgreSQL authoritative cooldown/quota/lock; SMTP provider tests use fakes | **Code verified** backend; **Configuration required** SMTP values |
| Phone OTP login/send | Same API with E.164 identifier; production delivery returns a configuration failure | Same API; no usable code without a provider | Disabled-SMS provider test; mock provider never sends; no real provider exists | **External dependency** |
| Signup and progressive verification | Pending account gets no session until email/phone verification; web signup/verify UI is not complete | Mobile signup/recovery screens are not complete | Signup tests; server-derived purposes; one-time continuation-token resend handle | **Code verified** API; **Deferred** client screens |
| Google OAuth | Backend creates cookie session, CSRF token, redirects to `CLIENT_URL`; `/dashboard` and `/login` web routes are absent | Server-owned state, one-time exchange code, Bearer token in `SecureStore` | OIDC/nonce/state tests with local JWKS; live Google Console registration and device flow are local-unverified | **Code verified** backend; **Deferred** web routes; **External dependency** live OAuth |
| Cookie/CSRF session handling | `csrf_token` cookie echoed in `X-CSRF-Token`; host-only, non-HttpOnly, `Secure`, `SameSite=Lax` | Bearer requests are exempt; no CSRF cookie required | CSRF tests; token is reusable and not bound to a session or rotated | **Code verified** mechanism; **Deferred** session-bound hardening |
| Session validation and revocation | PostgreSQL-authoritative version check on every request; web logout calls `/auth/logout` | Bearer validation uses same path; `/auth/logout` exists but mobile sign-out only deletes the local token | Session-security tests; password change/reset increments `session_version` | **Code verified** API; **Deferred** mobile server-side logout |
| Password recovery | API sends generic response, never creates a session, revokes sessions on reset; reset screen absent | Same API; reset screen absent | Recovery tests; atomic OTP consume + password/version update | **Code verified** API; **Deferred** client screen |
| Production startup guard | `NODE_ENV=production` fail-fast validation before listen | Same API contract | `production-readiness` tests; config module loaded at `index.ts` before server start | **Code verified** guard; **Configuration required** values |
| Health and readiness | `/health` static liveness; `/readyz` checks PostgreSQL and Redis; Compose probes `/health` only | Same endpoints | Readiness tests; startup readiness in production; no continuous Compose `/readyz` probe | **Code verified** endpoints; **Configuration required** platform readiness probe |
| CSRF origin/proxy assumptions | Explicit CORS allowlist; `X-Forwarded-For` trusted only from exact `TRUSTED_PROXY_IP` | Not applicable to Bearer except shared rate-limit IP resolution | Client-IP and CORS tests; real proxy peer and published origins are deployment-specific | **Code verified** logic; **Configuration required** topology |
| PKCE S256 | Not implemented; server-owned state is single-use but not browser/app-bound | Not implemented | Source and OAuth documentation confirm deferral | **Deferred** |

### Phase 8.5 pre-lookup throttling

`authRoutes` installs one best-effort IP edge limiter before identifier-based work:
registration (5/10 min), plus a shared lookup budget (30/10 min) for signup verify/resend,
OTP send/verify, recovery send/reset, and the legacy forgot/reset-password endpoints.
This bounds unknown-identifier database probes that previously bypassed the OTP engine's
post-lookup limiter. Send-style endpoints keep their generic success response; verify/
reset endpoints return `429` when throttled. This limiter is fail-open by design because
PostgreSQL remains authoritative for OTP validity and quota.

### Phase 8.5 endpoint abuse audit

Every public auth route was reviewed. "Edge" means the new pre-lookup Redis limiter;
"engine" means PostgreSQL OTP state; "password" means the existing Redis login limiter;
"OAuth" means the new Redis initiation/failure limiters. All Redis window keys are
SHA-256 hashed and updated with one `INCR` + `EXPIRE` Lua script. No duplicate counter
was added where an existing engine or password counter already covered the risk.

| Endpoint | Limits and key family | Backing / failure mode | Concurrency, enumeration and resource notes |
| --- | --- | --- | --- |
| `GET /csrf` | None; cookie-sized response only | Stateless cookie | No account lookup or provider work. |
| `POST /register` | Edge `register` 5/10 min: `otp:ip:register:*` | Redis edge, fail-open | Bcrypt and DB insert happen only after the edge check; uniqueness violation stays 409. |
| `POST /signup/verify` | Edge `lookup` 30/10 min; engine verify 5 failures/lock | Redis edge fail-open; PostgreSQL engine authoritative | Atomic OTP consumption; generic failure. No session on failure. |
| `POST /signup/resend` | Edge `lookup` 30/10 min; engine send cooldown/quota | Redis edge fail-open; PostgreSQL engine authoritative | Continuation token capped at 256 chars; failed delivery no longer supersedes a live code. |
| `POST /verification/send`, `/verification/verify` | Engine send/verify `otp:ip:send`/`otp:ip:verify` 10/30 per 10 min | Redis edge fail-open; PostgreSQL engine authoritative | Requires a live session, so no unauthenticated enumeration. |
| `POST /otp/send` | Edge `lookup` 30/10 min; engine send cooldown/quota | Redis edge fail-open; PostgreSQL engine authoritative | Uniform `200` for unknown, unverified, throttled and failed delivery; no message for unknown contacts. |
| `POST /otp/verify` | Edge `lookup` 30/10 min; engine verify 5 failures/lock | Redis edge fail-open; PostgreSQL engine authoritative | Atomic consumption; generic `401`; successful login creates a session. |
| `POST /login` | Password 5/IP+identifier and 20/IP or 20/no-IP per 15 min | Redis, fail-open; bcrypt/DB decide identity | Attempt counting is atomic; generic `401`; no identifier-only bucket. |
| `GET /google` | OAuth initiation 10/IP and 60/global per 15 min: `oauth:init:*` | Redis, fail-closed | Uses trusted socket peer only; state/nonce are server-owned and Redis-backed. |
| `GET /google/callback` | OAuth failure 5/pair, 20/IP, 60/global per 15 min: `oauth:failure:*` | Redis, fail-closed | State is single-use via Lua `GETDEL`; valid codes do not consume the failure budget; generic redirect except 429. |
| `POST /google/exchange` | OAuth failure 5/pair, 20/IP, 60/global per 15 min | Redis, fail-closed | Exchange code is single-use and bound to scheme/client/session; valid exchanges do not consume failures. |
| `POST /recovery/send`, `/forgot-password` | Edge `lookup` 30/10 min; `/recovery/send` also uses engine send limits | Redis edge fail-open; PostgreSQL authoritative | Uniform `200`; no account existence or delivery detail in the response. The legacy link flow does not use the OTP engine. |
| `POST /recovery/reset`, `/reset-password` | Edge `lookup` 30/10 min; engine verify/token limits | Redis edge fail-open; PostgreSQL authoritative | Token precheck before bcrypt; conditional token claim plus session-version increment are atomic in PostgreSQL. |
| `GET /me`, `POST /logout`, `DELETE /account` | No new edge counter | Redis session + PostgreSQL authoritative validation for `/me` and `/account`; logout deletes the supplied token best-effort | Malformed records fail closed; DB failure does not destroy a Redis session; logout clears the cookie even when Redis deletion fails. |

## Verified-contact matrix

| Account state | Email/password | Phone/password | Email OTP | Phone OTP | Google OAuth |
| --- | --- | --- | --- | --- | --- |
| Email verified only | Yes | No | Yes | No | Preserved |
| Phone verified only | No | Yes | No | Yes | Preserved |
| Both verified | Yes | Yes | Yes | Yes | Preserved |
| Neither verified (pending) | No | No | No | No | No |
| Google-created (`emailVerified = true`) | Only if a password is set and email verified | Only if phone is set and verified | Only if email verified | Only if phone verified | Yes |

Google OAuth was hardened in Phase 7; see
[`AUTH_GOOGLE_OAUTH.md`](./AUTH_GOOGLE_OAUTH.md). The account-state rules above still
apply: pending accounts never get a session, and Google-only accounts stay passwordless.
Phase 8.3 enforces session eligibility centrally in `createSession()`/`validateSession()`;
see [`AUTH_RECOVERY.md`](./AUTH_RECOVERY.md) for the shared validation and revocation rules.
