import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const BOOKINGS_PAGE = "app/dashboard/(ops)/bookings/page.tsx";
const BOOKINGS_SCREEN = "app/dashboard/(ops)/bookings/bookings-screen.tsx";
const CUSTOMERS_PAGE = "app/dashboard/(ops)/customers/page.tsx";
const CUSTOMERS_SCREEN = "app/dashboard/(ops)/customers/customers-screen.tsx";

const SAMPLE_GUEST_NAMES = ["Maria", "Ahmed", "Sofia", "John Doe", "Jane Doe"];

test("bookings and customers pages have no page gate (02-04 owner gate in the layout) and delegate to client screens", () => {
  const bookingsPage = readFileSync(BOOKINGS_PAGE, "utf8");
  assert.equal(bookingsPage.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(bookingsPage), false);
  assert.match(bookingsPage, /from ["']\.\/bookings-screen["']/);

  const customersPage = readFileSync(CUSTOMERS_PAGE, "utf8");
  assert.equal(customersPage.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(customersPage), false);
  assert.match(customersPage, /from ["']\.\/customers-screen["']/);
});

test("bookings screen delegates to BookingsList, fetches /api/ops/bookings through opsFetch, renders no New booking control and no Sidebar", () => {
  const text = readFileSync(BOOKINGS_SCREEN, "utf8");
  assert.match(text, /<BookingsList\b/);
  assert.match(text, /opsFetch<[^>]*>\(\s*"\/api\/ops\/bookings"/);
  assert.doesNotMatch(text, /Sidebar|newBooking|New booking|<tbody/);
  // 04-09: the destination names come from the list (name_ar / name_es), never one detail read per destination.
  assert.doesNotMatch(text, /"\/api\/ops\/destinations",\s*\{\s*id/);
  assert.match(text, /name_ar/);
  assert.match(text, /name_es/);
});

test("customers screen has the locked columns, empty line, and New customer action", () => {
  const text = readFileSync(CUSTOMERS_SCREEN, "utf8");
  for (const column of ["Name", "Email", "Phone", "Bookings count"]) {
    assert.equal(text.includes(column), true, `missing column: ${column}`);
  }
  assert.match(text, /copy\.noCustomersYet/);
  assert.match(text, /copy\.newCustomer/);
  assert.match(text, /<tbody\s*\/>/, "customers tbody must not render a sample row");
});

test("neither screen has a detail route file", () => {
  assert.equal(existsSync("app/dashboard/(ops)/bookings/[id]"), false);
  assert.equal(existsSync("app/dashboard/(ops)/customers/[id]"), false);
});

test("no bookings or customers source contains a sample guest name", () => {
  const sources = [BOOKINGS_PAGE, BOOKINGS_SCREEN, CUSTOMERS_PAGE, CUSTOMERS_SCREEN].map((path) =>
    readFileSync(path, "utf8"),
  );
  for (const text of sources) {
    for (const name of SAMPLE_GUEST_NAMES) {
      assert.equal(text.includes(name), false, `found sample name ${name}`);
    }
  }
});

test("sidebar.tsx keeps its close control and docks to the end side", () => {
  const text = readFileSync("components/ui/sidebar.tsx", "utf8");
  assert.match(text, /Close/);
  assert.match(text, /\bend-0\b/);
  assert.equal(text.includes("dockEnd"), false);
});

test("04-09: no copy word followed by a hard-coded colon in the bookings screens (the colon lives in the copy)", () => {
  const files = [
    "app/dashboard/(ops)/bookings/bookings-list.tsx",
    "app/dashboard/(ops)/bookings/bookings-screen.tsx",
    "app/dashboard/(ops)/bookings/bookings-text.ts",
    "app/dashboard/(ops)/bookings/bookings-errors.ts",
    "app/dashboard/(ops)/bookings/detail/booking-detail.tsx",
    "app/dashboard/(ops)/bookings/detail/booking-detail-screen.tsx",
    "app/dashboard/(ops)/bookings/detail/booking-dialogs.tsx",
  ];
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    assert.doesNotMatch(text, /\{(?:[A-Z]|copy)(?:\.\w+)+\}\s*:/, `${path}: a {copy word}: in JSX`);
    assert.doesNotMatch(text, /\$\{(?:[A-Z]|copy)(?:\.\w+)+\}: /, `${path}: a \${copy word}: in a template`);
  }
});
