import { serve } from "bun";
import { app } from "./app";

const port = Number.parseInt(process.env.PORT || "3001");

serve({
  fetch: app.fetch,
  port,
  maxRequestBodySize: 64 * 1024,
});

console.log(`🐷 api running on http://localhost:${port}`);
