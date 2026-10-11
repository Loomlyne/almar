// The Payment Element's look (plan 04-04, B-07): the brand's colours and type scale from tokens.json, square corners
// everywhere, gold never a fill (it does not appear at all). Pure, no imports: the panel passes tokens.json in and the
// tests do the same. The Element lives in Stripe's own frame, so page variables such as `var(--font-lato)` do not
// resolve there; the family is named outright with the token's plain fallbacks after it.
import type { Appearance } from "@stripe/stripe-js";

export type AppearanceTokens = {
  color: { teal: string; surface: string; ink: string; muted: string; line: string; error: string; success: string; warning: string };
  text: { body: { size: string; lineHeight: string }; label: { size: string }; caption: { size: string } };
  face: { body: string };
};

/** `rgb(38 38 38 / 0.16)` (the token's syntax) as `rgba(38, 38, 38, 0.16)`, which Stripe reads. Other values pass through. */
export function stripeColor(value: string): string {
  const match = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+%?)\s*\)$/.exec(value.trim());
  if (!match) return value;
  const alpha = match[4].endsWith("%") ? String(Number(match[4].slice(0, -1)) / 100) : match[4];
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

function plainFamily(face: string): string {
  const rest = face.split(",").map((part) => part.trim()).filter((part) => part !== "" && !part.startsWith("var("));
  return ["Lato", ...rest].join(", ");
}

export function paymentAppearance(tokens: AppearanceTokens): Appearance {
  const { color, text, face } = tokens;
  const line = stripeColor(color.line);
  return {
    theme: "flat",
    variables: {
      colorPrimary: color.teal,
      colorBackground: color.surface,
      colorText: color.ink,
      colorTextSecondary: color.muted,
      colorTextPlaceholder: color.muted,
      colorDanger: color.error,
      colorSuccess: color.success,
      colorWarning: color.warning,
      fontFamily: plainFamily(face.body),
      fontSizeBase: text.body.size,
      fontSizeSm: text.label.size,
      fontSizeXs: text.caption.size,
      fontLineHeight: text.body.lineHeight,
      spacingUnit: "4px",
      borderRadius: "0px",
    },
    rules: {
      ".Input": { borderRadius: "0px", border: `1px solid ${line}`, boxShadow: "none", backgroundColor: color.surface },
      ".Input:focus": { borderRadius: "0px", border: `1px solid ${color.teal}`, boxShadow: `inset 0 -2px 0 ${color.teal}` },
      ".Input--invalid": { borderRadius: "0px", border: `1px solid ${color.error}`, boxShadow: `inset 0 -2px 0 ${color.error}` },
      ".Label": { color: color.muted },
      ".Tab": { borderRadius: "0px", border: `1px solid ${line}`, boxShadow: "none" },
      ".Tab--selected": { borderRadius: "0px", border: `1px solid ${color.teal}`, boxShadow: `inset 0 0 0 1px ${color.teal}` },
      ".Block": { borderRadius: "0px", border: `1px solid ${line}`, boxShadow: "none" },
    },
  };
}
