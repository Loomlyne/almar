import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { ComingSoonScreen } from "../../../app/dashboard/(ops)/content/coming-soon";
import type { Scenes } from "../scene-types";

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
};
