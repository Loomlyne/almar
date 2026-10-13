// Renders the sign-in email (plan 02-02). Pure: the caller passes the strings, so node tests can
// load this file directly. Square corners, no password, no code. A public email never says
// dashboard; the ops email may (UI-SPEC, Email).
//
// Plan 02-06 (D-110, D-113, D-116): the email wears the saved brand. The caller reads the settings row at send time and
// passes it; colours go in as inline styles, the faces as the first name in each font stack (Arabic keeps its own faces,
// D-123), and a saved logo as an <img> on the image host (an email cannot use a relative path). Without settings the
// design system's values are used, so a failed read never stops an email. The button is the site's primary: Teal fill,
// White text (owner, 2026-10-13: Gold is lines only, never a fill; the Teal/White pair is in the contrast gate).
// lib/site-settings-read.ts emailBrand() builds the values from the settings row; this file stays import-free so node
// tests load it directly.

/** Plain values for the email (lib/site-settings-read.ts emailBrand). Colours are #rrggbb, faces the design system's. */
export type EmailBrand = { teal: string; white: string; ivory: string; ink: string; titleFace: string; bodyFace: string; logoUrl: string | null };

const DESIGN: EmailBrand = { teal: "#1f3b40", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
const HEX = /^#[0-9a-f]{6}$/;
const FACE = /^(Questa|Lato)$/;
const LOGO_URL = /^https:\/\/media\.almarprivatejourney\.com\/[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|png|jpg)$/;

function checkedBrand(brand: EmailBrand | null): EmailBrand {
  if (!brand) return DESIGN;
  for (const key of ["teal", "white", "ivory", "ink"] as const) {
    if (!HEX.test(brand[key])) throw new Error(`email brand: ${key} is not #rrggbb`);
  }
  if (!FACE.test(brand.titleFace) || !FACE.test(brand.bodyFace)) throw new Error("email brand: a face is not the design system's");
  if (brand.logoUrl !== null && !LOGO_URL.test(brand.logoUrl)) throw new Error("email brand: the logo is not a media URL");
  return brand;
}

export type MagicLinkEmailCopy = {
  subjectSignIn: string;
  subjectConfirm: string;
  intro: string;
  ignore: string;
  button: string;
};

export type MagicLinkEmail = { subject: string; html: string; text: string };

const MUTED = "#63615f";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMagicLinkEmail({
  href,
  locale,
  kind,
  copy,
  brand = null,
}: {
  href: string;
  locale: "en" | "ar" | "es";
  /** confirm: the first link for a new account. sign-in: every later link. */
  kind: "sign-in" | "confirm";
  copy: MagicLinkEmailCopy;
  /** The saved brand (lib/site-settings-read.ts emailBrand), or null for the design system. */
  brand?: EmailBrand | null;
}): MagicLinkEmail {
  if (!/^https?:\/\//.test(href)) throw new Error("magic link must be an absolute URL");
  const dir = locale === "ar" ? "rtl" : "ltr";
  const subject = kind === "confirm" ? copy.subjectConfirm : copy.subjectSignIn;
  const safeHref = escapeHtml(href);
  const b = checkedBrand(brand);
  const TEAL = b.teal;
  const WHITE = b.white;
  const IVORY = b.ivory;
  const INK = b.ink;
  const titleFont = locale === "ar" ? "'Noto Naskh Arabic',Georgia,serif" : `${b.titleFace},Georgia,serif`;
  const bodyFont = locale === "ar" ? "'Noto Sans Arabic',Arial,sans-serif" : `${b.bodyFace},Arial,sans-serif`;
  const logo = b.logoUrl;
  const masthead = logo
    ? `<img src="${escapeHtml(logo)}" alt="ALMAR Private Journey" width="140" style="display:block;width:140px;max-width:100%;height:auto;border:0">`
    : "ALMAR Private Journey";
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};color:${INK};font-family:${bodyFont}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;text-align:${dir === "rtl" ? "right" : "left"}" dir="${dir}">
<tr><td style="padding:0 0 24px;font-family:${titleFont};font-size:24px;color:${TEAL}">${masthead}</td></tr>
<tr><td style="padding:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(copy.intro)}</td></tr>
<tr><td style="padding:0 0 24px"><a href="${safeHref}" style="display:inline-block;padding:16px 24px;background:${TEAL};color:${WHITE};font-size:14px;text-decoration:none;border-radius:0">${escapeHtml(copy.button)}</a></td></tr>
<tr><td style="padding:0;font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(copy.ignore)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = `ALMAR Private Journey\n\n${copy.intro}\n\n${copy.button}: ${href}\n\n${copy.ignore}\n`;
  return { subject, html, text };
}
