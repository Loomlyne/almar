import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-only. Read the existing RESEND_API_KEY from the process environment.
// Do not hardcode a key, do not write one into the repo, .env.example, or the
// JSON response. Missing/empty key is a 503, not an invented success.

const HONEYPOT_FIELDS = [
  "title",
  "website",
  "company",
  "message",
  "subject",
  "description",
  "feedback",
  "notes",
  "details",
  "remarks",
  "comments",
] as const;

function resendApiKey(): string | null {
  const value = process.env.RESEND_API_KEY?.trim();
  return value ? value : null;
}

function isFilled(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const formData = await request.formData();

  for (const field of HONEYPOT_FIELDS) {
    if (isFilled(formData.get(field))) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  }

  const email = formData.get("Email");
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const apiKey = resendApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.contacts.create({
    email: trimmedEmail,
    unsubscribed: false,
  });

  if (error || typeof data?.id !== "string" || data.id.length === 0) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
}
