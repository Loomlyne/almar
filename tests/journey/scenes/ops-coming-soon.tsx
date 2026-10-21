import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import type { ReactNode } from "react";
import { ComingSoonScreen } from "../../../app/dashboard/(ops)/content/coming-soon";
import { isLiveOpsPath } from "../../../lib/ops-routes";
import { NOT_LIVE_OPS_PATH } from "./ops-not-live-path";
import type { Scenes } from "../scene-types";

/**
 * The ops host as the (ops) layout builds it for the owner: `<OpsShell mode="ops">{isLiveOpsPath(path) ? children : null}</OpsShell>`
 * (app/dashboard/(ops)/layout.tsx), with the real screen and the real live-section list (the page.tsx files are one-line wrappers
 * around ComingSoonScreen, pinned by tests/phase-03-content.test.mjs; a client scene cannot import them, they export `metadata`). The owner session and the host rewrite
 * are not here (tests/host-gate.test.mjs covers them); this is the part that decides Coming soon or "Not ready.".
 */
const opsHost = (path: string, page: ReactNode) => () => <OpsShell mode="ops">{isLiveOpsPath(path) ? page : null}</OpsShell>;

/** The four Coming soon pages (plan 03.2-12) inside the preview shell, so the Content rail with its Soon chips is in view. Test-only. */
export const scenes: Scenes = {
  pages: () => (
    <OpsShell mode="preview">
      <ComingSoonScreen kind="pages" />
    </OpsShell>
  ),
  blog: () => (
    <OpsShell mode="preview">
      <ComingSoonScreen kind="blog" />
    </OpsShell>
  ),
  legal: () => (
    <OpsShell mode="preview">
      <ComingSoonScreen kind="legal" />
    </OpsShell>
  ),
  navigation: () => (
    <OpsShell mode="preview">
      <ComingSoonScreen kind="navigation" />
    </OpsShell>
  ),
  "ops-host-pages": opsHost("/content/pages", <ComingSoonScreen kind="pages" />),
  "ops-host-blog": opsHost("/content/blog", <ComingSoonScreen kind="blog" />),
  "ops-host-legal": opsHost("/content/legal", <ComingSoonScreen kind="legal" />),
  "ops-host-navigation": opsHost("/content/navigation", <ComingSoonScreen kind="navigation" />),
  // A rail section not live yet (Home today; Bookings, Customers and Profile are off too): the same layout shows
  // "Not ready." even though a page is passed. The path is shared with tests/ops-coming-soon.spec.ts, which asserts
  // isLiveOpsPath is false for it; when that section is wired, ops-not-live-path.ts moves to the next one still off.
  "ops-host-home": opsHost(NOT_LIVE_OPS_PATH, <ComingSoonScreen kind="legal" />),
};
