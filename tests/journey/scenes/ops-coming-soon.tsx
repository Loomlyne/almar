"use client";

import { useLayoutEffect, useState } from "react";
// The ops shell the owner sees (job 02: the layout picks a mode, the shell itself is a client component). Each state is
// framed in the preview shell, so the new rail (Media, Navigation and footer, the Soon chips) is in the picture.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { ComingSoonScreen } from "../../../app/dashboard/(ops)/content/coming-soon";
import type { ComingSoonKind } from "../../../lib/copy/ops-content";
import type { Scenes } from "../scene-types";

/**
 * The four Coming soon pages of Content (plan 03.2-12): Pages, Blog, Legal, Navigation and footer. Test-only.
 * The route each page lives at, so the rail marks the right entry as the current one (as it does on the real route).
 */
const ROUTE: Record<ComingSoonKind, string> = {
  pages: "/dashboard/content/pages",
  blog: "/dashboard/content/blog",
  legal: "/dashboard/content/legal",
  navigation: "/dashboard/content/navigation",
};

/**
 * The shell and the screen read the almar-locale cookie; the harness picks the language from ?l=, so set it first.
 * The address bar is then set to the page's own route (Next syncs usePathname with history.replaceState), so the rail
 * shows the current entry. The page is not reloaded.
 */
function Frame({ kind, locale }: { kind: ComingSoonKind; locale: string }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    // null state: Next's patched replaceState adds its own tree and syncs usePathname (a state with its __NA flag would skip that).
    window.history.replaceState(null, "", ROUTE[kind]);
    setReady(true);
  }, [kind, locale]);
  return ready ? (
    <OpsShell mode="preview">
      <ComingSoonScreen kind={kind} />
    </OpsShell>
  ) : null;
}

export const scenes: Scenes = {
  pages: ({ locale }) => <Frame kind="pages" locale={locale} />,
  blog: ({ locale }) => <Frame kind="blog" locale={locale} />,
  legal: ({ locale }) => <Frame kind="legal" locale={locale} />,
  navigation: ({ locale }) => <Frame kind="navigation" locale={locale} />,
};
