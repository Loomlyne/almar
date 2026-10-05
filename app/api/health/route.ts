// GET /api/health -> {"ok":true}: the controller's proof after a deploy that server code runs (owner D-SR-01,
// job 10). No data, no environment read, no version.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
