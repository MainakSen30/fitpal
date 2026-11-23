import type { OtpPurpose } from "../../delivery/types";
import { renderCodeEmail } from "./code-email";
import { renderPasswordRecoveryCodeEmail } from "./password-recovery-code";
import { renderSignupVerificationEmail } from "./signup-verification";

export type { OtpPurpose } from "../../delivery/types";

export type OtpEmailInput = {
  code: string;
  purpose: OtpPurpose;
};

type RenderedEmail = { subject: string; html: string; text: string };

/** Purpose-specific wording with one shared FitPal code layout. */
export function renderOtpEmail({ code, purpose }: OtpEmailInput): RenderedEmail {
  switch (purpose) {
    case "signup_verification":
      return renderSignupVerificationEmail(code);
    case "password_recovery":
      return renderPasswordRecoveryCodeEmail(code);
    case "login":
      return renderCodeEmail({
        code,
        subject: "Your FitPal sign-in code",
        heading: "Sign in to FitPal",
        intro: "Use this code to sign in to FitPal:",
      });
    case "email_verification":
      return renderCodeEmail({
        code,
        subject: "Verify your FitPal email",
        heading: "Verify your email",
        intro: "Use this code to verify your email address:",
      });
  }
}
