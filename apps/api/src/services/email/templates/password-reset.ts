import { escapeHtml, renderEmailLayout } from "./layout";

export type PasswordResetEmailInput = {
  name?: string | null;
  resetUrl: string;
};

type RenderedEmail = { subject: string; html: string; text: string };

export function renderPasswordResetEmail({
  name,
  resetUrl,
}: PasswordResetEmailInput): RenderedEmail {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";
  const safeUrl = escapeHtml(resetUrl);

  const body = `
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 20px;">We received a request to reset your FitPal password. Choose a new password using the button below.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:8px;background-color:#f97316;">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">Or copy and paste this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:20px;word-break:break-all;color:#6b7280;">${safeUrl}</p>
    <p style="margin:0 0 0;">This link expires in 1 hour. If you did not request a password reset, you can ignore this email and your password will stay the same.</p>
  `;

  return {
    subject: "Reset your FitPal password",
    html: renderEmailLayout({
      preheader: "Use this link to choose a new FitPal password",
      heading: "Reset your password",
      body,
      footer: "If you did not request this, no action is needed.",
    }),
    text: [
      "FitPal",
      "",
      "Reset your password",
      "",
      `${greeting}`,
      "",
      "We received a request to reset your FitPal password. Choose a new password using the link below:",
      "",
      resetUrl,
      "",
      "This link expires in 1 hour. If you did not request a password reset, you can ignore this email and your password will stay the same.",
    ].join("\n"),
  };
}
