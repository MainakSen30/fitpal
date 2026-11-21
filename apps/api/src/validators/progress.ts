import { z } from "zod";
import { dbDateOnlySchema } from "@fitpal/shared";

export const weeklyProgressQuery = z.object({
  weekStart: dbDateOnlySchema.optional(),
});
