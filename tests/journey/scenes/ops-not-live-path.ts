/**
 * A rail section the (ops) layout does not render yet: scene `ops-host-home` passes it to the layout and
 * tests/ops-coming-soon.spec.ts checks it is still off. When it goes live, change it here to the next section still off.
 * Home is "/" in the browser and "/home" after the host rewrite. Bookings, Customers and Profile are off too.
 */
export const NOT_LIVE_OPS_PATH = "/home";
