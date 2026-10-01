import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const BOOKINGS_PAGE = "app/dashboard/(ops)/bookings/page.tsx";
const BOOKINGS_SCREEN = "app/dashboard/(ops)/bookings/bookings-screen.tsx";
const CUSTOMERS_PAGE = "app/dashboard/(ops)/customers/page.tsx";
const CUSTOMERS_SCREEN = "app/dashboard/(ops)/customers/customers-screen.tsx";

const SAMPLE_GUEST_NAMES = ["Maria", "Ahmed", "Sofia", "John Doe", "Jane Doe"];

test("bookings and customers pages gate production and delegate to client screens", () => {
  const bookingsPage = readFileSync(BOOKINGS_PAGE, "utf8");
  assert.equal(bookingsPage.includes("use client"), false);
  assert.match(bookingsPage, /NODE_ENV/);
  assert.match(bookingsPage, /notFound\(\)/);
  assert.match(bookingsPage, /from ["']\.\/bookings-screen["']/);

  const customersPage = readFileSync(CUSTOMERS_PAGE, "utf8");
  assert.equal(customersPage.includes("use client"), false);
  assert.match(customersPage, /NODE_ENV/);
  assert.match(customersPage, /notFound\(\)/);
  assert.match(customersPage, /from ["']\.\/customers-screen["']/);
});

test("bookings screen has the locked columns, empty line, and New booking action", () => {
  const text = readFileSync(BOOKINGS_SCREEN, "utf8");
  for (const column of ["Guest", "Destination", "Dates", "Status"]) {
    assert.equal(text.includes(column), true, `missing column: ${column}`);
  }
  assert.match(text, /copy\.noBookingsYet/);
  assert.match(text, /copy\.newBooking/);
  assert.match(text, /<tbody\s*\/>/, "bookings tbody must not render a sample row");
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
