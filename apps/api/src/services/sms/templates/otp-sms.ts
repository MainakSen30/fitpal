import type { OtpPurpose } from "../../delivery/types";

const COPY: Record<OtpPurpose, string> = {
  signup_verification:
    "Your FitPal verification code is {code}. Valid for 10 minutes. Do not share this code.",
  login: "Your FitPal login code is {code}. Valid for 10 minutes. Do not share this code.",
  email_verification:
    "Your FitPal verification code is {code}. Valid for 10 minutes. Do not share this code.",
  password_recovery:
    "Your FitPal password recovery code is {code}. Valid for 10 minutes. Do not share this code.",
};

/** Concise, purpose-specific SMS body. The code always comes from the caller. */
export function renderOtpSms(input: { code: string; purpose: OtpPurpose }): string {
  return COPY[input.purpose].replace("{code}", input.code);
}
