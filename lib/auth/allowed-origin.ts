// Which origin a magic link may point at. The Host header is not trusted on its own: a link is
// only ever built for one of these hosts (no-dependency module, loaded by node tests too).

const PUBLIC_HOSTS = ["almarprivatejourney.com", "www.almarprivatejourney.com"];
const OPS_HOST = "dashboard.almarprivatejourney.com";
const CANONICAL = "https://almarprivatejourney.com";

export function linkOrigin(host: string | null | undefined, nodeEnv: string | undefined): string {
  const name = (host ?? "").trim().toLowerCase();
  if (PUBLIC_HOSTS.includes(name) || name === OPS_HOST) return `https://${name}`;
  if (nodeEnv !== "production") {
    // Dev server and tests: 127.0.0.1 or localhost with a port, plain http.
    if (/^(127\.0\.0\.1|localhost|dashboard\.localhost)(:\d{2,5})?$/.test(name)) return `http://${name}`;
  }
  return CANONICAL;
}
