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
`400` messages. Successful login returns the same body/cookie as password login. A
verified phone with the configured mock SMS provider receives
`503 { error: "Verification delivery is unavailable" }`; the legacy email send path
keeps its existing `200` contract. No OTP or session token is ever returned by a send
endpoint.

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

### Client IP trust

The API uses the socket peer address as the client IP by default. `X-Forwarded-For`
is ignored unless `TRUSTED_PROXY_IP` names the exact immediate proxy peer; when it
does, the right-most valid forwarded address is used. No reverse proxy is configured
in the committed deployment files, so the safe default is direct socket IP. If a
platform injects a forwarding header, set `TRUSTED_PROXY_IP` to that proxy's address
or per-client limits degrade to the proxy IP. No-IP requests use the global counter,
never an identifier-only bucket.

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
