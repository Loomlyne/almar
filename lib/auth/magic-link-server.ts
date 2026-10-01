// Wires sendMagicLink to Supabase admin and Resend (plan 02-02; reused by the ops sign-in, 02-04).
import { Resend } from "resend";
import { headers } from "next/headers";
import { createSupabaseAdmin } from "../supabase/clients";
import { renderMagicLinkEmail } from "../email/magic-link";
import { GUEST_COPY } from "../copy/guest";
import { sendMagicLink, type SendLinkResult } from "./send-link";
import { isEmail, OWNER_EMAIL, type AuthLocale } from "./rules";
import { linkOrigin } from "./allowed-origin";

const FROM = "ALMAR Private Journey <inquiries@almarprivatejourney.com>";

function retryAfter(message: string | undefined): number | undefined {
  const match = message?.match(/(\d+)\s*seconds?/i);
  return match ? Number(match[1]) : undefined;
}

export async function requestOrigin(): Promise<string> {
  const list = await headers();
  return linkOrigin(list.get("host"), process.env.NODE_ENV);
}

export async function sendLinkFromRequest({
  email,
  host,
  locale,
}: {
  email: string;
  host: "public" | "ops";
  locale: AuthLocale;
}): Promise<SendLinkResult> {
  const admin = createSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!admin || !resendKey) {
    return isEmail(email.trim().toLowerCase()) ? { status: "unavailable" } : { status: "invalid" };
  }
  const resend = new Resend(resendKey);
  const copy = GUEST_COPY[locale];

  return sendMagicLink(
    { email, origin: await requestOrigin(), host, ownerEmail: OWNER_EMAIL, isEmail },
    {
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
