import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose", { enum: ["email_verification", "login"] }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: text("attempts").default("0").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
