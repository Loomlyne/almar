import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set(["Lato-Regular.ttf", "Lato-Bold.ttf", "Lato-Italic.ttf"]);

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const { file } = await context.params;
  if (!ALLOWED.has(file)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const bytes = await readFile(path.join(process.cwd(), "brand/Font/lato", file));
  return new Response(bytes, {
    headers: {
      "content-type": "font/ttf",
      "cache-control": "public, max-age=86400",
    },
  });
}
