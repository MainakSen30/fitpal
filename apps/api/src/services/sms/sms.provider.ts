import type { DeliveryFailureReason } from "../delivery/types";
import { createMockSmsProvider } from "./providers/mock-sms.provider";
import { SmsConfigurationError, type SmsConfig } from "./sms.config";

export type SmsMessage = { to: string; body: string };

export type SmsResult =
  | { status: "delivered"; provider: string; messageId?: string }
  | { status: "mock"; provider: string }
  | { status: "failed"; provider: string; reason: DeliveryFailureReason };

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

/** Test-only capture seam; never wired to logging or runtime output. */
export type SmsSink = (message: SmsMessage) => void;

export function createSmsProvider(config: SmsConfig, sink?: SmsSink): SmsProvider {
  if (config.mode === "mock") return createMockSmsProvider(sink);
  throw new SmsConfigurationError(`Unsupported SMS provider mode: ${config.mode}`);
}
