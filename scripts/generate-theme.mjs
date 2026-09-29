// tokens.json -> app/globals.css (between GENERATED:THEME markers).
// Usage: node scripts/generate-theme.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = path.join(root, "tokens.json");
const cssPath = path.join(root, "app", "globals.css");
const START = "/* GENERATED:THEME:START */";
const END = "/* GENERATED:THEME:END */";

const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));

function decls(prefix, group) {
  return Object.entries(group).map(([key, value]) => `  --${prefix}-${key}: ${value};`);
}

export function buildTheme(t) {
  const staticLines = [];
  staticLines.push(...decls("color", t.color));
  for (const [step, v] of Object.entries(t.text)) {
    staticLines.push(`  --text-${step}: ${v.size};`);
    staticLines.push(`  --text-${step}--line-height: ${v.lineHeight};`);
  }
  staticLines.push(...decls("tracking", t.tracking));
  staticLines.push(...decls("spacing", t.spacing));
  staticLines.push(...decls("container", t.container));
  staticLines.push(...decls("radius", t.radius));
  staticLines.push(...decls("shadow", t.shadow));
  staticLines.push(...decls("ease", t.ease));
  staticLines.push(...decls("transition-duration", t["transition-duration"]));
  staticLines.push(...decls("animate", t.animate));
  staticLines.push(...decls("space", t.space));
  for (const [name, frames] of Object.entries(t.keyframes)) {
    staticLines.push(`  @keyframes ${name} {`);
    for (const [frame, props] of Object.entries(frames)) {
      const body = Object.entries(props)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
      staticLines.push(`    ${frame} { ${body} }`);
    }
    staticLines.push("  }");
  }

  const out = [];
  out.push("@theme static {", ...staticLines, "}", "");
  out.push("@theme inline {", ...decls("font", t.font), "}", "");
  out.push("@layer base {");
  out.push("  :root {");
  out.push(`    --face-display: ${t.face.display};`);
  out.push(`    --face-body: ${t.face.body};`);
  out.push("  }");
  out.push("  :root:lang(ar) {");
  out.push(`    --face-display: ${t.face["display-ar"]};`);
  out.push(`    --face-body: ${t.face["body-ar"]};`);
  for (const [step, v] of Object.entries(t.text)) {
    out.push(`    --text-${step}--line-height: ${v.lineHeightAr};`);
  }
  out.push("  }");
  out.push("}");
  return out.join("\n");
}

const css = readFileSync(cssPath, "utf8");
const s = css.indexOf(START);
const e = css.indexOf(END);
if (s === -1 || e === -1 || e < s) {
  throw new Error(`Markers ${START} / ${END} missing or out of order in app/globals.css`);
}
const next = `${css.slice(0, s + START.length)}\n${buildTheme(tokens)}\n${css.slice(e)}`;

if (process.argv.includes("--check")) {
  if (next !== css) {
    console.error("app/globals.css is out of date with tokens.json. Run: npm run tokens");
    process.exit(1);
  }
  console.log("theme up to date");
} else {
  if (next !== css) writeFileSync(cssPath, next);
  console.log(next !== css ? "theme written" : "theme unchanged");
}
