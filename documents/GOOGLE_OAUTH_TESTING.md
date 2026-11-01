# Google Sign-In (Mobile OAuth) — Setup & Testing

**Date:** November 1, 2026
**Branch:** `main` (commits `ed07039`, `f9bf11b`)
**Scope:** "Continue with Google" button on the mobile login screen — how the flow works, the localhost/simulator test recipe, and simulator-verified quirks about deep-link return schemes

## Overview

The backend already had the full Google OAuth endpoints, but no client had any UI for
it (the web app has no login page; the mobile login screen only offered
email/password + an unwired OTP button). This adds the button to
`apps/mobile/app/(auth)/login.tsx` and extends the backend so the OAuth result can
be returned to **the app** (deep link) instead of only to the web `CLIENT_URL`.

| File | Change |
| --- | --- |
| `apps/mobile/app/(auth)/login.tsx` | Google button + OAuth round-trip handler + query parser |
| `apps/mobile/src/components/ui/GoogleMark.tsx` | Inline SVG of the official Google "G" mark |
| `apps/mobile/src/lib/api.ts` | Export `API_URL` (used to open the consent URL) |
| `apps/api/src/services/auth.ts` | `generateGoogleOAuthUrl(deepLinkScheme?)`; return target encoded into OAuth `state` as `<nonce>~<scheme>`; `deepLinkSchemeFromState()` |
| `apps/api/src/routes/auth.ts` | `/auth/google` accepts `?scheme=`; callback redirects `<scheme>://auth/callback?token=<sessionId>`, else unchanged web redirect |
| `apps/mobile/package.json` | `expo-web-browser` (SDK 58-aligned) |

## How the flow works

```
Tap "Continue with Google"
      │
      ▼
openAuthSessionAsync(<API>/api/v1/auth/google?scheme=<scheme>, scheme)
      │  (ASWebAuthenticationSession on iOS, Custom Tabs on Android)
      ▼
API → 302 accounts.google.com/o/oauth2/v2/auth  (state = <nonce>~<scheme>)
      ▼
Google consent → Google 302 → localhost:3001/api/v1/auth/google/callback?code=…&state=…
      ▼
API: exchange code (GOOGLE_REDIRECT_URI is unchanged from the web flow),
     upsert user (match by googleId or email → link googleId, emailVerified=true),
     create Redis session
      ▼                      ┌─────────────────────────────┐
API → 302 scheme://auth/callback?token=<sessionId>   │ deep link back into the app │
                             └─────────────────────────────┘
      ▼
App captures the URL via (a) the auth-session promise result or (b) a
Linking 'url' listener — whichever fires first — stores the token in
SecureStore('auth_token'), routes to /(tabs).
```

The **web flow is untouched**: without `?scheme=` the callback keeps the legacy
`Set-Cookie` + `CLIENT_URL` redirect (`/dashboard` on success,
`/login?error=google_auth_failed` on failure).

Scheme selection adapts to the runtime (`expo-constants`):

| Runtime | Scheme | Why |
| --- | --- | --- |
| Expo Go | `exp` | Empirically verified: Expo Go 58.0.7 claims only `exp` |
| dev build / standalone | `fitpal` | Registered by `app.json` `scheme` in native builds |

### The `exp+fitpal` trap (verified, not assumed)

The older Expo Go advice of using `exp+<project-slug>` does **not** work on this
setup — the schemes were probed on the booted simulator with
`xcrun simctl openurl booted <url>`:

| URL | Result |
| --- | --- |
| `exp://auth/callback` | ✅ opened (exit 0) |
| `exp+fitpal://auth/callback` | ❌ `LSApplicationWorkspaceErrorDomain 115` — no handler |
| `fitpal://auth/callback` | ❌ no handler (no standalone build installed) |

iOS deep links resolve by **full scheme**, so `exp+fitpal://` can never be claimed
by an app that registers `exp`. Inside Expo Go the return rides `exp://`; the app
doesn't have to route it successfully — the browser-session promise still resolves
with the full URL and the handler parses the token from it.

## Prerequisites — Google Cloud Console (one-time)

1. **Credentials → your OAuth 2.0 Client (Web)** → *Authorized redirect URIs*
   must contain **exactly**:
   ```
   http://localhost:3001/api/v1/auth/google/callback
   ```
   Google accepts plain-`http` only for `localhost` — any other host needs https.
2. **OAuth consent screen**: while in *Testing* mode, add the Google account you
   will sign in with under *Test users*, otherwise login is blocked.
3. `.env` (gitignored): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback`,
   `CLIENT_URL=http://localhost:3000`.

Note that the `redirect_uri` stays the API callback for mobile too; only the
**final** redirect (after session creation) differs. No env changes were needed.

## Testing on localhost (iOS simulator)

The simulator shares the host's network, so `localhost:3001` (dockerised API) and
`localhost:8081` (Metro) resolve to the Mac — a **physical device would not**; it
needs `EXPO_PUBLIC_API_URL` pointed at the LAN IP.

1. Stack up (this session's docker compose already runs it):
   `cd docker && docker compose up -d`
2. In Expo Go on the simulator, **reload** the app (`r` in the expo terminal, or
   shake → Reload) so it fetches the updated bundle.
3. Login screen → **Continue with Google** → sign in with the test-user account →
   consent (_hit *Advanced → Go to FitPal* on the "unverified app" warning —
   normal in Testing mode).
4. Auto-return into the app → `/(tabs)` signed in. A routing hiccup screen may
   flash in Expo Go when the `exp://` URL opens — the token was already captured;
   dismiss and you are signed in.

### Verify it persisted

```bash
cd docker && docker compose exec postgres psql -U fitpal -d fitpal \
  -c "select email, google_id, avatar_url, created_at from users order by created_at desc limit 3;"
```

A `google_id` on your email row = full round-trip (code exchange + user upsert +
session). To re-run the redirect contract without touching Google:

```bash
curl -sI "http://localhost:3001/api/v1/auth/google?scheme=exp"          # → 302 accounts.google.com, state=…~exp
curl -sI "http://localhost:3001/api/v1/auth/google/callback?error=x&state=n~exp"  # → 302 exp://auth/callback?error=…
curl -sI "http://localhost:3001/api/v1/auth/google/callback?error=x"   # → 302 …localhost:3000/login?error=… (web, unchanged)
```

### Troubleshooting map

| Symptom | Cause → fix |
| --- | --- |
| Google error `redirect_uri_mismatch` mid-flow | Callback URI missing/different in the Google client → add it exactly as above |
| "Access blocked / this app has not completed verification" | Account not a Test user → add it, or publish the consent screen |
| Alert "Google did not authorize the session" | User denied consent, or `error` param came back → inspect `docker compose logs api` |
| Alert "No session was returned" | Callback scheme had no handler (scheme mismatch) or consent never reached the API |
| API logs `Google OAuth failed` with token exchange error | Client secret stale, or `redirect_uri_mismatch` on the code exchange |

## Design decisions & caveats

- **Session token in the deep-link URL**: the hand-off token is the session id
  (`<scheme>://auth/callback?token=<sessionId>`). This is the standard native
  trade-off without an OAuth proxy — it exists in *browser history* inside the
  auth session only, and any misappropriated URL would still land on the
  legitimate app scheme. Revisit if a web-proxy-based flow is added.
- **Scheme names only**: the server validates `scheme` against
  `^[a-zA-Z][a-zA-Z0-9+.-]{1,63}$` and builds the URL itself — a full URL can't
  be smuggled into the redirect.
- **`state` doubles as CSRF nonce**: format `<uuid>~<scheme>` (`~` can't appear
  in a UUID, so it's safe to split on).
- **Google consent inside the auth browser works** (ASWebAuthenticationSession
  presents a Safari-equivalent UA; Google's "disallowed_useragent" WebView block
  does not apply).
- **Smoothest dev loop**: build once with **`expo-dev-client`** — then `fitpal://`
  is registered natively and the return is seamless (no `exp://` bounce). Test
  users of a dev build also enable real-device testing via LAN IP.
- Login state uses the same `SecureStore` key as password login (`auth_token`);
  the current value is a marker string, not the bearer token itself — the API
  calls are cookie/session-aware only in web. If API-call auth for mobile is
  needed next, extend `createSession` to return a session id usable as a token
  and send `Authorization: Bearer` consistently.
