// Renders the sign-in email (plan 02-02). Pure: the caller passes the strings, so node tests can
// load this file directly. Square corners, no password, no code. A public email never says
// dashboard; the ops email may (UI-SPEC, Email).

export type MagicLinkEmailCopy = {
  subjectSignIn: string;
  subjectConfirm: string;
  intro: string;
  ignore: string;
  button: string;
};

export type MagicLinkEmail = { subject: string; html: string; text: string };

const TEAL = "#1f3b40";
const GOLD = "#d4ba8a";
const IVORY = "#fffaf0";
const INK = "#262626";
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
}: {
  href: string;
  locale: "en" | "ar" | "es";
  /** confirm: the first link for a new account. sign-in: every later link. */
  kind: "sign-in" | "confirm";
  copy: MagicLinkEmailCopy;
}): MagicLinkEmail {
  if (!/^https?:\/\//.test(href)) throw new Error("magic link must be an absolute URL");
  const dir = locale === "ar" ? "rtl" : "ltr";
  const subject = kind === "confirm" ? copy.subjectConfirm : copy.subjectSignIn;
  const safeHref = escapeHtml(href);
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};color:${INK};font-family:Lato,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;text-align:${dir === "rtl" ? "right" : "left"}" dir="${dir}">
<tr><td style="padding:0 0 24px;font-family:Georgia,serif;font-size:24px;color:${TEAL}">ALMAR Private Journey</td></tr>
<tr><td style="padding:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(copy.intro)}</td></tr>
<tr><td style="padding:0 0 24px"><a href="${safeHref}" style="display:inline-block;padding:16px 24px;background:${GOLD};color:${TEAL};font-size:14px;text-decoration:none;border-radius:0">${escapeHtml(copy.button)}</a></td></tr>
<tr><td style="padding:0;font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(copy.ignore)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = `ALMAR Private Journey\n\n${copy.intro}\n\n${copy.button}: ${href}\n\n${copy.ignore}\n`;
  return { subject, html, text };
}
