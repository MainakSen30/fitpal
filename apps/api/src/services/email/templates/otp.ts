import { renderEmailLayout } from "./layout";

export type OtpPurpose = "email_verification" | "login";

export type OtpEmailInput = {
  code: string;
  purpose: OtpPurpose;
};

type RenderedEmail = { subject: string; html: string; text: string };

export function renderOtpEmail({ code, purpose }: OtpEmailInput): RenderedEmail {
  const verification = purpose === "email_verification";
  const subject = verification ? "Verify your FitPal email" : "Your FitPal sign-in code";
  const heading = verification ? "Verify your email" : "Sign in to FitPal";
  const action = verification ? "verify your email address" : "sign in to FitPal";

  const body = `
    <p style="margin:0 0 16px;">Use this code to ${action}:</p>
    <div style="margin:0;padding:14px 12px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:#111827;">${code}</div>
    <p style="margin:16px 0 0;">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      preheader: `${code} is your FitPal ${verification ? "verification" : "sign-in"} code`,
      heading,
      body,
      footer: "FitPal will never ask you for this code.",
    }),
    text: [
      "FitPal",
      "",
      heading,
      "",
      `Use this code to ${action}:`,
      "",
      code,
      "",
      "This code expires in 10 minutes. If you did not request it, you can ignore this email.",
      "",
      "FitPal will never ask you for this code.",
    ].join("\n"),
  };
}
