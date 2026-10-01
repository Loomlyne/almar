// The magic-link decision (plan 02-02, discuss answer 1: the link creates the account).
// Pure, with every outside call injected, so node tests can drive it without Supabase or Resend.

export type LinkKind = "sign-in" | "confirm";

export type SendLinkDeps = {
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

  const sent = await deps.sendEmail({ to: email, href: href.toString(), kind: exists ? "sign-in" : "confirm" });
  return sent ? { status: "sent" } : { status: "unavailable" };
}
