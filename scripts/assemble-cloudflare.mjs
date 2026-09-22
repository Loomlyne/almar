import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, ".next/server/app");
const outDir = path.join(root, "out");
const notFoundRoute = path.join(root, "app/[...not_found]/route.ts");

execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!fs.existsSync(appDir)) {
  throw new Error(`missing build output: ${appDir}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outDir, { recursive: true });
}

const bodies = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith(".body")) bodies.push(full);
  }
}
walk(appDir);

for (const body of bodies) {
  const rel = path.relative(appDir, body).replace(/\.body$/, "");
  const dest =
    rel === "index"
      ? path.join(outDir, "index.html")
      : path.join(outDir, `${rel}.html`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(body, dest);
}

const source = fs.readFileSync(notFoundRoute, "utf8");
const match = source.match(/const HTML = `([\s\S]*)`;\r?\n\r?\nexport function GET/);
if (!match) {
  throw new Error("could not extract branded 404 HTML");
}
fs.writeFileSync(path.join(outDir, "404.html"), match[1]);

const headers = path.join(root, "_headers");
if (fs.existsSync(headers)) {
  fs.copyFileSync(headers, path.join(outDir, "_headers"));
}

const html = [];
function countHtml(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) countHtml(full);
    else if (ent.name.endsWith(".html")) html.push(path.relative(outDir, full));
  }
}
countHtml(outDir);
if (!html.includes("index.html") || !html.includes("404.html")) {
  throw new Error(`assemble incomplete: ${html.join(", ")}`);
}
console.log(`assembled ${html.length} html files into out/`);
