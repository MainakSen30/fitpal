# Phase 1 Backend Changes

**Date:** November 1, 2026  
**Branch:** `upgrade/expo-latest`  
**Scope:** Core backend infrastructure for FitPal (Authentication, Database, Sessions, and API scaffolding)

## Overview

Phase 1 establishes the foundational backend for FitPal with email/password authentication, session management, database schema, and supporting infrastructure. The API is built with Hono, uses Drizzle ORM with PostgreSQL, and leverages Redis for session storage.

## Architecture

- **API Framework:** [Hono](https://hono.dev/) (`apps/api`)
- **Database ORM:** [Drizzle ORM](https://orm.drizzle.team/) (`packages/database`)
- **Auth:** Session-based authentication with httpOnly cookies + supporting flows (Google OAuth, OTP, password reset)
- **Password Hashing:** `@node-rs/bcrypt`
- **Session/JWT:** `jose` for JWT operations
- **Cache/Session Store:** Redis via `ioredis`
- **Validation:** Zod with `@hono/zod-validator`

## Changes Made

### 1. Authentication API Routes (`apps/api/src/routes/auth.ts`)

Implemented versioned auth endpoints under `/api/v1/auth`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/register` | Email/password registration. Creates user, creates session, sets httpOnly session cookie. Returns 201 with user. |
| `POST` | `/login` | Email/password login. Creates session, sets httpOnly session cookie. |
| `POST` | `/otp/send` | Send OTP for email verification or login. |
| `POST` | `/otp/verify` | Verify OTP code. |
| `POST` | `/otp/login` | Login via verified OTP. |
| `GET` | `/google` | Generate Google OAuth URL. |
| `GET` | `/google/callback` | Handle Google OAuth callback and establish session. |
| `POST` | `/forgot-password` | Send password reset email. |
| `POST` | `/reset-password` | Reset password using token. |
| `POST` | `/logout` | Destroy session and clear cookie. |
| `DELETE` | `/account` | Delete authenticated user's account. |
| `GET` | `/me` | Get current authenticated user (protected route). |

**Notes:**
- Registration/login routes currently catch all errors and return `409` in the route handler. Database/connectivity errors were observed being masked by this behavior during setup.
- Session cookies are serialized via `serializeSessionCookie()` and set on successful auth actions.

### 2. Authentication Service (`apps/api/src/services/auth.ts`)

Core auth logic implemented:

| Function | Description |
| --- | --- |
| `registerUser(email, password, name)` | Checks for existing user by email, hashes password with bcrypt (cost 10), inserts user, returns safe user object. |
| `loginWithPassword(email, password)` | Looks up user by email, verifies password hash, returns user on success. |
| `createSession(userId)` | Creates a session ID, stores `session:{id} -> userId` in Redis with 7-day expiry, returns session ID. |
| `destroySession(sessionId)` | Removes session from Redis. |
| `generateGoogleOAuthUrl()` | Builds Google OAuth authorization URL. |
| `handleGoogleCallback(code)` | Exchanges code for tokens, fetches user info, finds/creates user, returns user. |
| `sendOtp(email, purpose)` | Generates 6-digit OTP, hashes/stores in Redis with expiry, sends via email service. |
| `verifyOtp(email, code, purpose)` | Validates OTP against stored hash. |
| `loginWithOtp(email)` | Issues session for OTP-verified login. |
| `sendPasswordResetEmail(email)` | Generates reset token, stores hashed token with expiry, sends email. |
| `resetPassword(token, newPassword)` | Validates token, updates password hash, invalidates token. |
| `deleteAccount(userId)` | Deletes user account. |

**Configuration:**
- `SESSION_DURATION`: 7 days (604800 seconds)
- `SESSION_PREFIX`: `session:`
- `JWT_SECRET`: From env with dev fallback

### 3. Database Schema (`packages/database/src/schema/users.ts`)

Users table defined with Drizzle:

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  timezone: text("timezone").default("UTC").notNull(),
  unitSystem: text("unit_system", { enum: ["metric", "imperial"] }).default("metric").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Notes:**
- Supports both email/password auth (`passwordHash`) and Google OAuth (`googleId`)
- `email` has unique constraint
- `googleId` has unique constraint
- Default units/timezone configured

### 4. Redis Integration (`apps/api/src/lib/redis.ts`)

- Redis client initialized with `ioredis`
- Connection URL from `REDIS_URL` env var (defaults to `redis://localhost:6379`)
- Connection management with `ensureConnected()` helper
- Used for sessions, OTP codes, and password reset tokens

### 5. Database & Infrastructure Setup

Local development infrastructure configured:

- **Postgres:** Created database `fitpal` and user `fitpal` with password `fitpal`
- **Permissions:** Granted schema/public privileges, set database/schema ownership to `fitpal`
- **Migrations:** Ran Drizzle migrations successfully using `packages/database/drizzle.config.ts`
- **Redis:** Installed via Homebrew and started as a background service
- **API:** Running on `http://localhost:3001` via `bun run src/index.ts`

**Environment (relevant):**
```env
DATABASE_URL=postgres://fitpal:fitpal@localhost:5432/fitpal
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
```

## API Testing (Verified)

Successfully tested endpoints during setup:

```bash
# Registration
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test456@example.com","password":"password123","name":"Test"}'

# Response
{"user":{"id":"37a69d40-b05f-4b3f-b5a0-0fb96600c301","email":"test456@example.com","name":"Test"}}
```

## Files Modified/Added (Phase 1 Backend Focus)

- `apps/api/src/routes/auth.ts` - Auth route definitions
- `apps/api/src/services/auth.ts` - Auth business logic
- `apps/api/src/lib/redis.ts` - Redis client
- `packages/database/src/schema/users.ts` - User schema
- `packages/database/drizzle.config.ts` - Drizzle configuration
- `apps/api/package.json` - API dependencies
- `packages/database/package.json` - Database package dependencies

## Known Considerations

- **Error masking:** The auth route catches all exceptions and returns `409` with the error message. This should be reviewed to return appropriate status codes (400 for validation conflicts, 401 for auth failures, 500 for unexpected errors).
- **Session storage:** Sessions stored in Redis with 7-day TTL. Cookie-based auth is used.
- **Dual auth support:** Schema supports both email/password and Google OAuth flows.
- **Monorepo:** Backend packages are shared via workspaces (`@fitpal/database`, `@fitpal/shared`).

## Next Steps

- Review and refine error handling in auth routes
- Add rate limiting for auth endpoints
- Implement email service integration for OTP/password reset
- Add tests for auth flows
- Consider token refresh/session rotation strategy
