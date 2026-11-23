export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type LayoutInput = {
  preheader: string;
  heading: string;
  body: string;
  footer: string;
};

/** Shared FitPal shell. Table layout and inline styles for mobile clients. */
export function renderEmailLayout({ preheader, heading, body, footer }: LayoutInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 24px 0;">
                <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#111827;">FitPal<span style="color:#f97316;">.</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#374151;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#111827;">${escapeHtml(heading)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#9ca3af;">
                ${footer}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#9ca3af;">FitPal &middot; support.fitpal@gmail.com</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
