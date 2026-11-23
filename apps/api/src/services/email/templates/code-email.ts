import { escapeHtml, renderEmailLayout } from "./layout";

export type CodeEmailInput = {
  code: string;
  subject: string;
  heading: string;
  intro: string;
  note?: string;
};

type RenderedEmail = { subject: string; html: string; text: string };

/** Shared code presentation for every OTP purpose; callers supply the code. */
export function renderCodeEmail({
  code,
  subject,
  heading,
  intro,
  note,
}: CodeEmailInput): RenderedEmail {
  const codeBlock = `<div style="margin:0;padding:14px 12px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(code)}</div>`;
  const noteHtml = note ? `<p style="margin:16px 0 0;">${escapeHtml(note)}</p>` : "";
  const text = [
    "FitPal",
    "",
    heading,
    "",
    intro,
    "",
    code,
    "",
    "This code expires in 10 minutes. Never share it with anyone.",
    "If you did not request this, you can ignore this email.",
  ];
  if (note) text.push("", note);

  return {
    subject,
    html: renderEmailLayout({
      preheader: "Your FitPal code is inside",
      heading,
      body: `
        <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
        ${codeBlock}
        <p style="margin:16px 0 0;">This code expires in 10 minutes. Never share it with anyone.</p>
        <p style="margin:16px 0 0;">If you did not request this, you can ignore this email.</p>
        ${noteHtml}
      `,
      footer: "FitPal will never ask you for this code.",
    }),
    text: text.join("\n"),
  };
}
