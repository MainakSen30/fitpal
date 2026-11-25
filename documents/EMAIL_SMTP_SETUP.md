# FitPal Email (Gmail SMTP, development)

FitPal sends authentication emails through a provider-independent email service in
`apps/api/src/services/email/`. The current provider is Gmail SMTP via Nodemailer.

> Gmail SMTP is for development and initial testing only. It is **not** the intended
> long-term production email provider. Move to Resend (or another transactional
> provider) once FitPal has a verified sending domain.

## What uses email today

| Flow | Endpoint | Template |
| --- | --- | --- |
| Signup email verification | `POST /api/v1/auth/register` with `verificationChannel: "email"` | `templates/signup-verification.ts` |
| Later email verification | `POST /api/v1/auth/verification/send` | `templates/otp.ts` |
| Legacy email verification OTP | `POST /api/v1/auth/otp/send` with `purpose: "email_verification"` | `templates/otp.ts` |
| OTP login | `POST /api/v1/auth/otp/send` with `identifier` (or legacy `email`) and `purpose: "login"` | `templates/otp.ts` |
| Password recovery code | `POST /api/v1/auth/recovery/send` | `templates/password-recovery-code.ts` |
| Legacy password-reset link (deprecated) | `POST /api/v1/auth/forgot-password` | `templates/password-reset.ts` |

Email delivery is awaited in the request path. Authentication endpoints still answer
generically on delivery failure to avoid account enumeration; internal service callers
receive typed delivery errors. Email OTPs are issued and verified by the centralized
engine in `apps/api/src/services/otp/`. The legacy `email` and `purpose` fields still
work; `identifier` additionally accepts an E.164 phone, and the server derives the OTP
channel from the normalized identifier. See
[`AUTH_LOGIN_MATRIX.md`](./AUTH_LOGIN_MATRIX.md) for the full login contract and
[`AUTH_RECOVERY.md`](./AUTH_RECOVERY.md) for recovery, session revocation, and the
deprecated link flow.

The code-based email templates cover signup verification, email login, later email
verification and password recovery. All four are wired into routes; recovery uses the
`password_recovery` purpose and never returns a code or session from an endpoint.

## 1. Enable Google 2-Step Verification

App Passwords only exist when 2-Step Verification is on.

1. Sign in to the FitPal support account: `support.fitpal@gmail.com`.
2. Open <https://myaccount.google.com/security>.
3. Under **How you sign in to Google**, enable **2-Step Verification**.
4. Complete the verification steps.

## 2. Generate a Google App Password

1. Open <https://myaccount.google.com/apppasswords> (or Security → 2-Step Verification → App passwords).
2. Create an app password named something like `FitPal API (local dev)`.
3. Copy the 16-character password Google shows. It is displayed only once.

Use this **App Password** for `SMTP_PASSWORD`. Do **not** use the normal Gmail
account password. Google may display the password with spaces; either form works,
but removing the spaces is safest.

## 3. Configure environment variables

Add these to the untracked root `.env` (the API loads it with `--env-file=../../.env`):

```env
EMAIL_PROVIDER=gmail

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support.fitpal@gmail.com
SMTP_PASSWORD=your-16-character-app-password

EMAIL_FROM=FitPal <support.fitpal@gmail.com>
REPLY_TO=FitPal <support.fitpal@gmail.com>
```

`REPLY_TO` falls back to `EMAIL_FROM` in development, but production startup requires
it explicitly. The SMTP transport uses 10-second connect/greeting timeouts, a 30-second
socket timeout, a small connection pool, and `requireTLS` for plaintext ports. Provider
errors are logged as provider name plus category only.

`CLIENT_URL` (already configured) is used to build password reset links:
`<CLIENT_URL>/reset-password?token=...`.

Rules:

- Never commit `.env` or real credentials. `.env` is already git-ignored.
- SMTP credentials are only read by the API. Never expose them to web or mobile clients.
- Do not put credentials in source code, tests, logs or documentation.
- If a password is exposed, revoke it in the Google account and generate a new one.

If a required value is missing, the API returns a clear configuration error naming the
missing variables (never their values). SMTP configuration is loaded lazily on the
first email send, so the API still starts and unrelated tests still run without it.

## 4. Test delivery locally

With the API running and the variables above set:

```bash
curl -X POST http://localhost:3011/api/v1/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-personal-inbox@example.com","purpose":"email_verification"}'
```

You should receive a 6-digit code at that address. The code expires after 10 minutes.
For password reset, call:

```bash
curl -X POST http://localhost:3011/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-account-email@example.com"}'
```

Check the inbox for the reset link (it expires after 1 hour).

Automated tests never call Gmail. They inject a fake transport at the provider
boundary and use no SMTP credentials or network access:

```bash
cd apps/api
bun test test/email.test.ts test/email-auth-flows.test.ts
```

## 5. Gmail limits and development-only restrictions

Gmail SMTP is not built for application traffic:

- Consumer Gmail accounts are limited to roughly **500 recipients per day** (Workspace
  accounts roughly 2,000; Google's limits can change).
- Sending bursts or suspicious patterns can be throttled, blocked or cause the account
  to be temporarily locked.
- Mail is sent from a `@gmail.com` address, which is not a FitPal domain. Authentication
  results (SPF/DKIM/DMARC alignment) are Gmail's, and deliverability/reputation are shared.
- No bounce/complaint webhooks, delivery analytics, templates API or dedicated support.
- App Passwords require 2-Step Verification and can be revoked at any time.
- Never ship the development App Password to staging or production.

## 6. Replacing Gmail SMTP with Resend

The authentication services depend on `email.service.ts` functions, not Nodemailer.
Templates and business logic stay the same.

1. Buy and verify a FitPal domain in Resend (add the SPF/DKIM records it provides).
2. Implement `EmailProvider` in `providers/resend.provider.ts`.
3. Add a `resend` branch in `getEmailProvider()`.
4. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...` and change `EMAIL_FROM` to an
   address on the verified FitPal domain.
5. Remove Gmail SMTP settings from deployment environments.

No authentication flow, token rule or template needs to change.

## 7. OTP HMAC pepper

The OTP engine hashes every six-digit code with HMAC-SHA256 and a dedicated
`OTP_PEPPER`. Generate a unique value for each environment (for example,
`openssl rand -hex 32`) and set it in the API environment. It must be at least
32 characters and must never reuse another application secret.
There is no default: the API fails at startup if it is missing or too short.

The HMAC input is bound to the challenge ID, account ID, normalized destination,
channel, purpose and code. Codes and hashes are never logged. If `OTP_PEPPER` is
rotated, all outstanding OTPs become invalid immediately; users must request new
codes. Store the pepper in the deployment secret manager, not in source control.

The API also applies best-effort Redis IP limits with keys
`otp:ip:send:<sha256(ip)>:<10-minute-window>` and
`otp:ip:verify:<sha256(ip)>:<10-minute-window>` (10 sends / 30 verifications per
window). PostgreSQL remains authoritative for account-level cooldowns, quotas,
attempts and locks; if Redis is unavailable those edge limits fail open.

The IP is the socket peer address by default. `X-Forwarded-For` is ignored unless
`TRUSTED_PROXY_IP` is set to the exact immediate proxy peer; when trusted, the
right-most valid forwarded address is used. Requests with no trustworthy IP skip the
edge limiter rather than creating an identifier-only bucket. See
[`AUTH_LOGIN_MATRIX.md`](./AUTH_LOGIN_MATRIX.md#client-ip-trust).

## 8. SMS delivery (mock locally, disabled in production)

SMS lives in `apps/api/src/services/sms/`. No real SMS provider or credentials are
configured. `SMS_MODE=mock` is for local development and tests only; production
startup rejects it. Production must set `SMS_MODE=disabled`, which returns a clear
configuration failure on delivery instead of claiming success. A missing value or any
unsupported value fails with a configuration error rather than silently switching to
mock delivery.

The mock provider returns `{ status: "mock" }`, which is explicitly **not** real
delivery. It does not send anything, log message contents, or expose OTPs in console
output or errors. Tests inject an in-memory sink at the provider boundary to inspect
messages; that sink does not exist at runtime.

When a real provider is chosen, implement `SmsProvider` and add a mode to
`createSmsProvider()`. OTP callers use `sendOtpSms()` and do not need to change.

## 9. Signup and progressive verification

Normal registration now requires `name`, `email`, `phone`, `password` and a
`verificationChannel` of `email` or `sms`. It creates an unverified account and
starts a signup-purpose OTP through the Phase 3 engine. No session, cookie or token
is created until one contact has been verified. See `apps/api/src/services/signup.ts`.

API contract:

| Endpoint | Request | Success response |
| --- | --- | --- |
| `POST /api/v1/auth/register` | `{ name, email, phone, password, verificationChannel }` | `202 { verificationRequired: true, channel, userId }` |
| `POST /api/v1/auth/signup/verify` | `{ userId, channel, code }` | `200 { user, token }` plus the existing session cookie |
| `POST /api/v1/auth/signup/resend` | `{ userId }` or `{ continuationToken }` | `200 { verificationRequired: true, channel, userId }` |
| `POST /api/v1/auth/verification/send` (authenticated) | `{ channel }` | `200 { success: true, alreadyVerified }` |
| `POST /api/v1/auth/verification/verify` (authenticated) | `{ channel, code }` | `200 { user, alreadyVerified }` |

Purposes are isolated: signup uses `signup_email_verification` /
`signup_phone_verification`, and later verification uses `email_verification` /
`phone_verification`. Login OTPs cannot verify signup, and the resend endpoint derives
the original channel from stored OTP state; the client cannot switch channels by
calling registration or resend again.

A pending account is an account with `emailVerified === false` and
`phoneVerified === false` that still owns a signup challenge. Registration inserts a
non-active marker challenge in the same transaction as the user row, so there is no
window where the account exists without pending state. The marker can never be used as
an OTP. `createSession()`, `requireAuth` and password/password-OTP login all reject
pending accounts. Google-created accounts have `emailVerified = true` and are not
pending; a pending password account is not linked or authenticated by the Google
callback.

Pending accounts are not deleted or auto-cleaned in this phase. They remain unusable
until a contact is verified, and a real SMS provider must be configured before a
phone-first account can receive a code. A failed initial delivery returns
`503 { error: "Verification delivery is unavailable", continuationToken }`. The token
is an opaque, one-time resend handle: only its SHA-256 hash is stored on the pending
marker, it expires after 24 hours, and it cannot verify an account, create a session,
or be used as a login identifier. Clients resume with
`POST /auth/signup/resend { continuationToken }`; a successful resend returns the
`userId` and invalidates the token. Repeated delivery failures rotate the token.
All resends still go through the Phase 3 cooldown, quota and lock checks. No OTP is
ever returned by an endpoint.

## Known limitations

- Email OTP challenges are created as `pending` and only become verifiable after
  delivery succeeds; failed deliveries leave no usable OTP. Deprecated password-reset
  tokens are still inserted before the email is sent, but the route now answers
  generically and the token is one-time and expiring.
- Neither the web app nor the mobile app currently has a screen that consumes the
  password-reset link at `/reset-password?token=...`. The reset API and email exist;
  the landing screen still needs to be implemented.
- Email delivery is awaited in the request path. There is no queue or background worker.
