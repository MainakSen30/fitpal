import type { OtpPurpose } from "../delivery/types";
import { loadSmsConfig } from "./sms.config";
import { createSmsProvider, type SmsProvider, type SmsResult, type SmsSink } from "./sms.provider";
import { renderOtpSms } from "./templates/otp-sms";

export type SendOtpSmsInput = { to: string; code: string; purpose: OtpPurpose };
export type SendOtpSmsOptions = { provider?: SmsProvider; sink?: SmsSink };

/** Delivery boundary for future OTP flows: no provider details leak to callers. */
export async function sendOtpSms(
  input: SendOtpSmsInput,
  options: SendOtpSmsOptions = {},
): Promise<SmsResult> {
  const config = loadSmsConfig();
  const provider = options.provider ?? createSmsProvider(config, options.sink);
  return provider.send({ to: input.to, body: renderOtpSms(input) });
}
