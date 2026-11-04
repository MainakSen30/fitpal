import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { allowedOrigins } from "./lib/origins";
import { csrfProtection } from "./middleware/csrf";

export const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", cors({
  // Comma-separated allowlist; must include every web origin in use.
  // (3000 = web dev server, 3002 = web in docker compose)
  origin: allowedOrigins(),
  allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  credentials: true,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

const v1 = app.basePath("/api/v1");

// Cookie-authenticated mutations must present the CSRF token; Bearer
// requests (mobile) are exempt. Registered before routes so it always runs.
v1.use("*", csrfProtection);

import { authRoutes } from "./routes/auth";
import { workoutRoutes } from "./routes/workouts";
import { routineRoutes } from "./routes/routines";
import { exercisesRoutes } from "./routes/exercises";
import { progressRoutes } from "./routes/progress";

v1.route("/auth", authRoutes);
v1.route("/workouts", workoutRoutes);
v1.route("/routines", routineRoutes);
v1.route("/exercises", exercisesRoutes);
v1.route("/progress", progressRoutes);
// v1.route("/nutrition", nutritionRoutes);
// v1.route("/community", communityRoutes);
// v1.route("/ai", aiRoutes);
// v1.route("/devices", deviceRoutes);

export type AppType = typeof v1;
