import { serve } from "bun";
import { app } from "./app";

const port = parseInt(process.env.PORT || "3001");

serve({
  fetch: app.fetch,
  port,
});

console.log(`🐷 api running on http://localhost:${port}`);
