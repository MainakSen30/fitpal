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
