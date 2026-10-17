import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMAIL_MAX_LENGTH, isPlainEmail } from "../lib/email-address.ts";
import { loadTs } from "./helpers/load-ts.mjs";

// Review fix (3.3 part B): one shared "plain email address" rule for the contact form, its route, the newsletter
// route and the footer box (lib/email-address.ts).

const inquiry = await loadTs("lib/contact-inquiry.ts");

// The four the review found accepted, then the rest of the rule.
const REVIEW = ["a@..b", "a@.b.c", "a@b.com.", "a@-b.com"];
const BAD = [
  ...REVIEW,
  "", "a", "@b.co", "a@", "a@b", "a@@b.co", "a@b@c.co", "a b@c.co", "a@b .co", "a@b..co", "a@b.co-", "a@b-.co",
  "a@b.-co", ".a@b.co", "a.@b.co", "a..b@c.co", "a<b@c.co", "a@b,c.co", "a@[1.2.3.4]", "a:b@c.co", '"a"@b.co',
  "a\\b@c.co", "a@b.c\u0000", "a\n@b.co", "a@b.c ".replace(" ", "\u0085"), ` a@b.co`, `a@b.co `,
  `${"x".repeat(243)}@example.com`,
];
const GOOD = [
  "ana.lopez@example.co", "o'brien+trip@mail.example.com", "guest@example.com", "a@b.co", "first.last@sub-domain.example.org",
  "x_y-z@a1.b2.c3", "名前@例え.jp", `${"x".repeat(242)}@example.com`,
];

test("the review's four addresses are invalid, and so is every other bad shape", () => {
  for (const bad of BAD) assert.equal(isPlainEmail(bad), false, JSON.stringify(bad));
});

test("ordinary addresses stay valid, up to 254 characters", () => {
  for (const good of GOOD) assert.equal(isPlainEmail(good), true, JSON.stringify(good));
  assert.equal(EMAIL_MAX_LENGTH, 254);
  assert.equal(EMAIL_MAX_LENGTH, inquiry.INQUIRY_LIMITS.email);
});

test("the contact form's rule is the same rule (isInquiryEmail and validateInquiry)", () => {
  for (const value of [...BAD, ...GOOD]) assert.equal(inquiry.isInquiryEmail(value), isPlainEmail(value), JSON.stringify(value));
  for (const bad of REVIEW) {
    const result = inquiry.validateInquiry({ name: "Ana", phone: "", email: bad, journeyType: "Group Event", details: "Hello", locale: "en" });
    assert.equal(result.ok, false, bad);
    assert.equal(result.errors.email, "invalid", bad);
  }
});

test("every place that checks an address uses the shared rule, and the module is a leaf", () => {
  const leaf = readFileSync("lib/email-address.ts", "utf8");
  assert.equal(/^import\b/m.test(leaf), false, "no imports");
  assert.match(readFileSync("lib/contact-inquiry.ts", "utf8"), /return value\.length <= INQUIRY_LIMITS\.email && isPlainEmail\(value\);/);
  const route = readFileSync("app/newsletter/route.ts", "utf8");
  assert.match(route, /from "\.\.\/\.\.\/lib\/email-address"/);
  assert.match(route, /!isPlainEmail\(trimmedEmail\)/);
  const footer = readFileSync("components/ui/footer.tsx", "utf8");
  assert.match(footer, /from "\.\.\/\.\.\/lib\/email-address"/);
  assert.match(footer, /!input\.checkValidity\(\) \|\| !isPlainEmail\(email\)/);
  // The contact route and the inquiry form reach it through validateInquiry.
  assert.match(readFileSync("app/api/contact/route.ts", "utf8"), /validateInquiry\(/);
  assert.match(readFileSync("components/pages/contact/inquiry-form.tsx", "utf8"), /validateInquiry\(/);
  // No second email pattern of its own anywhere it is checked.
  for (const file of ["lib/contact-inquiry.ts", "app/newsletter/route.ts", "components/ui/footer.tsx", "components/pages/contact/inquiry-form.tsx"]) {
    assert.equal(/LOOKS_LIKE_EMAIL|EMAIL_PART|@\[\^/.test(readFileSync(file, "utf8")), false, file);
  }
});
