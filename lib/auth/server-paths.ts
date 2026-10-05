// The exact paths job 02 (sign-in) serves from the server. No imports: node tests load this file directly.
// Opening them on the Worker is plan 02-23 task 3 (lib/server-routes.ts); this list is what the matcher test
// and that task both read. `/auth/handoff` (ops host) is not here: the ops host is not on Worker `almar` yet.
export const JOB02_SERVER_PATHS = [
  "/login",
  "/auth/confirm",
  "/auth/sign-out",
  "/auth/handoff/start",
  "/account",
  "/bookings",
] as const;
