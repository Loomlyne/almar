// Sign-in limiter inputs (plan 02-26). Pure apart from node:crypto, so node tests import it.
// Only keyed hashes ever leave the server for the database: never an address, never an IP.
import { createHmac } from "node:crypto";

/**
 * A GoTrue `hashed_token` is lowercase hex (a SHA-224 digest, 56 characters, today). The range is wider on
 * purpose so a digest change upstream does not lock everyone out; anything else never reaches Supabase.
 */
export function isTokenHashShape(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,128}$/.test(value);
}

/** HMAC-SHA256 hex of `kind:value` under the derived limiter key. `kind` keeps email, IP and confirm hashes apart. */
export function limiterHash(key: Buffer, kind: "email" | "ip" | "confirm", value: string): string {
  return createHmac("sha256", key).update(`${kind}\n${value}`).digest("hex");
}

function parseIPv4(text: string): number[] | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/** Eight 16-bit groups, or null when the text is not an IPv6 address. Handles `::` and a trailing dotted IPv4. */
function parseIPv6(text: string): number[] | null {
  let value = text.replace(/^\[|\]$/g, "");
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  if (!value.includes(":")) return null;

  const tail = value.slice(value.lastIndexOf(":") + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    value = `${value.slice(0, value.lastIndexOf(":") + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const toGroups = (side: string): string[] | null => {
    if (side === "") return [];
    const groups = side.split(":");
    return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) ? groups : null;
  };
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !rest) return null;

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * The limiter's IP identity: an IPv4 address in full, an IPv6 address by its /64 (the first four groups,
 * expanded), an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) as that IPv4. Missing or unreadable is "none".
 */
export function ipLimitKey(address: string | null | undefined): string {
  const text = (address ?? "").trim();
  if (!text) return "none";
  const v4 = parseIPv4(text);
  if (v4) return `v4:${v4.join(".")}`;
  const v6 = parseIPv6(text);
  if (!v6) return "none";
  if (v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff) {
    return `v4:${[v6[6] >> 8, v6[6] & 255, v6[7] >> 8, v6[7] & 255].join(".")}`;
  }
  return `v6:${v6.slice(0, 4).map((g) => g.toString(16).padStart(4, "0")).join(":")}`;
}

/** The visitor IP the Worker set from cf-connecting-ip: the first x-forwarded-for entry. */
export function visitorIpKey(forwardedFor: string | null | undefined): string {
  return ipLimitKey(forwardedFor?.split(",")[0]);
}
