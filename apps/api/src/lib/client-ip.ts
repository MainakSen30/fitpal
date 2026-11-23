import { isIP } from "node:net";
import type { Context } from "hono";

type SocketInfo = { address?: string };
type RequestIpEnv = {
  requestIP?: (request: Request) => SocketInfo | null;
  server?: { requestIP?: (request: Request) => SocketInfo | null };
  remoteIp?: string;
  incoming?: { socket?: { remoteAddress?: string } };
};

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith("::ffff:") ? value.slice(7) : value;
  return isIP(normalized) ? normalized : undefined;
}

function socketIp(c: Context): string | undefined {
  const env = c.env as RequestIpEnv | undefined;
  const requestIP = env?.requestIP ?? env?.server?.requestIP;
  if (typeof requestIP === "function") {
    try {
      const info = requestIP.call(env?.server ?? env, c.req.raw);
      const ip = normalizeIp(info?.address);
      if (ip) return ip;
    } catch {
      // Fall through to the other supported runtime shapes.
    }
  }
  return normalizeIp(env?.remoteIp ?? env?.incoming?.socket?.remoteAddress);
}

/**
 * X-Forwarded-For is client-controlled unless an explicitly configured proxy
 * is the immediate peer. With no trusted proxy, the socket address is used.
 */
export function clientIpFromRequest(c: Context): string | undefined {
  const peer = socketIp(c);
  const trustedProxy = normalizeIp(process.env.TRUSTED_PROXY_IP);
  if (!trustedProxy || peer !== trustedProxy) return peer;

  const forwarded = c.req.header("x-forwarded-for");
  if (!forwarded) return peer;
  // Right-most valid address is the hop the trusted proxy actually saw.
  for (const candidate of forwarded.split(",").reverse()) {
    const ip = normalizeIp(candidate.trim());
    if (ip) return ip;
  }
  return peer;
}
