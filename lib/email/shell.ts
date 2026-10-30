// Plan 04-05 Task 1 (E-01, E-19): the shell of the six booking emails. Pure: no environment, no package, no network.
// It copies the sign-in email's skeleton (lib/email/magic-link.ts, not edited: E-01) at 600 px: a table layout with
// inline styles, the saved logo or the name as masthead, square corners, a Teal button with Ivory text (U-02) and gold
// only as a 1px top rule. Renderers pass RAW strings: the shell escapes every value in the html and strips control
// characters from the text part, so a guest-typed name can never become markup or a new line in the plain text.
//
// Right to left: an Arabic mail has lang="ar" dir="rtl" and text-align:right; a value that must read left to right
// inside a sentence (an amount, a reference, an IBAN, a SWIFT code, a date, a time, a phone number) is an `ltr` piece and
// sits in <span dir="ltr"> there. In an English or Spanish mail the same piece is plain text.
import type { EmailBrand } from "./magic-link";
import { isBookingRef } from "../booking/ref";
import { fill } from "../journey-format";
import { TEST_SUBJECT_PREFIX } from "../copy/booking-email";

export type EmailLocale = "en" | "ar" | "es";

/** What every booking renderer answers. */
export type RenderedEmail = { subject: string; html: string; text: string };

/** One piece of a line: plain text, a left-to-right value (with its own plain-text form), or a multi-line value. */
export type Piece = string | { ltr: string; text?: string } | { multiline: string };

/** A line of text: one string, or pieces filled into a template (fillRich). */
export type Rich = string | readonly Piece[];

/** A key/value row: the label, then one or more value lines. */
export type EmailRow = { label: Rich; lines: readonly Rich[] };

export type EmailBlock =
  | { kind: "heading"; text: Rich }
  | { kind: "paragraph"; text: Rich }
  | { kind: "rows"; rows: readonly EmailRow[] }
  | { kind: "rule" }
  | { kind: "button"; label: string; href: string }
  | { kind: "note"; text: Rich };

const DESIGN: EmailBrand = { teal: "#1f3b40", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
const HEX = /^#[0-9a-f]{6}$/;
const FACE = /^(Questa|Lato)$/;
const LOGO_URL = /^https:\/\/media\.almarprivatejourney\.com\/[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|png|jpg)$/;
const MUTED = "#63615f";
const GOLD = "#d4ba8a";
/** The design system's line colour (tokens.json color.line) as an email-safe value. */
const LINE = "rgba(38,38,38,0.16)";
const NAME = "ALMAR Private Journey";

/** The saved brand checked the way the sign-in email checks it; null is the design system. Refusals start `email brand:`. */
export function checkedBrand(brand: EmailBrand | null): EmailBrand {
  if (!brand) return DESIGN;
  for (const key of ["teal", "white", "ivory", "ink"] as const) {
    if (!HEX.test(brand[key])) throw new Error(`email brand: ${key} is not #rrggbb`);
  }
  if (!FACE.test(brand.titleFace) || !FACE.test(brand.bodyFace)) throw new Error("email brand: a face is not the design system's");
  if (brand.logoUrl !== null && !LOGO_URL.test(brand.logoUrl)) throw new Error("email brand: the logo is not a media URL");
  return brand;
}

/** The same five replacements as the sign-in email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HTTPS_LINK = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[^\s"'<>\\]*)?$/;
const LOCAL_LINK = /^http:\/\/(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(\/[^\s"'<>\\]*)?$/;

/** An href for a mail: absolute https, or http only for 127.0.0.1 / localhost; anything else throws `email: bad link`. */
export function checkHref(href: unknown): string {
  if (typeof href !== "string" || !(HTTPS_LINK.test(href) || LOCAL_LINK.test(href))) throw new Error("email: bad link");
  return href;
}

/** The subject: fixed copy words and a checked reference only, with `[TEST] ` first for a TEST booking. */
export function bookingSubject(template: string, ref: unknown, isTest: boolean): string {
  if (!isBookingRef(ref)) throw new Error("email: bad reference");
  const subject = fill(template, { ref }).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
  return (isTest ? TEST_SUBJECT_PREFIX : "") + subject;
}

/** A value that reads left to right inside a sentence; `text` is its plain-text form when it differs (an IBAN). */
export function ltr(value: string, text?: string): Piece {
  return text === undefined ? { ltr: value } : { ltr: value, text };
}

/** A value whose line feeds are kept (the owner's note line). */
export function multiline(value: string): Piece {
  return { multiline: value };
}

/** Fills `{slot}`s with pieces; the template's own words stay as written, an unknown slot stays as written. */
export function fillRich(template: string, values: Record<string, Rich>): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push(template.slice(last, at));
    const value = Object.hasOwn(values, m[1]) ? values[m[1]] : undefined;
    if (value === undefined) out.push(m[0]);
    else if (typeof value === "string") out.push(value);
    else out.push(...value);
    last = at + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

// ---------------------------------------------------------------- pieces to html and text

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/** One line: every control character (CR, LF, tab, separators) becomes a space. */
function oneLine(value: string): string {
  return value.normalize("NFC").replace(CONTROL, " ");
}

/** Several lines: CRLF and CR become LF, LF stays, every other control character is removed. */
function lines(value: string): string[] {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, "")
    .split("\n")
    .map((line) => line.trim());
}

function pieces(rich: Rich): readonly Piece[] {
  return typeof rich === "string" ? [rich] : rich;
}

function pieceHtml(piece: Piece, rtl: boolean): string {
  if (typeof piece === "string") return escapeHtml(oneLine(piece));
  if ("multiline" in piece) return lines(piece.multiline).map(escapeHtml).join("<br>");
  const value = escapeHtml(oneLine(piece.ltr));
  return rtl ? `<span dir="ltr">${value}</span>` : value;
}

function pieceText(piece: Piece): string {
  if (typeof piece === "string") return oneLine(piece);
  if ("multiline" in piece) return lines(piece.multiline).join("\n");
  return oneLine(piece.text ?? piece.ltr);
}

function richHtml(rich: Rich, rtl: boolean): string {
  return pieces(rich).map((p) => pieceHtml(p, rtl)).join("");
}

function richText(rich: Rich): string {
  return pieces(rich)
    .map(pieceText)
    .join("")
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trim())
    .join("\n");
}

// ---------------------------------------------------------------- the document

type Look = {
  rtl: boolean;
  align: "left" | "right";
  teal: string;
  white: string;
  ivory: string;
  ink: string;
  titleFont: string;
  bodyFont: string;
  lineHeight: string;
};

function blockHtml(block: EmailBlock, look: Look): string {
  const { rtl } = look;
  switch (block.kind) {
    case "heading":
      return `<tr><td style="padding:0 0 16px"><h1 style="margin:0;font-family:${look.titleFont};font-size:24px;line-height:1.3;font-weight:400;color:${look.teal}">${richHtml(block.text, rtl)}</h1></td></tr>`;
    case "paragraph":
      return `<tr><td style="padding:0 0 16px;font-size:16px;line-height:${look.lineHeight}">${richHtml(block.text, rtl)}</td></tr>`;
    case "note":
      return `<tr><td style="padding:0 0 8px;font-size:12px;line-height:1.5;color:${MUTED}">${richHtml(block.text, rtl)}</td></tr>`;
    case "rule":
      return `<tr><td style="padding:8px 0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${GOLD};font-size:0;line-height:0;height:1px">&nbsp;</td></tr></table></td></tr>`;
    case "button":
      return `<tr><td style="padding:8px 0 24px"><a href="${escapeHtml(checkHref(block.href))}" style="display:inline-block;padding:16px 24px;background:${look.teal};color:${look.ivory};font-size:14px;font-weight:700;text-decoration:none;border-radius:0">${escapeHtml(oneLine(block.label))}</a></td></tr>`;
    case "rows": {
      // The key column sits at the start side: the left in a left-to-right mail, the right in an Arabic one.
      const keyPad = rtl ? "6px 0 6px 12px" : "6px 12px 6px 0";
      const cell = `vertical-align:top;font-size:14px;line-height:1.5;border-bottom:1px solid ${LINE};text-align:${look.align}`;
      const rows = block.rows
        .map(
          (row) =>
            `<tr><td style="padding:${keyPad};width:40%;color:${MUTED};${cell}">${richHtml(row.label, rtl)}</td><td style="padding:6px 0;${cell}">${row.lines.map((l) => richHtml(l, rtl)).join("<br>")}</td></tr>`,
        )
        .join("");
      return `<tr><td style="padding:0 0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${rtl ? "rtl" : "ltr"}" style="border-collapse:collapse">${rows}</table></td></tr>`;
    }
  }
}

/**
 * The html part: the sign-in email's table skeleton at max-width 600 px, the masthead, the TEST banner first when set,
 * then the blocks. Every value is escaped here; every href passes checkHref.
 */
export function renderEmailDocument({
  locale,
  subject,
  brand,
  testBanner,
  blocks,
}: {
  locale: EmailLocale;
  subject: string;
  brand: EmailBrand | null;
  testBanner: string | null;
  blocks: readonly EmailBlock[];
}): string {
  const b = checkedBrand(brand);
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const look: Look = {
    rtl,
    align: rtl ? "right" : "left",
    teal: b.teal,
    white: b.white,
    ivory: b.ivory,
    ink: b.ink,
    titleFont: rtl ? "'Noto Naskh Arabic',Georgia,serif" : `${b.titleFace},Georgia,serif`,
    bodyFont: rtl ? "'Noto Sans Arabic',Arial,sans-serif" : `${b.bodyFace},Arial,sans-serif`,
    lineHeight: rtl ? "1.7" : "1.5",
  };
  const masthead = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${NAME}" width="140" style="display:block;width:140px;max-width:100%;height:auto;border:0">`
    : NAME;
  const banner =
    testBanner === null
      ? ""
      : `<tr><td style="padding:0 0 24px"><p style="margin:0;padding:12px 16px;border:1px solid ${b.ink};background:${b.white};font-size:14px;line-height:1.5">${escapeHtml(oneLine(testBanner))}</p></td></tr>`;
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(oneLine(subject))}</title></head>
<body style="margin:0;padding:0;background:${b.ivory};color:${b.ink};font-family:${look.bodyFont}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.ivory}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;text-align:${look.align};color:${b.ink}" dir="${dir}">
<tr><td style="padding:0 0 24px;font-family:${look.titleFont};font-size:24px;color:${b.teal}">${masthead}</td></tr>
${banner}${blocks.map((block) => blockHtml(block, look)).join("\n")}
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The plain-text part from the same blocks: rows as "Label: value", a button as "Label: URL", a rule as a blank line. */
export function renderEmailText(blocks: readonly EmailBlock[], testBanner: string | null): string {
  const out: string[] = [NAME];
  if (testBanner !== null) out.push(oneLine(testBanner).trim());
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
      case "paragraph":
      case "note":
        out.push(richText(block.text));
        break;
      case "rule":
        out.push("—");
        break;
      case "button":
        out.push(`${oneLine(block.label).trim()}: ${checkHref(block.href)}`);
        break;
      case "rows":
        out.push(
          block.rows
            .map((row) => {
              const values = row.lines.map(richText);
              return `${richText(row.label)}: ${values.join("\n  ")}`;
            })
            .join("\n"),
        );
        break;
    }
  }
  return `${out.join("\n\n")}\n`;
}

/** Both parts at once. */
export function renderEmail({
  locale,
  subject,
  brand,
  testBanner,
  blocks,
}: {
  locale: EmailLocale;
  subject: string;
  brand: EmailBrand | null;
  testBanner: string | null;
  blocks: readonly EmailBlock[];
}): RenderedEmail {
  return {
    subject,
    html: renderEmailDocument({ locale, subject, brand, testBanner, blocks }),
    text: renderEmailText(blocks, testBanner),
  };
}
