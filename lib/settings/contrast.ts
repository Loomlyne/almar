// Plan 02-06: the Settings contrast gate. WCAG 2 relative luminance and contrast ratio, sRGB, no rounding before the
// threshold. A failing pair blocks Save (D-128); the submitted hex is never adjusted.
//
// A leaf module (no imports): the settings screen, the save route and the node tests load it directly.

export type PairKind = "text" | "large";

/** 4.5:1 for text under 24px; 3:1 for the 32px heading and for non-text boundaries. */
export const THRESHOLD: Record<PairKind, number> = { text: 4.5, large: 3 };

const HEX = /^#[0-9a-f]{6}$/i;

/** `#rrggbb` only (what a native color input submits). Anything else is null, never repaired. */
export function parseHex(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : null;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Contrast ratio between two `#rrggbb` colours, 1 to 21, order-independent. */
export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function pairPasses(ratio: number, kind: PairKind): boolean {
  return ratio >= THRESHOLD[kind];
}

export type BrandColors = { teal: string; charcoal: string; gold: string; ivory: string; white: string };
export type BrandKey = keyof BrandColors;

/** Fixed tokens she cannot change; they still sit on her Ivory and White. */
export const FIXED = { muted: "#63615f", error: "#8f2d2d" } as const;

type Pair = { fg: BrandKey | keyof typeof FIXED; bg: BrandKey; kind: PairKind };

/**
 * Every required pair the site renders with the brand colours (02-UI-SPEC "Measured pairs", design system 3.1: the
 * primary is teal with ivory type). Gold is never text, fill or the only mark, so no required pair uses it.
 */
export const REQUIRED_PAIRS: readonly Pair[] = [
  { fg: "teal", bg: "ivory", kind: "text" },
  { fg: "teal", bg: "white", kind: "text" },
  { fg: "charcoal", bg: "ivory", kind: "text" },
  { fg: "charcoal", bg: "white", kind: "text" },
  { fg: "ivory", bg: "teal", kind: "text" },
  { fg: "ivory", bg: "charcoal", kind: "text" },
  { fg: "muted", bg: "ivory", kind: "text" },
  { fg: "muted", bg: "white", kind: "text" },
  { fg: "error", bg: "ivory", kind: "text" },
  { fg: "error", bg: "white", kind: "text" },
];

/**
 * The brand colours whose row shows `The contrast is too low.`: each colour that takes part in a failing pair. When
 * `changed` is given, a failing pair is charged to the colours she changed (the untouched partner keeps no error
 * line); with nothing changed in a failing pair, both of its brand colours are listed. Empty means Save may proceed.
 */
export function failingColors(colors: BrandColors, changed?: ReadonlySet<BrandKey>): BrandKey[] {
  const value = (key: Pair["fg"]): string => (key in FIXED ? FIXED[key as keyof typeof FIXED] : colors[key as BrandKey]);
  const out = new Set<BrandKey>();
  for (const pair of REQUIRED_PAIRS) {
    if (pairPasses(contrastRatio(value(pair.fg), value(pair.bg)), pair.kind)) continue;
    const members = [pair.fg, pair.bg].filter((key): key is BrandKey => !(key in FIXED));
    const blamed = changed ? members.filter((key) => changed.has(key)) : [];
    for (const key of blamed.length > 0 ? blamed : members) out.add(key);
  }
  return (["teal", "charcoal", "gold", "ivory", "white"] as const).filter((key) => out.has(key));
}
