import { afterEach, describe, expect, it } from "bun:test";
import {
  assertProductionConfig,
  ProductionConfigurationError,
  type ConfigEnv,
} from "../src/config/production";
import { serializeSessionCookie } from "../src/lib/cookies";
import { allowedOrigins } from "../src/lib/origins";
import { checkReadiness } from "../src/lib/readiness";
import { createShutdown } from "../src/lib/shutdown";
import { loadSmsConfig } from "../src/services/sms/sms.config";
import { createSmsProvider } from "../src/services/sms/sms.provider";

function validProdEnv(): ConfigEnv {
  return {
    NODE_ENV: "production",
    PORT: "3001",
    DATABASE_URL: "postgres://fitpal:change-me@postgres:5432/fitpal",
    REDIS_URL: "redis://redis:6379",
    OTP_PEPPER: "unique-test-pepper-at-least-32-characters",
    SMS_MODE: "disabled",
    EMAIL_PROVIDER: "gmail",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "user@example.com",
    SMTP_PASSWORD: "secret-placeholder",
    EMAIL_FROM: "FitPal <no-reply@example.com>",
    REPLY_TO: "FitPal <reply@example.com>",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
    CLIENT_URL: "https://app.example.com",
    MOBILE_OAUTH_SCHEMES: "fitpal",
    CORS_ORIGIN: "https://app.example.com",
    TRUSTED_PROXY_IP: "127.0.0.1",
  };
}

function failureMessage(env: ConfigEnv): string {
  try {
    assertProductionConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ProductionConfigurationError);
    return (error as Error).message;
  }
  throw new Error("expected assertProductionConfig to throw");
}

const savedEnv = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});

describe("production configuration", () => {
  it("accepts a complete production environment", () => {
    expect(() => assertProductionConfig(validProdEnv())).not.toThrow();
  });

  it("does not apply production rules outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });

  it("names missing production secrets without echoing values", () => {
    const env = validProdEnv();
    env.OTP_PEPPER = undefined;
    env.GOOGLE_CLIENT_SECRET = undefined;
    env.SMTP_PASSWORD = undefined;
    const message = failureMessage(env);
    expect(message).toContain("OTP_PEPPER");
    expect(message).toContain("GOOGLE_CLIENT_SECRET");
    expect(message).toContain("SMTP_PASSWORD");
    expect(message).not.toContain("secret-placeholder");
  });

  it.each([
    ["DATABASE_URL", "postgres://db.example.com/fitpal", "sslmode=verify-full"],
    ["REDIS_URL", "redis://cache.example.com:6379", "rediss://"],
    ["GOOGLE_REDIRECT_URI", "https://api.example.com/wrong/path", "GOOGLE_REDIRECT_URI"],
    ["CLIENT_URL", "https://app.example.com/path", "CLIENT_URL"],
    ["MOBILE_OAUTH_SCHEMES", "https,fitpal", "MOBILE_OAUTH_SCHEMES"],
    ["PORT", "3001abc", "PORT"],
  ])("rejects invalid %s", (key, value, expected) => {
    expect(failureMessage({ ...validProdEnv(), [key]: value })).toContain(expected);
  });

  it("rejects mock SMS in production", () => {
    expect(failureMessage({ ...validProdEnv(), SMS_MODE: "mock" })).toContain("SMS_MODE");
  });

  it("rejects wildcard credentialed CORS and non-https production origins", () => {
    expect(failureMessage({ ...validProdEnv(), CORS_ORIGIN: "*" })).toContain("CORS_ORIGIN");

    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "http://app.example.com";
    expect(() => allowedOrigins()).toThrow(/https/);
  });

  it("keeps production CORS explicit", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = undefined;
    expect(() => allowedOrigins()).toThrow(/CORS_ORIGIN/);

    process.env.CORS_ORIGIN = "https://app.example.com";
    expect(allowedOrigins()).toEqual(["https://app.example.com"]);
  });
});

describe("production-safe providers and probes", () => {
  it("keeps session cookies secure", () => {
    const cookie = serializeSessionCookie("session-id");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("fails SMS delivery clearly when production SMS is disabled", async () => {
    const provider = createSmsProvider(loadSmsConfig({ SMS_MODE: "disabled" }));
    expect(await provider.send({ to: "+15550000000", body: "code" })).toEqual({
      status: "failed",
      provider: "disabled-sms",
      reason: "configuration",
    });
  });

  it("reports readiness failures by dependency category only", async () => {
    expect(
      await checkReadiness({
        queryDatabase: async () => 1,
        pingRedis: async () => "PONG",
      }),
    ).toEqual({ ready: true });

    expect(
      await checkReadiness({
        queryDatabase: async () => {
          throw new Error("connection string with credentials");
        },
        pingRedis: async () => "PONG",
      }),
    ).toEqual({ ready: false, dependency: "database" });

    expect(
      await checkReadiness({
        queryDatabase: async () => 1,
        pingRedis: async () => {
          throw new Error("redis://user:password@host");
        },
      }),
    ).toEqual({ ready: false, dependency: "redis" });
  });

  it("drains the server before closing dependencies exactly once", async () => {
    const calls: string[] = [];
    const controller = createShutdown({
      stopServer: () => {
        calls.push("server");
      },
      closeDatabase: () => {
        calls.push("database");
      },
      closeRedis: () => {
        calls.push("redis");
      },
    });

    await controller.shutdown();
    await controller.shutdown();

    expect(calls).toEqual(["server", "database", "redis"]);
  });
});
