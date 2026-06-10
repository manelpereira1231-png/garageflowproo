/**
 * Branded email wrapper for GarageFlow.
 * Wraps inner HTML body content in a consistent, brand-styled shell.
 * Compatible with Outlook/Gmail (table-based layout, inline styles).
 */
export interface BrandedEmailOptions {
  /** Inner HTML body content (can include <p>, <a>, <table>, etc.) */
  body: string;
  /** Preheader (hidden snippet shown in inbox preview) */
  preheader?: string;
  /** Optional CTA button */
  cta?: { label: string; url: string };
  /** Footer note (e.g. "Recebeste este email porque..."). Optional. */
  footerNote?: string;
  /** Brand: "garageflow" (default) or "market" */
  brand?: "garageflow" | "market";
}

export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const { body, preheader = "", cta, footerNote, brand = "garageflow" } = opts;
  const isMarket = brand === "market";
  const accent = isMarket ? "#f59e0b" : "#f59e0b"; // amber-500
  const brandName = isMarket ? "GarageFlow Market" : "GarageFlow";
  const baseUrl = isMarket ? "https://garageflow.pt/market" : "https://garageflow.pt";
  const year = new Date().getFullYear();

  const ctaHtml = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
        <tr><td bgcolor="${accent}" style="border-radius:8px;">
          <a href="${cta.url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
        </td></tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(brandName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px 32px;">
        <a href="${baseUrl}" style="text-decoration:none;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
          🔧 GarageFlow${isMarket ? ` <span style="color:${accent};font-weight:700;">Market</span>` : ""}
        </a>
      </td></tr>
      <tr><td style="padding:32px;font-size:15px;line-height:1.65;color:#1e293b;">
        ${body}
        ${ctaHtml}
      </td></tr>
      <tr><td style="border-top:1px solid #e2e8f0;padding:20px 32px;font-size:12px;color:#64748b;line-height:1.5;">
        ${footerNote ? `<p style="margin:0 0 12px;">${footerNote}</p>` : ""}
        <p style="margin:0;">
          © ${year} ${escapeHtml(brandName)}. Todos os direitos reservados.<br />
          <a href="${baseUrl}" style="color:${accent};text-decoration:none;">${baseUrl.replace(/^https?:\/\//, "")}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
