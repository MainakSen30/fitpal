import { z } from "zod";
import { phoneNumberSchema } from "../lib/phone";

/**
 * Normal (email/password) registration identity: phone is mandatory and
 * normalized to E.164. Routes adopt this in the registration phase; Google
 * accounts keep phone nullable.
 */
export const normalRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  phone: phoneNumberSchema(),
  password: z.string().min(8),
});

/** Normal registration plus the contact the user wants to verify first. */
export const signupRegistrationSchema = normalRegistrationSchema.extend({
  verificationChannel: z.enum(["email", "sms"]),
});

const oneIdentifier = (value: { identifier?: string; email?: string }) =>
  Boolean(value.identifier) !== Boolean(value.email);

/** `email` is the legacy shape; `identifier` accepts email or E.164 phone. */
export const passwordLoginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(1),
}).refine(oneIdentifier, { message: "Provide identifier or email" });

const otpIdentifierFields = {
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  purpose: z.enum(["email_verification", "login"]).optional(),
};

/** Legacy `purpose` is a mode selector; channel and engine purpose are server-derived. */
export const otpSendSchema = z.object(otpIdentifierFields)
  .refine(oneIdentifier, { message: "Provide identifier or email" })
  .refine((value) => value.purpose !== "email_verification" || Boolean(value.email), {
    message: "email_verification requires email",
  });

export const otpVerifySchema = z.object({
  ...otpIdentifierFields,
  code: z.string().length(6),
})
  .refine(oneIdentifier, { message: "Provide identifier or email" })
  .refine((value) => value.purpose !== "email_verification" || Boolean(value.email), {
    message: "email_verification requires email",
  });

/** Recovery never accepts a channel, purpose, token or session in the request. */
export const recoverySendSchema = z.object({
  identifier: z.string().trim().min(1),
});

export const recoveryResetSchema = z.object({
  identifier: z.string().trim().min(1),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8),
});
