// The exact paths job 02 (sign-in) serves from the server. No imports: node tests load this file directly.
// Opening them on the Worker is plan 02-23 task 3 (lib/server-routes.ts); this list is what the matcher test
// and that task both read. `/auth/handoff` (ops host) is not here: the ops host is not on Worker `almar` yet.
// Job 21: the sign-in, account and bookings pages are at /en/…, /ar/…, /es/…; /auth/* stays unprefixed.
export const JOB02_SERVER_PATHS = [
  "/en/login",
  "/ar/login",
  "/es/login",
  "/auth/confirm",
  "/auth/sign-out",
  "/auth/handoff/start",
  "/en/account",
  "/ar/account",
  "/es/account",
  "/en/bookings",
  "/ar/bookings",
  "/es/bookings",
] as const;
