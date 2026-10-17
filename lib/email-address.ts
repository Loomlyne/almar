// The one rule for "is this one plain email address" (review fix, 3.3 part B), shared by the contact form and its
// route (lib/contact-inquiry.ts isInquiryEmail), the newsletter route and the footer's newsletter box, so the browser
// never accepts an address the server refuses. A leaf module with no imports: client components and node tests load
// it without pulling any copy table.
//
// Rules: at most 254 characters; exactly one @; neither part holds whitespace, a control character or any of
// @ < > ( ) [ ] \ , ; : " ; the local part has no leading, trailing or doubled dot; the domain has at least two
// labels, every label non-empty (so no leading, trailing or doubled dot) and none starting or ending with a hyphen.
// Surrounding whitespace is the caller's to trim.

export const EMAIL_MAX_LENGTH = 254;

const PART = /^[^\s\u0000-\u001f\u007f-\u009f@<>()[\]\\,;:"]+$/;

export function isPlainEmail(value: string): boolean {
  if (value.length > EMAIL_MAX_LENGTH) return false;
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!PART.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => label.length > 0 && PART.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}
