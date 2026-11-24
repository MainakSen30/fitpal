import { serve } from "bun";
import { app } from "./app";
import { assertProductionConfig, isProduction } from "./config/production";
import { closeDb } from "./db";
import { checkReadiness } from "./lib/readiness";
import { closeRedis, connectRedis } from "./lib/redis";
import { createShutdown } from "./lib/shutdown";

assertProductionConfig();

const rawPort = process.env.PORT || "3001";
if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const port = Number(rawPort);

if (isProduction()) {
  await connectRedis();
  const readiness = await checkReadiness();
  if (!readiness.ready) {
    throw new Error(`Startup readiness failed: ${readiness.dependency} unavailable`);
  }
}

const server = serve({
  fetch: app.fetch,
  port,
  maxRequestBodySize: 64 * 1024,
});

createShutdown({
  stopServer: () => server.stop(),
  closeDatabase: closeDb,
  closeRedis,
}).registerSignals();

console.log(`api listening on port ${port}`);
