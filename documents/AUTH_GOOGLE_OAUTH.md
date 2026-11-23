# FitPal Google OAuth and account linking (Phase 7)

Phase 7 hardens the backend Google sign-in flow. It is backend-only: no web or mobile UI
was changed. The mobile client must later adopt the one-time exchange contract described
below. See [`GOOGLE_OAUTH_TESTING.md`](./GOOGLE_OAUTH_TESTING.md) for local setup and
simulator notes, and [`AUTH_LOGIN_MATRIX.md`](./AUTH_LOGIN_MATRIX.md) for the rest of the
authentication surface.

## Root causes fixed

- OAuth `state` was client-round-tripped and embedded the redirect scheme;
  `deepLinkSchemeFromState()` trusted that embedded value.
- `handleGoogleCallback()` used Google userinfo as proof of identity and did not require
  the OIDC `email_verified` boolean claim.
- Account lookup used `googleId OR email`, allowing risky automatic linking.
- Mobile received a live session token in `fitpal://auth/callback?token=...`.
- `signState()` / `verifyState()` existed but were unused, and `JWT_SECRET` had a
  hard-coded fallback.

All of those paths were removed or replaced by the single implementation in
`apps/api/src/services/google-oauth.ts`.

## Storage decision

Redis 7 is used for both short-lived records. No database migration was added.

- OAuth state: `oauth:state:<sha256(state)>`, TTL 600 seconds.
- Mobile exchange code: `oauth:exchange:<sha256(code)>`, TTL 60 seconds.

Raw state and raw exchange codes never appear in Redis keys or logs. Redis `GETDEL`
provides atomic one-time consumption; if Redis cannot store or consume a record, OAuth
fails closed. The trade-off is that OAuth state is process-independent but not durable
across a Redis outage, which is acceptable for a 10-minute login handshake and avoids a
new table/migration. A PostgreSQL implementation would also work with
`DELETE ... RETURNING`, but would add durable state for a transient flow.

Session records and the Phase 6 session-version cache remain unchanged.

## OAuth state and OIDC nonce

`GET /api/v1/auth/google` accepts only an optional `scheme` query parameter.

1. If `scheme` is absent, the fixed `CLIENT_URL` is validated and stored as the web
   target.
2. If `scheme` is present, it must be a bare scheme matching
   `^[a-zA-Z][a-zA-Z0-9+.-]{1,63}$` and must be listed in `MOBILE_OAUTH_SCHEMES`.
   The stored target is exactly `<scheme>://auth/callback`.
3. The API generates two independent values with `crypto.randomBytes(32)` encoded as
   base64url: an opaque `state` and an OIDC `nonce`.
4. Only `sha256(state)` is the Redis key. The value contains the client type, validated
   redirect target, and nonce.
5. The authorization URL includes `state` and a separate `nonce` parameter.

`GET /api/v1/auth/google/callback` never reads a routing parameter from the query string.
It validates the shape of `state`, then atomically `GETDEL`s the hashed key before doing
anything else. Missing, malformed, expired, replayed, tampered, or concurrently consumed
state fails safely. The consumed record is revalidated against current configuration; a
configuration change invalidates in-flight flows rather than redirecting somewhere else.

The OIDC `nonce` claim is compared to the stored nonce after signature verification.
OAuth state is never used as a substitute for nonce validation.

## Google ID-token verification

The backend uses `jose` with Google's published JWKS, defaulting to
`https://www.googleapis.com/oauth2/v3/certs`. Tests inject a local JWKS URL through the
service factory; there is no production environment override. It does not hand-roll JWT
signature verification and does not use Google userinfo as proof of identity.

Validation includes:

- RS256 signature against Google's published keys;
- issuer in `https://accounts.google.com` / `accounts.google.com`;
- audience equals `GOOGLE_CLIENT_ID`;
- `exp`, `iat`, `nbf` (when present), and a maximum token age of one hour;
- required `nonce`, `exp`, `email`, and `email_verified` claims;
- OIDC nonce equals the state record's nonce;
- non-empty string `sub`;
- syntactically valid, normalized email;
- `email_verified === true` strictly — string `"true"`, `1`, and missing claims are
  rejected.

The token endpoint must return an `id_token`. A missing or malformed token fails the
flow. No authorization code, ID token, access token, refresh token, or full identity
payload is logged. The app's request logger now logs pathnames only, so OAuth query
values cannot leak through it.

Userinfo is deliberately not called. If a test fetch stub returns conflicting userinfo,
it is ignored; only verified ID-token claims populate the account.

## Account-linking policy

The account model is unchanged: email is required and unique; phone is nullable and
unique; `emailVerified` and `phoneVerified` are independent; `passwordHash` may be null.

Resolution order:

1. **Verified Google `sub` first.** If an account is linked to that `sub`, authenticate
   it. The stored email must still equal the verified Google email; a mismatch fails
   closed instead of silently rewriting identity data.
2. **Verified email second.** If no `sub` match exists, look up the normalized verified
   email. A pending signup account is rejected. An account already linked to a different
   `sub` is rejected. Otherwise a conditional
   `UPDATE ... WHERE googleId IS NULL` links the `sub`, sets `emailVerified = true`
   (upgrade only), and preserves password hash, phone, verification flags, and all other
   user data.
3. **New account.** If neither exists, insert a user with the verified email,
   `googleId = sub`, `emailVerified = true`, `phone = null`, `phoneVerified = false`,
   and `passwordHash = null`.

Concurrency protection:

- the conditional update links an email only once;
- the unique constraints on `email` and `googleId` are the final arbiters;
- a unique violation triggers a re-read by `sub` and then by email instead of creating a
  duplicate;
- two callbacks for the same verified email can both authenticate the same linked user,
  but never create two users or link one `sub` to two accounts.

Google-only accounts cannot gain a password through password login, OTP login, or
Phase 6 recovery because those flows require an existing `passwordHash`.

## Redirects and environment

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OIDC audience and token-exchange client ID. |
| `GOOGLE_CLIENT_SECRET` | Token exchange secret. |
| `GOOGLE_REDIRECT_URI` | Single API callback URI registered in Google Cloud Console. |
| `CLIENT_URL` | Fixed web base URL; callback ignores browser-supplied return URLs. |
| `MOBILE_OAUTH_SCHEMES` | Comma-separated bare-scheme allowlist, e.g. `exp,fitpal`. |

All OAuth variables are validated when OAuth is invoked. Missing or invalid configuration
returns a generic failure and is never echoed with its value.

Google Cloud Console must list the exact `GOOGLE_REDIRECT_URI`. For local docker compose
this is currently `http://localhost:3011/api/v1/auth/google/callback`; a directly run API
may use `http://localhost:3001/api/v1/auth/google/callback`. Plain `http` is only valid
for `localhost`; production needs https. Put these values in the environment/secret
manager, never in source control.

The production Compose file forwards the OAuth variables and `MOBILE_OAUTH_SCHEMES`.
Local Compose uses `.env`. See `.env.example` and `GOOGLE_OAUTH_TESTING.md`.

## Mobile one-time exchange

The previous deep-link callback exposed a live session token in the URL; that contract
was removed. The callback now returns only a short-lived exchange code:

```text
<validated-scheme>://auth/callback?code=<43-char-base64url-one-time-code>
```

The callback creates the normal session first, then stores a hash of a fresh 32-byte
exchange code in Redis for 60 seconds with the user ID, session ID, and validated
scheme. If storing that record fails, the newly created session is destroyed.

Exchange endpoint:

```http
POST /api/v1/auth/google/exchange
Content-Type: application/json

{ "code": "<one-time-code>", "scheme": "fitpal" }
```

Success:

```json
{ "token": "<existing-opaque-session-uuid>" }
```

The token is the same Bearer token used by mobile password/OTP login. The endpoint does
not set a web cookie and does not create a second session. Client type and scheme are
validated atomically with deletion in a Redis Lua script, so a wrong-scheme or
wrong-client attempt leaves the code usable. On success the code is atomically deleted;
a replay, expired code, malformed code, or revoked session returns a generic 400. Redis
failure returns 500. Only the first valid exchange can obtain the token.

Web callbacks keep creating the session, setting the existing HttpOnly cookie, creating
the CSRF token, and redirecting to `${CLIENT_URL}/dashboard`. Failures redirect to
`${CLIENT_URL}/login?error=google_auth_failed`; a valid mobile state redirects to the
stored scheme with `?error=google_auth_failed`.

## Session compatibility

Phase 7 calls the same `createSession()` used by password and OTP login. Sessions still
have a seven-day Redis TTL, capture `users.session_version`, work as web cookies or
mobile Bearer tokens, and are rejected by Phase 6 version checks. The documented 60-second
cache fallback limitation is unchanged: no database query was added to every protected
request. Pending accounts still cannot get sessions, and account deletion/logout are
unchanged.

## Failure behavior and limitations

- A failed or expired state requires restarting sign-in; the authorization code is not
  exchanged.
- OAuth state is not durable across Redis loss.
- The mobile client now calls the exchange endpoint; live device/simulator verification
  was not part of the automated Phase 8.2 checks.
- SMS delivery and live Google OAuth were not tested; automated tests use a local JWKS
  server, generated keys, and fake token responses.
- No database tables were changed. Migration `0011` from Phase 6 remains the latest.
