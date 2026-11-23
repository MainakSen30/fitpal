import { renderCodeEmail } from "./code-email";

/** Dedicated code-based password recovery template. */
export function renderPasswordRecoveryCodeEmail(code: string) {
  return renderCodeEmail({
    code,
    subject: "Reset your FitPal password",
    heading: "Let's get you back in.",
    intro: "We received a request to reset your FitPal password. Use the code below to continue.",
    note: "Your password will remain unchanged unless you complete the recovery process.",
  });
}
