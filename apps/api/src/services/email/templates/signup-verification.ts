import { renderCodeEmail } from "./code-email";

/** Dedicated signup verification template. */
export function renderSignupVerificationEmail(code: string) {
  return renderCodeEmail({
    code,
    subject: "Verify your FitPal email",
    heading: "Let's get you started.",
    intro:
      "Welcome to FitPal! Use the verification code below to verify your email address and finish setting up your account.",
  });
}
