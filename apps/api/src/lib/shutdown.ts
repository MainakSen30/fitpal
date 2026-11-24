export type ShutdownDeps = {
  stopServer: () => void | Promise<void>;
  closeDatabase: () => void | Promise<void>;
  closeRedis: () => void | Promise<void>;
  timeoutMs?: number;
};

async function withTimeout(work: () => void | Promise<void>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve(work()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("shutdown timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Stops accepting traffic before closing dependencies; each step is bounded. */
export function createShutdown(deps: ShutdownDeps) {
  let stopping = false;
  const timeoutMs = deps.timeoutMs ?? 8_000;

  async function shutdown(): Promise<void> {
    if (stopping) return;
    stopping = true;
    for (const step of [deps.stopServer, deps.closeDatabase, deps.closeRedis]) {
      try {
        await withTimeout(step, timeoutMs);
      } catch {
        // Best-effort drain; the platform handles final process exit.
      }
    }
  }

  function registerSignals(): void {
    const handler = () => {
      void shutdown().finally(() => process.exit(0));
    };
    process.once("SIGTERM", handler);
    process.once("SIGINT", handler);
  }

  return { shutdown, registerSignals };
}
