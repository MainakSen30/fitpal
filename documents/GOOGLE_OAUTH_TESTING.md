# Google Sign-In — setup and testing

**Scope:** backend OAuth contract, local simulator recipe, and the deep-link quirks
verified during earlier mobile testing. The backend was hardened in Phase 7; the mobile
screen still needs to adopt the one-time exchange endpoint. See
[`AUTH_GOOGLE_OAUTH.md`](./AUTH_GOOGLE_OAUTH.md) for the security design and exact API
contracts.

## Current flow

```
Tap "Continue with Google"
       │
       ▼
GET /api/v1/auth/google?scheme=<allowlisted-scheme>   (mobile)
GET /api/v1/auth/google                              (web)
       │
       ▼
API creates an opaque random state + separate OIDC nonce, stores a hash of the state
in Redis for 10 minutes with the client type and validated redirect target, then
redirects to Google with `state` and `nonce`.
       ▼
Google redirects to GOOGLE_REDIRECT_URI with `code` + `state`.
       ▼
API atomically consumes the state, verifies the signed ID token (issuer, audience,
expiry, nonce, verified email), links/creates the user, and creates a normal session.
       ▼
Web: 302 to CLIENT_URL/dashboard with the existing HttpOnly cookie and CSRF token.
Mobile: 302 to <validated-scheme>://auth/callback?code=<one-time-exchange-code>.
       ▼
Mobile POSTs { code, scheme } to /api/v1/auth/google/exchange and receives the
existing opaque Bearer session token. No live session token is put in a URL.
```

The callback ignores `scheme`, `return_to`, `redirect`, and similar query parameters.
Only the server-side state record can select the redirect target.

## Scheme selection (current mobile implementation)

| Runtime | Scheme | Why |
| --- | --- | --- |
| Expo Go | `exp` | Expo Go 58 claims only `exp`; `exp+fitpal` is not claimable. |
| dev build / standalone | `fitpal` | Registered by the app's native scheme configuration. |

Both must be listed in `MOBILE_OAUTH_SCHEMES` during local development. A production
build should normally allow only `fitpal`.

### The `exp+fitpal` trap (verified, not assumed)

iOS deep links resolve by full scheme. `exp+fitpal://` cannot be claimed by an app that
registers `exp`. Probe with `xcrun simctl openurl booted <url>` if a scheme change is
needed.

## Prerequisites

1. Google Cloud Console → OAuth 2.0 Client (Web) → *Authorized redirect URIs* must
   contain the exact value of `GOOGLE_REDIRECT_URI`. For local docker compose that is
   `http://localhost:3011/api/v1/auth/google/callback`; for a directly run API it is
   usually `http://localhost:3001/api/v1/auth/google/callback`. Plain `http` is accepted
   only for `localhost`; other hosts need https.
2. OAuth consent screen in Testing mode: add every Google account used for testing.
3. `.env` (gitignored): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`, `CLIENT_URL`, and `MOBILE_OAUTH_SCHEMES=exp,fitpal`.
4. Redis 7 is required for atomic `GETDEL` state/exchange-code consumption.

## Local testing on the iOS simulator

1. Start the stack: `cd docker && docker compose up -d`.
2. Reload the Expo app so it picks up the latest bundle.
3. Login screen → **Continue with Google** → choose a test user → consent.
4. The backend callback returns a one-time `code` to the app scheme. The current mobile
   screen still reads `token`, so it will report "No session was returned" until the
   client is updated to call `/auth/google/exchange`. This is an expected backend/client
   contract gap for Phase 7.
5. After the client update, the exchange response token is stored in `SecureStore` and
   sent as `Authorization: Bearer <token>`.

### Verify persistence

```bash
docker compose exec postgres psql -U fitpal -d fitpal \
  -c "select email, google_id, email_verified, password_hash from users order by created_at desc limit 3;"
```

A `google_id` on the email row means the verified ID-token flow linked/created the
account; `password_hash` stays null for Google-only accounts.

```bash
curl -sI "http://localhost:3011/api/v1/auth/google?scheme=exp"
curl -sI "http://localhost:3011/api/v1/auth/google?scheme=evil"          # 400
curl -sI "http://localhost:3011/api/v1/auth/google/callback?state=bad"   # web login error
```

## Troubleshooting map

| Symptom | Cause → fix |
| --- | --- |
| `redirect_uri_mismatch` | Callback URI missing/different in Google Console; add the exact `GOOGLE_REDIRECT_URI`. |
| "Access blocked / app not verified" | Account not a Test user, or consent screen not published. |
| `Invalid OAuth redirect target` | `scheme` is malformed or not in `MOBILE_OAUTH_SCHEMES`. |
| Immediate login error after callback | State expired/replayed, ID token invalid, or email not verified by Google. |
| `Invalid or expired Google exchange code` | Exchange code reused, expired (>60s), or used with the wrong scheme. |
| `Missing required environment variable` | One of the OAuth/CLIENT_URL variables is unset; check API env, never commit secrets. |

## Automated tests

`apps/api/test/google-oauth.test.ts` uses a local JWKS server, generated RSA keys, and
fake Google token responses. It makes no live Google requests. No authorization codes,
ID tokens, exchange codes, or session tokens are logged.
