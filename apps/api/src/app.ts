import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

export const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

const v1 = app.basePath("/api/v1");

// Placeholder: mount routes here
// v1.route("/auth", authRoutes);
// v1.route("/workouts", workoutRoutes);
// v1.route("/nutrition", nutritionRoutes);
// v1.route("/progress", progressRoutes);
// v1.route("/community", communityRoutes);
// v1.route("/ai", aiRoutes);
// v1.route("/devices", deviceRoutes);

export type AppType = typeof v1;
