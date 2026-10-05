"use client";

import { SiteNav } from "../../../components/ui/nav";
import { localeHrefs, localePath, type Locale } from "../../../lib/locale-path";
import type { Scenes, SceneContext } from "../scene-types";

// Links built the way PublicFrame's callers build them for the localised pages: the first two are
// localised, the last two plain.
const links = (locale: Locale) => [
  { label: "[destinations]", href: localePath(locale, "/destinations") },
  { label: "[experiences]", href: localePath(locale, "/experiences") },
  { label: "[about]", href: "/about" },
  { label: "[contact]", href: "/contact" },
];

const nav = (ctx: SceneContext, currentPath: string) => {
  const locale = ctx.locale as Locale;
  return (
    <div data-testid="harness-nav-localised" className="min-h-96 bg-ivory">
      <SiteNav
        locale={locale}
        links={links(locale)}
        localeHrefs={localeHrefs("/experiences")}
        currentPath={currentPath}
        login={false}
        currency={false}
      />
      <main id="content" className="p-4">
        [Page content]
      </main>
    </div>
  );
};

export const scenes: Scenes = {
  // What PublicFrame passes: the English path.
  "english-path": (ctx) => nav(ctx, "/experiences"),
  // The localised path of the same page.
  "localised-path": (ctx) => nav(ctx, localePath(ctx.locale as Locale, "/experiences")),
  "not-in-nav": (ctx) => nav(ctx, "/private-stays"),
};
