# FitPal authentication — Phase 5 login matrix

## Pre-implementation audit

The following behavior was present before Phase 5 (commit `322b93a`):

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
| `POST /recovery/send`, `/forgot-password` | Edge `lookup` 30/10 min; engine send/token limits | Redis edge fail-open; PostgreSQL authoritative | Uniform `200`; no account existence or delivery detail in the response. |
| `POST /recovery/reset`, `/reset-password` | Edge `lookup` 30/10 min; engine verify/token limits | Redis edge fail-open; PostgreSQL authoritative | Token precheck before bcrypt; conditional token claim plus session-version increment are atomic in PostgreSQL. |
| `GET /me`, `POST /logout`, `DELETE /account` | No new edge counter; session lookup on every request | Redis session + PostgreSQL authoritative validation | Malformed records fail closed; DB failure does not destroy a Redis session; logout delete is best-effort. |

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
