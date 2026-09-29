import { extendTailwindMerge } from "tailwind-merge";

// Hard-coded mirror of tokens.json. tests/cn.test.mjs fails if they drift.
export const TOKEN_GROUPS = {
  color: [
    "ivory",
    "surface",
    "teal",
    "teal-hover",
    "teal-press",
    "teal-tint",
    "gold",
    "ink",
    "muted",
    "line",
    "error",
    "success",
    "warning",
    "whatsapp",
  ],
  text: ["caption", "label", "body", "title", "heading", "display", "hero"],
  shadow: ["float", "lg", "rule-primary", "rule-error", "rule-today", "selected"],
  spacing: [
    "control",
    "chip",
    "bar",
    "bar-docked",
    "summary",
    "entry",
    "action",
    "sheet-head",
    "dock",
    "mark",
    "search",
    "rail-offset",
    "row",
    "row-dense",
    "chip-dense",
  ],
  container: ["column", "menu", "calendar", "rail", "dialog", "sidebar"],
} as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...TOKEN_GROUPS.color],
      text: [...TOKEN_GROUPS.text],
      shadow: [...TOKEN_GROUPS.shadow],
      spacing: [...TOKEN_GROUPS.spacing],
      container: [...TOKEN_GROUPS.container],
    },
  },
});

export type ClassInput = string | false | null | undefined | ClassInput[];

function flatten(input: ClassInput, out: string[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) flatten(item, out);
    return;
  }
  out.push(input);
}

export function cn(...inputs: ClassInput[]): string {
  const parts: string[] = [];
  flatten(inputs, parts);
  return twMerge(parts.join(" "));
}
