# FitPal account recovery (Phase 6, backend only)

Phase 6 adds code-based password recovery for existing password accounts. It is a
backend-only change: no web or mobile screens were added or modified. The login and
recovery screens will be designed together in a later phase once the contracts are
stable.

The implementation lives in:

- `apps/api/src/services/recovery.ts` — eligibility, server-derived OTP scope, reset orchestration.
- `apps/api/src/services/otp/engine.ts` — the Phase 3 engine, extended with an optional caller transaction.
- `apps/api/src/services/auth.ts` — session versioning, legacy token reset, password/version update helper.
- `apps/api/src/routes/auth.ts` and `apps/api/src/validators/auth.ts` — HTTP contracts.
- `packages/database/src/migrations/0011_famous_colonel_america.sql` — additive `users.session_version` column.

See [`AUTH_LOGIN_MATRIX.md`](./AUTH_LOGIN_MATRIX.md) for login/IP-trust behavior and
[`EMAIL_SMTP_SETUP.md`](./EMAIL_SMTP_SETUP.md) for provider setup.

## Eligibility and account-security decision

An account is recoverable only when **all** of these are true:

1. the normalized identifier resolves to an existing user;
2. the user already has a password hash;
3. the exact contact supplied by the caller is verified — `emailVerified` for email,
   `phoneVerified` for phone.

A verified email never makes an unverified phone eligible, and a verified phone never
makes an unverified email eligible. Pending signup accounts cannot use recovery through
an unverified contact.

Google-only accounts (`passwordHash = null`) are deliberately **ineligible** even when
their email is verified. Recovery never creates a password for an OAuth-only account;
upgrading such an account must be an explicit future product/security decision. This
preserves the Phase 5 account-security model.

## API contracts

### Send a recovery code

```http
POST /api/v1/auth/recovery/send
Content-Type: application/json

{ "identifier": "user@example.com" }
```

`identifier` uses the same server-side normalization as login: email addresses are
trimmed and lowercased; phone numbers are normalized to E.164. The client never sends a
channel, OTP purpose, token, or session.

Response for **every** identifier, including unknown, unverified, Google-only, pending,
rate-limited, and delivery-failed cases:

```json
{ "success": true }
```

No `Set-Cookie`, token, OTP, challenge ID, account data, or internal error is returned.
No session is created. Ineligible identifiers do not create an OTP challenge.

### Reset the password

```http
POST /api/v1/auth/recovery/reset
Content-Type: application/json

{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "at-least-8-characters"
}
```

Success:

```json
{ "success": true }
```

Failure is generic and never names the account, contact, purpose, or engine status:

```json
{ "error": "Invalid or expired recovery request" }
```

The reset endpoint never creates a session, sets a cookie, or returns a token. Both
endpoints use `ApiError`/`errorResponse`; unexpected failures become
`500 { error: "Unexpected server error" }` rather than raw database or SMTP errors.

## Purpose and channel mapping

Purposes are derived on the server and bound into the OTP HMAC by the Phase 3 engine.

| Identifier | Channel | Engine purpose | Delivery template |
| --- | --- | --- | --- |
| Verified email | `email` | `password_recovery` | `password-recovery-code.ts` |
| Verified phone | `sms` | `phone_password_recovery` | `templates/otp-sms.ts` (password-recovery copy) |

`phone_password_recovery` is a new SMS-specific engine purpose. It cannot be used for
signup, later verification, email login, phone login, or email recovery, and codes from
those purposes cannot reset a password. The HMAC binds challenge ID, user ID, normalized
destination, channel, and purpose, so purpose crossover fails even if a code is copied
into another endpoint.

## Abuse protection and delivery

Recovery reuses the Phase 3 OTP engine unchanged for state:

- six-digit codes;
- 10-minute expiry;
- 60-second resend cooldown;
- five sends per rolling hour;
- five wrong attempts before a one-hour lock;
- best-effort Redis IP limits with the Phase 5 trusted-IP rules.

Wrong attempts and locks are committed even when the overall reset request fails. A
successful OTP consume is rolled back if the password/version update fails. Password
login remains available while a recovery OTP is locked.

Email uses the existing Gmail SMTP abstraction and the dedicated password-recovery code
template. SMS uses the existing delivery abstraction and mock provider. The mock returns
`status: "mock"` and never counts as delivered: no active recovery challenge is created,
and the service reports `not_delivered` internally. The HTTP answer stays generic for
enumeration resistance; documentation and operators must not treat it as proof of SMS
delivery. Tests inject in-memory email/SMS senders and never contact real providers.

## Atomicity

Password reset has no separate grant step. `POST /recovery/reset` performs the whole
credential change in one PostgreSQL transaction:

1. resolve and verify scope inside the OTP engine;
2. lock the verification-state row (`SELECT ... FOR UPDATE`);
3. compare the HMAC in constant time;
4. condition-consume the active challenge (`WHERE status = 'active'`);
5. update `users.password_hash`;
6. increment `users.session_version`;
7. commit.

The new password is bcrypt-hashed **before** the transaction, so no row lock is held
during hashing. Any failure after OTP verification rolls back the OTP consume, password
change, and version increment together. Concurrent resets serialize on the OTP state
row; only one can consume a challenge. Failed attempts are intentionally returned to the
caller without throwing inside the transaction so their counts and locks persist.

## Session invalidation

Sessions remain opaque Redis UUIDs with a seven-day TTL, sent as an HttpOnly cookie on
web and a Bearer token on mobile. Phase 6 adds a durable `users.session_version`
integer:

- `createSession()` reads the current version and stores it in the session record.
- `validateSession()` compares the session version with a cached current version.
- On cache miss, the version is read from `users`, cached for 60 seconds, and a missing
  user causes fail-closed rejection/deletion of the session.
- Password changes increment the version in the same transaction as the password hash.
- The new version is written to Redis after commit; a failed write deletes the cache key
  so the next request falls back to the database.
- `deleteAccount()` clears the version cache; deleted users are rejected on the next
  validation.
- Sessions without a stored version are treated as version `0`, so existing sessions
  survive deployment.

Only old sessions for the affected user are rejected; other users keep working sessions.
The Redis cache key is `session:version:<sha256(userId)>`, so no raw identifier appears
in Redis keys.

The cache avoids a database query per protected request on the warm path. A cache write
lost after commit can leave a stale value for at most 60 seconds, after which the
database becomes authoritative again. `requireAuth` still performs the pre-existing
pending-account check; consolidating that check and session version validation is
deferred to Phase 8.

## Deprecated legacy link flow

`POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` remain
temporarily for existing clients and are marked deprecated in code and route comments.
They are not the preferred recovery path.

- `forgot-password` accepts `{ email }`, requires a verified email and an existing
  password hash, and always returns `{ success: true }` from the route.
- Tokens are two UUIDs concatenated, stored only as SHA-256 hashes, and expire after one
  hour.
- `reset-password` claims the token with a conditional `UPDATE ... WHERE usedAt IS NULL
  AND expiresAt > now() RETURNING userId`, hashes outside the transaction, then updates
  the password and session version in one transaction.
- Reuse, expiry, and unknown tokens all return
  `400 { error: "Invalid or expired reset token" }`.
- No session is created and no user is logged in.

## Migrations

Migration `0011_famous_colonel_america.sql` only adds
`users.session_version integer NOT NULL DEFAULT 0`. The existing OTP purpose columns are
text with a TypeScript enum, so `phone_password_recovery` needed no SQL change. No table
was dropped, recreated, or reset.

The migration was applied only to `fitpal_test` with `TEST_DATABASE_URL`. The dev
database `fitpal` was not migrated and contains no `session_version` column. Apply the
migration to any other environment explicitly during deployment.

## Future SMS and provider setup

SMS delivery is still mock-only: `SMS_MODE=mock` never sends a real message. Before
phone recovery can be used by real users, a production SMS provider must be added behind
the existing `SmsProvider` interface in `apps/api/src/services/sms/`, with real delivery
status reporting and no code or phone number in logs. The `phone_password_recovery`
purpose and template are already wired, so only the provider needs to change.

## Verification

Focused recovery tests, the full API suite against `fitpal_test`, API typecheck/lint/build,
database typecheck/lint, Drizzle validation, and `git diff --check` are run before the
Phase 6 commit. See the final Phase 6 report for the recorded results.
