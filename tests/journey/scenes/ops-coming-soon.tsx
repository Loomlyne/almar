import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import type { ReactNode } from "react";
import { isLiveOpsPath } from "../../../lib/ops-routes";
import { NOT_LIVE_OPS_PATH } from "./ops-not-live-path";
import type { Scenes } from "../scene-types";

/**
 * The ops host as the (ops) layout builds it for the owner: `<OpsShell mode="ops">{isLiveOpsPath(path) ? children : null}</OpsShell>`
 * (app/dashboard/(ops)/layout.tsx), with the real live-section list. The owner session and the host rewrite are not here
 * (tests/host-gate.test.mjs covers them); this is the part that decides a page or "Not ready.".
 */
const opsHost = (path: string, page: ReactNode) => () => <OpsShell mode="ops">{isLiveOpsPath(path) ? page : null}</OpsShell>;

/**
 * No Coming soon page is left in the rail: Pages, Navigation and footer (06-02), Blog (06-03) and Legal (06-04) are real
 * screens. Test-only.
 */
export const scenes: Scenes = {
  // A path that is not live (no rail section is left off after 05-04; "/catalog" has no page): the same layout shows
  // "Not ready." even though a page is passed (a stand-in, not a real screen). The path is shared with
  // tests/ops-coming-soon.spec.ts, which asserts isLiveOpsPath is false for it.
  "ops-host-home": opsHost(NOT_LIVE_OPS_PATH, <p>stand-in page</p>),
};
