import { otpChallenges, users } from "@fitpal/database";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";

const SIGNUP_PURPOSES = ["signup_email_verification", "signup_phone_verification"] as const;

/**
 * A pending account has no verified contact and still owns a signup challenge.
 * Registration creates a non-active marker challenge atomically with the user,
 * so there is no window where the row exists without pending state.
 */
export async function isPendingSignupUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({
      emailVerified: users.emailVerified,
      phoneVerified: users.phoneVerified,
      googleId: users.googleId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.emailVerified || user.phoneVerified || user.googleId) return false;

  const [challenge] = await db
    .select({ id: otpChallenges.id })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.userId, userId),
        inArray(otpChallenges.purpose, [...SIGNUP_PURPOSES]),
      ),
    )
    .limit(1);
  return Boolean(challenge);
}
