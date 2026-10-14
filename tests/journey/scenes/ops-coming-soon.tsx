import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import type { ReactNode } from "react";
import { ComingSoonScreen } from "../../../app/dashboard/(ops)/content/coming-soon";
import { isLiveOpsPath } from "../../../lib/ops-routes";
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
  // Team is not a live section yet (03.2-08): the same layout shows "Not ready." even though a page is passed.
  "ops-host-team": opsHost("/content/team", <ComingSoonScreen kind="legal" />),
};
