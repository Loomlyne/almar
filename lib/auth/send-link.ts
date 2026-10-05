// The magic-link decision (plan 02-02, discuss answer 1: the link creates the account).
// Pure, with every outside call injected, so node tests can drive it without Supabase or Resend.

export type LinkKind = "sign-in" | "confirm";

export type SendLinkDeps = {
  /**
   * Counts this request against the per-email and per-IP limits. False means over the limit.
   * A thrown error means the limiter could not answer: the result is "unavailable" (fail closed).
   */
  claimSlot(email: string): Promise<boolean>;
  /** True when a profiles row exists for this (normalised) email. */
  accountExists(email: string): Promise<boolean>;
  /**
   * Supabase admin generateLink({ type: "magiclink" }): it creates the user when the email is
   * new. Returns the hashed token and the verification type to put in our own confirm URL.
   */
  generateLink(email: string): Promise<
    | { ok: true; tokenHash: string; verificationType: string }
    | { ok: false; retryAfterSeconds?: number }
  >;
  /**
   * Plan 02-24: the masked email `m` and its signature `s` for the Continue page. Undefined when
   * there is no signing key: the link then carries neither and the page shows no email. Plan 02-26: `b` (browser)
   * and `e` (email) are HMACs for the forwarded-link check; the link never carries the email itself.
   */
  continueProof?(tokenHash: string, email: string): { m?: string; s?: string; b?: string; e?: string } | undefined;
  sendEmail(input: { to: string; href: string; kind: LinkKind }): Promise<boolean>;
};

export type SendLinkResult =
  | { status: "sent" }
  | { status: "invalid" }
  | { status: "refused" }
  | { status: "wait"; seconds: number }
  | { status: "unavailable" };

export async function sendMagicLink(
  input: {
    email: string;
    /** The origin she asked on, e.g. https://almarprivatejourney.com. */
    origin: string;
    host: "public" | "ops";
    ownerEmail: string;
    isEmail(value: string): boolean;
  },
  deps: SendLinkDeps,
): Promise<SendLinkResult> {
  const email = input.email.trim().toLowerCase();
  if (!input.isEmail(email)) return { status: "invalid" };
  const owner = email === input.ownerEmail;

  // The ops host only ever signs the owner in (02-04). Nothing is called for anyone else.
  if (input.host === "ops" && !owner) return { status: "refused" };

  // Over the limit still says "sent" and sends nothing, so the page leaks nothing. If the limiter
  // itself fails, nothing is sent and the visitor is told it is unavailable.
  let allowed: boolean;
  try {
    allowed = await deps.claimSlot(email);
  } catch {
    return { status: "unavailable" };
  }
  if (!allowed) return { status: "sent" };

  const exists = await deps.accountExists(email);
  // The owner account is made in the Supabase dashboard, never by a link (D-42, D-44). If it is
  // missing, say "sent" like any other address and send nothing, so the page leaks nothing.
  if (owner && !exists) return { status: "sent" };

  const link = await deps.generateLink(email);
  if (!link.ok) {
    if (link.retryAfterSeconds && link.retryAfterSeconds > 0) {
      return { status: "wait", seconds: Math.ceil(link.retryAfterSeconds) };
    }
    return { status: "unavailable" };
  }

  const href = new URL("/auth/confirm", input.origin);
  href.searchParams.set("token_hash", link.tokenHash);
  href.searchParams.set("type", link.verificationType);
  const proof = deps.continueProof?.(link.tokenHash, email);
  if (proof) {
    for (const name of ["m", "s", "b", "e"] as const) {
      const value = proof[name];
      if (value) href.searchParams.set(name, value);
    }
  }

  const sent = await deps.sendEmail({ to: email, href: href.toString(), kind: exists ? "sign-in" : "confirm" });
  return sent ? { status: "sent" } : { status: "unavailable" };
}
