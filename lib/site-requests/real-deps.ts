// The real outside things of lib/site-requests/submit.ts, for the three route files (plan 06-05). Apart from submit.ts because
// lib/supabase/clients.ts reaches next/headers, which node tests cannot load. The service-role key is read only in
// clients.ts (tests/secrets.test.mjs) and the mail key only here, as the contact route reads it. Nothing submitted is logged.

import { Resend } from "resend";
import { readSiteSettings, emailBrand, siteSettingsEnv } from "../site-settings-read";
import { createSupabaseAdmin } from "../supabase/clients";
import type { OutgoingEmail, SiteRequestDeps } from "./submit";

async function send(email: OutgoingEmail, { idempotencyKey }: { idempotencyKey: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const { data, error } = await new Resend(key).emails.send(email, { idempotencyKey });
    if (error || typeof data?.id !== "string" || !data.id) {
      // The error's name only (a fixed Resend code), never the payload, the error object or a field.
      console.error("site-request: send failed", typeof error?.name === "string" ? error.name : "no id");
      return false;
    }
    return true;
  } catch {
    console.error("site-request: send failed", "exception");
    return false;
  }
}

export function realDeps(): SiteRequestDeps {
  return {
    admin: createSupabaseAdmin(),
    send,
    brand: async () => emailBrand(await readSiteSettings(siteSettingsEnv())),
    now: () => new Date(),
  };
}
