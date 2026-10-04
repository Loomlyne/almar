// Wires sendMagicLink to Supabase admin and Resend (plan 02-02; reused by the ops sign-in, 02-04).
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { headers } from "next/headers";
import { createSupabaseAdmin } from "../supabase/clients";
import { renderMagicLinkEmail } from "../email/magic-link";
import { GUEST_COPY } from "../copy/guest";
import { sendMagicLink, type SendLinkResult } from "./send-link";
import { maskEmail, signContinue } from "./continue";
import { isEmail, OWNER_EMAIL, type AuthLocale } from "./rules";
import { linkOrigin } from "./allowed-origin";
import { SHELL_HEADER } from "../host";

const FROM = "ALMAR Private Journey <inquiries@almarprivatejourney.com>";

function retryAfter(message: string | undefined): number | undefined {
  const match = message?.match(/(\d+)\s*seconds?/i);
  return match ? Number(match[1]) : undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The visitor IP the Worker set from cf-connecting-ip: the first x-forwarded-for entry, else "none". */
function visitorIp(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || "none";
}

export async function requestOrigin(): Promise<string> {
  const list = await headers();
  return linkOrigin(list.get("host"), process.env.NODE_ENV);
}

/**
 * The host comes from the shell header the middleware set, never from the caller: any server
 * action can be posted to any path, so the ops refusal must not depend on which action ran.
 */
export async function sendLinkFromRequest({
  email,
  locale,
}: {
  email: string;
  locale: AuthLocale;
}): Promise<SendLinkResult> {
  const host = (await headers()).get(SHELL_HEADER) === "ops" ? "ops" : "public";
  // The ops host refuses a guest email before any service is touched, configured or not.
  const address = email.trim().toLowerCase();
  if (host === "ops" && isEmail(address) && address !== OWNER_EMAIL) return { status: "refused" };

  const admin = createSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!admin || !resendKey) {
    return isEmail(email.trim().toLowerCase()) ? { status: "unavailable" } : { status: "invalid" };
  }
  const resend = new Resend(resendKey);
  const copy = GUEST_COPY[locale];
  const ipHash = sha256(visitorIp((await headers()).get("x-forwarded-for")));

  return sendMagicLink(
    { email, origin: await requestOrigin(), host, ownerEmail: OWNER_EMAIL, isEmail },
    {
      async claimSlot(address) {
        // Hashes only leave this function. A failed call throws, and sendMagicLink fails closed.
        const { data, error } = await admin.rpc("claim_link_slot", {
          p_email_hash: sha256(address),
          p_ip_hash: ipHash,
        });
        if (error || typeof data !== "boolean") throw new Error("claim_link_slot failed");
        return data;
      },
      async accountExists(address) {
        const { data } = await admin.from("profiles").select("id").eq("email", address).maybeSingle();
        return Boolean(data);
      },
      async generateLink(address) {
        const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: address });
        if (error || !data?.properties?.hashed_token) {
          return { ok: false, retryAfterSeconds: error?.status === 429 ? retryAfter(error.message) : undefined };
        }
        return {
          ok: true,
          tokenHash: data.properties.hashed_token,
          verificationType: data.properties.verification_type,
        };
      },
      continueProof(tokenHash, address) {
        const m = maskEmail(address);
        const s = m ? signContinue(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), tokenHash, m) : undefined;
        return m && s ? { m, s } : undefined;
      },
      async sendEmail({ to, href, kind }) {
        const message = renderMagicLinkEmail({
          href,
          locale,
          kind,
          copy: { ...copy.mail, button: copy.accessWithMagicLink },
        });
        const { error } = await resend.emails.send({
          from: FROM,
          to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        return !error;
      },
    },
  );
}
