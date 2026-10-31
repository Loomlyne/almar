/**
 * A path the (ops) layout does not render: scene `ops-host-home` passes it to the layout and tests/ops-coming-soon.spec.ts
 * checks it is still off. After plan 05-04 no rail section is left off, so this is a path, not a section still to come:
 * "/catalog" is a parent with no page of its own.
 */
export const NOT_LIVE_OPS_PATH = "/catalog";
