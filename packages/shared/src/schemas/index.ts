import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const createWorkoutSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
});

export const createSetSchema = z.object({
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().nonnegative(),
  weight: z.number().nonnegative(),
  rir: z.number().int().nonnegative().optional(),
  rpe: z.number().min(1).max(10).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  isWarmup: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const createMealSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  eatenAt: z.string().datetime(),
  photoUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

export const bodyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive(),
  bodyFatPct: z.number().min(0).max(100).optional(),
  chestCm: z.number().positive().optional(),
  waistCm: z.number().positive().optional(),
  hipsCm: z.number().positive().optional(),
  armCm: z.number().positive().optional(),
  thighCm: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});
