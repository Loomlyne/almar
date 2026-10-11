#!/usr/bin/env node
// Wave 0 model check driver, plan 03.2-10. Run ONLY by the ALMAR controller, after starting the check Worker:
//   1. HOME=/Users/koss/.almar-cloudflare npx wrangler dev --config scripts/translate-check/wrangler.toml --port 8791
//   2. node scripts/translate-check/run.mjs --port 8791
// Sends the 3 ALMAR texts x 3 models x AR/ES (18 calls; m2m100 makes one AI call per string) to the LOCAL check Worker
// only, and writes one JSON per call plus OUTPUTS.md (English and the three outputs side by side) into
// .planning/phases/03.2-real-catalog-and-team-inserted/translate-check/. Every call bills the ALMAR account.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, ".planning", "phases", "03.2-real-catalog-and-team-inserted", "translate-check");

const MODELS = [
  { short: "gemma-4-26b", id: "@cf/google/gemma-4-26b-a4b-it" },
  { short: "llama-3.3-70b", id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { short: "m2m100-1.2b", id: "@cf/meta/m2m100-1.2b" },
];
const TARGETS = ["ar", "es"];
const TARGET_NAME = { ar: "Arabic", es: "Spanish" };

// Neurons per million tokens (input, output), from developers.cloudflare.com/workers-ai/platform/pricing/ as cited in
// 03.2-RESEARCH.md §2.1. Used only for the estimate printed next to each output, when the response reports usage.
const NEURONS_PER_M = {
  "@cf/google/gemma-4-26b-a4b-it": [9091, 27273],
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": [26668, 204805],
  "@cf/meta/m2m100-1.2b": [31050, 31050],
};

function portArg(argv) {
  const at = argv.indexOf("--port");
  const value = at >= 0 ? Number(argv[at + 1]) : NaN;
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    console.error("usage: node scripts/translate-check/run.mjs --port <port of the local check Worker>");
    process.exit(2);
  }
  return value;
}

function neurons(model, usage) {
  if (!usage || typeof usage.prompt_tokens !== "number" || typeof usage.completion_tokens !== "number") return null;
  const [input, output] = NEURONS_PER_M[model];
  return Math.round(((usage.prompt_tokens * input + usage.completion_tokens * output) / 1_000_000) * 10) / 10;
}

function show(value) {
  if (Array.isArray(value)) return value.map((item, index) => `${index + 1}. ${item}`).join("\n\n");
  return typeof value === "string" ? value : "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

const port = portArg(process.argv);
// Local only: never a remote URL.
const endpoint = `http://127.0.0.1:${port}/run`;
const texts = JSON.parse(readFileSync(join(HERE, "texts.json"), "utf8"));
mkdirSync(OUT, { recursive: true });

const md = [
  "# Translate check: 3 ALMAR texts x 3 models x Arabic and Spanish",
  "",
  `Run ${new Date().toISOString()} against the local check Worker (scripts/translate-check). Shape = every key back, every`,
  "list the English length, nothing empty. Neurons = estimate from the reported token usage (10,000 free a day).",
  "",
];

let total = 0;
for (const text of texts) {
  md.push(`## ${text.id}`, "", `Source: \`${text.source.file}\` (${text.source.field}).`, "", "### English", "");
  for (const [key, value] of Object.entries(text.fields)) md.push(`**${key}**`, "", show(value), "");
  for (const target of TARGETS) {
    md.push(`### ${TARGET_NAME[target]}`, "");
    for (const model of MODELS) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: model.id, target, fields: text.fields }),
      });
      const result = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}, body not JSON` } }));
      total += 1;
      const file = `${text.id}-${model.short}-${target}.json`;
      writeFileSync(join(OUT, file), JSON.stringify({ http_status: response.status, ...result }, null, 2) + "\n");
      const estimate = neurons(model.id, result.usage);
      const shape = result.shape ? (result.shape.ok ? "pass" : `FAIL: ${result.shape.reason}`) : "no answer";
      md.push(
        `#### ${model.short}`,
        "",
        `Shape: ${shape}. Text outside the JSON: ${result.extra_text ? "yes" : "no"}. Neurons: ${estimate ?? "not reported"}. Time: ${result.ms ?? "?"} ms. Raw: \`${file}\`.`,
        "",
      );
      if (result.error) md.push(`Error: \`${JSON.stringify(result.error)}\``, "");
      else if (result.parsed && typeof result.parsed === "object") {
        for (const [key, value] of Object.entries(result.parsed)) md.push(`**${key}**`, "", show(value), "");
      } else md.push("(no parsed output)", "");
      console.log(`${file}: HTTP ${response.status}, shape ${shape}`);
    }
  }
}

writeFileSync(join(OUT, "OUTPUTS.md"), md.join("\n"));
console.log(`${total} calls; wrote ${OUT}/OUTPUTS.md`);
