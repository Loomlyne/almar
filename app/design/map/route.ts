import https from "node:https";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-only. Set MAPBOX_ACCESS_TOKEN in the process environment.
// Do not hardcode a token, and do not use NEXT_PUBLIC_.

const MAP_HOST = "api.mapbox.com";
const LON = -75.5478;
const LAT = 10.4236;
const ZOOM = 13.27;

function mapboxToken(): string | null {
  const value = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  return value ? value : null;
}

function mapPath(accessToken: string): string {
  const overlay = `pin-l+262626(${LON},${LAT})`;
  const camera = `${LON},${LAT},${ZOOM},0,0`;
  const query = new URLSearchParams({
    access_token: accessToken,
    attribution: "true",
    logo: "true",
  });
  return `/styles/v1/mapbox/streets-v12/static/${overlay}/${camera}/448x448@2x?${query}`;
}

function loadMap(accessToken: string): Promise<{ status: number; type: string; body: Buffer } | null> {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: MAP_HOST,
        path: mapPath(accessToken),
        headers: { Accept: "image/png,image/jpeg,image/webp" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", () => resolve(null));
  });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const accessToken = mapboxToken();
  if (!accessToken) {
    return new NextResponse(null, { status: 404 });
  }

  const upstream = await loadMap(accessToken);
  if (!upstream || upstream.status !== 200 || !upstream.type.startsWith("image/")) {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(new Uint8Array(upstream.body), {
    status: 200,
    headers: {
      "Content-Type": upstream.type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
