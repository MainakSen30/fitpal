import { createMiddleware } from "hono/factory";
import { validateSession } from "../services/auth";

export const requireAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const sessionId = c.req.cookie("session");
  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = await validateSession(sessionId);
  if (!session) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("userId", session.userId);
  await next();
});

export const optionalAuth = createMiddleware<{
  Variables: { userId?: string };
}>(async (c, next) => {
  const sessionId = c.req.cookie("session");
  if (sessionId) {
    const session = await validateSession(sessionId);
    if (session) {
      c.set("userId", session.userId);
    }
  }
  await next();
});
