# FitPal Email (Gmail SMTP, development)

FitPal sends authentication emails through a provider-independent email service in
`apps/api/src/services/email/`. The current provider is Gmail SMTP via Nodemailer.

> Gmail SMTP is for development and initial testing only. It is **not** the intended
> long-term production email provider. Move to Resend (or another transactional
> provider) once FitPal has a verified sending domain.

## What uses email today

| Flow | Endpoint | Template |
| --- | --- | --- |
| Email verification OTP | `POST /api/v1/auth/otp/send` with `purpose: "email_verification"` | `templates/otp.ts` |
| OTP login | `POST /api/v1/auth/otp/send` with `purpose: "login"` | `templates/otp.ts` |
| Password reset | `POST /api/v1/auth/forgot-password` | `templates/password-reset.ts` |

OTP and reset-token generation, hashing, expiry, attempts and validation are unchanged.
Emails are sent from the same request handler (awaited) so a provider rejection is
returned to the caller instead of being reported as success.

Code-based templates also exist for signup verification, email login, later email
verification and password recovery. They are delivery primitives for upcoming auth
phases; no current route or flow has been changed to use them.

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
```

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

## 7. SMS delivery (mock only)

SMS lives in `apps/api/src/services/sms/`. No SMS provider or credentials are
configured, so `SMS_MODE=mock` is the only supported value. Set it explicitly in
the API environment; a missing value or any other value fails with a configuration
error instead of silently switching to mock delivery.

The mock provider returns `{ status: "mock" }`, which is explicitly **not** real
delivery. It does not send anything, log message contents, or expose OTPs in console
output or errors. Tests inject an in-memory sink at the provider boundary to inspect
messages; that sink does not exist at runtime.

When a real provider is chosen, implement `SmsProvider` and add a mode to
`createSmsProvider()`. OTP callers use `sendOtpSms()` and do not need to change.

## Known limitations

- The API creates the OTP/reset-token database row before sending the email. If Gmail
  rejects or is unreachable, the row remains and the API returns an error. A retry or
  cleanup mechanism is out of scope for this development setup.
- Neither the web app nor the mobile app currently has a screen that consumes the
  password-reset link at `/reset-password?token=...`. The reset API and email exist;
  the landing screen still needs to be implemented.
- Email delivery is awaited in the request path. There is no queue or background worker.
