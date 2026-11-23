import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const otpPurposes = [
  "signup_email_verification",
  "signup_phone_verification",
  "email_verification",
  "phone_verification",
  "email_login",
  "phone_login",
  "password_recovery",
] as const;
export type OtpPurposeValue = (typeof otpPurposes)[number];

export const otpChannels = ["email", "sms"] as const;
export type OtpChannelValue = (typeof otpChannels)[number];

const scopeColumns = {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  channel: text("channel", { enum: otpChannels }).notNull(),
  purpose: text("purpose", { enum: otpPurposes }).notNull(),
};

/** One challenge per send. Only the newest successfully delivered one is active. */
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey(),
    sequence: serial("sequence").notNull(),
    ...scopeColumns,
    codeHash: text("code_hash").notNull(),
    status: text("status", {
      enum: ["pending", "active", "failed", "consumed", "expired", "superseded"],
    })
      .default("pending")
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    activeScope: uniqueIndex("otp_challenges_active_scope_unique")
      .on(table.userId, table.destination, table.channel, table.purpose)
      .where(sql`${table.status} = 'active'`),
    scopeCreated: index("otp_challenges_scope_created_idx").on(
      table.userId,
      table.destination,
      table.channel,
      table.purpose,
      table.createdAt,
    ),
  }),
);

/** Persistent per-scope verification attempts and lock, independent of sends. */
export const otpVerificationStates = pgTable(
  "otp_verification_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...scopeColumns,
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scope: uniqueIndex("otp_verification_states_scope_unique").on(
      table.userId,
      table.destination,
      table.channel,
      table.purpose,
    ),
  }),
);

/** Durable send volume for rolling cooldown/quota checks. */
export const otpSendHistory = pgTable(
  "otp_send_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...scopeColumns,
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    outcome: text("outcome", { enum: ["pending", "delivered", "failed", "mock"] })
      .default("pending")
      .notNull(),
  },
  (table) => ({
    scopeSent: index("otp_send_history_scope_sent_idx").on(
      table.userId,
      table.destination,
      table.channel,
      table.purpose,
      table.sentAt,
    ),
  }),
);

export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type NewOtpChallenge = typeof otpChallenges.$inferInsert;
export type OtpVerificationState = typeof otpVerificationStates.$inferSelect;
export type OtpSendHistory = typeof otpSendHistory.$inferSelect;
