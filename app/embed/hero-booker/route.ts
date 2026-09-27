import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const ENTRY = path.join(process.cwd(), "lib/framer-hero-booker-mount.tsx");
const SOURCES = [
  ENTRY,
  path.join(process.cwd(), "components/specimens/hero-booker.tsx"),
  path.join(process.cwd(), "components/ui/calendar.tsx"),
  path.join(process.cwd(), "components/icons/icons.tsx"),
  path.join(process.cwd(), "lib/home-copy.ts"),
];
const OUTFILE = path.join(process.cwd(), ".next/cache/almar-hero-booker.js");

let cached: { stamp: number; js: string } | null = null;

async function stamp() {
  const times = await Promise.all(SOURCES.map(async (file) => (await stat(file)).mtimeMs));
  return Math.max(...times);
}

async function bundle() {
  const current = await stamp();
  if (cached && cached.stamp === current) return cached.js;

  await execFileAsync(path.join(process.cwd(), "node_modules/esbuild/bin/esbuild"), [
    ENTRY,
    "--bundle",
    "--format=iife",
    "--platform=browser",
    "--target=es2020",
    "--jsx=automatic",
    "--legal-comments=none",
    `--outfile=${OUTFILE}`,
    '--define:process.env.NODE_ENV="production"',
  ]);

  const js = await readFile(OUTFILE, "utf8");
  cached = { stamp: current, js };
  return js;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const js = await bundle();
  return new Response(js, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
