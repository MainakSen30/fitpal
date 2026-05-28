export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  unitSystem: "metric" | "imperial";
  createdAt: string;
  updatedAt: string;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  totalVolume: number | null;
  isCompleted: boolean;
  source: "manual" | "wearable" | "imported";
  createdAt: string;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  rir: number | null;
  rpe: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  isWarmup: boolean;
  notes: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  category: "strength" | "cardio" | "flexibility" | "plyometric";
  muscleGroups: string[];
  equipment: string;
  instructions: string[];
  imageUrls: string[];
  isCompound: boolean;
  isCustom: boolean;
}

export interface Meal {
  id: string;
  userId: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  eatenAt: string;
  photoUrl: string | null;
  notes: string | null;
}

export interface Food {
  id: string;
  name: string;
  barcode: string | null;
  servingSize: number;
  servingUnit: string;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

export interface BodyLog {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  armCm: number | null;
  thighCm: number | null;
}
