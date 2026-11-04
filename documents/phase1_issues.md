# Phase 1 Issues - FitPal Codebase Audit

*Generated: 2026-11-03*

---

## 🔴 Critical Issues

### 1. TypeScript Typecheck Failure in `@fitpal/ai`
**File:** `packages/ai/src/clients/llm.ts:4,7`
```typescript
// Uses `process.env` but package lacks @types/node
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
```
**Fix:** Add `"@types/node": "^22"` to `packages/ai/package.json` devDependencies.

---

### 2. Mobile Lint Fails - Missing ESLint
**Error:** `eslint: command not found` in `apps/mobile/package.json`
```json
"lint": "eslint .",
```
**Fix:** Add eslint to mobile devDependencies or remove the lint script until configured.

---

### 3. Auth Mismatch: Mobile Sends Bearer Token, API Expects Cookie
**Mobile** (`apps/mobile/src/lib/api.ts:13-18`):
```typescript
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
});
```
**API** (`apps/api/src/middleware/requireAuth.ts:5-7`):
```typescript
const sessionId = c.req.cookie("session");  // Only reads cookies!
```
**Result:** Mobile authentication will **always fail** with 401 Unauthorized.

**Fix options:**
- **Option A:** Update API to also check `Authorization: Bearer <token>` header
- **Option B:** Update mobile to use cookie-based auth (harder with Expo)

---

### 4. Real Credentials Committed in `.env`
**File:** `.env` — values redacted from this document as a precaution.
```env
JWT_SECRET=<redacted>
GOOGLE_CLIENT_ID=<redacted-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<redacted>
```
**Risk:** Real production credentials leaked into a committed document. **Rotate them immediately.**

---

## 🟡 High Priority Issues

### 5. `otp_codes.attempts` Column Type Mismatch
**Migration:** `packages/database/src/migrations/0002_left_old_lace.sql:8`
```sql
"attempts" text DEFAULT '0' NOT NULL,
```
**Schema:** `packages/database/src/schema/otp_codes.ts` (likely expects integer)
**Issue:** Stored as text but likely compared as number. Should be `integer` type.

---

### 6. Exercise Table Design - Per-User Exercises Cause Duplication
**Schema:** `packages/database/src/schema/exercises.ts`
```typescript
userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
```
**Problem:** Every user gets their own copy of "Bench Press", "Squat", etc. No shared exercise library.
**Better:** Global exercises table + user_custom_exercises for user-created ones.

---

### 7. Mixed Package Managers in Docker
- **API Dockerfile:** Uses `bun install --frozen-lockfile` (bun)
- **Web Dockerfile:** Uses `npm ci` (npm)
- **Root:** Uses `bun` (packageManager: "bun@1.3.14")
**Risk:** Lockfile drift, inconsistent dependency resolution.

---

### 8. Mobile App Uses Hardcoded LAN IP
**File:** `apps/mobile/.env:6`
```env
EXPO_PUBLIC_API_URL=http://10.39.183.212:3011
```
**Problem:** IP changes on DHCP renewal. Breaks on physical devices.
**Fix:** Use `localhost` for simulator, or configure via `.env.example` with instructions.

---

## 🟢 Medium Priority Issues

### 9. Missing Tests
No test files found anywhere. No test scripts in any package.json.

### 10. Web Auth Uses Cookies, No CSRF Protection
The API sets `SameSite=Lax` cookies but no CSRF tokens for state-changing operations.

### 11. No Error Boundaries in Mobile App
Screens like workout/logbook/routines have no error handling for API failures.

### 12. API Service Functions Duplicate Workout Ownership Checks
Every service function in `workout.ts` repeats:
```typescript
const [workout] = await db.select().from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).limit(1);
if (!workout) throw new Error("Workout not found");
```
**Could extract** to a helper: `getOwnedWorkout(userId, workoutId)`.

### 13. `verifyOtp` Doesn't Check Attempt Count
**File:** `apps/api/src/services/auth.ts:223-237`
The `attempts` column exists but is never incremented/checked → no brute-force protection.

---

## 📋 Suggested Fix Order

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | Rotate leaked credentials (JWT_SECRET, Google OAuth) | Low |
| 2 | Fix mobile auth (Bearer vs Cookie mismatch) | Medium |
| 3 | Add @types/node to ai package | Low |
| 4 | Fix otp_codes.attempts column type | Low |
| 5 | Add ESLint to mobile or remove lint script | Low |
| 6 | Unify package managers (bun everywhere) | Medium |
| 7 | Extract workout ownership check helper | Low |
| 8 | Add brute-force protection to OTP | Low |
| 9 | Consider global exercises table | Medium |
| 10 | Add tests | High |

---

## Related Documentation
- [PHASE1_BACKEND_CHANGES.md](./PHASE1_BACKEND_CHANGES.md)
- [DOCKER_FIXES.md](./DOCKER_FIXES.md)
- [GOOGLE_OAUTH_TESTING.md](./GOOGLE_OAUTH_TESTING.md)
- [fitpal-phase1-research.md](./fitpal-phase1-research.md)