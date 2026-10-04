"use client";

import { useState } from "react";
import { SiteFooter, type FooterCopy } from "../../../components/ui/footer";
import { ToastProvider } from "../../../components/ui/toast";
import type { Scenes, SceneContext } from "../scene-types";
import { harnessHref } from "./_images";

const COPY: FooterCopy = {
  pages: "[Pages]",
  contact: "[Contact]",
  instagram: "[Instagram]",
  newTab: "[opens in a new tab]",
  language: "[Language]",
  copyright: "[Copyright line]",
};

const LINKS = [
  { label: "[Destinations]", href: "/destinations/" },
  { label: "[Experiences]", href: "/experiences/" },
];

const languages = (locale: string) => [
  { label: "English", href: harnessHref("en"), lang: "en", current: locale === "en" },
  { label: "العربية", href: harnessHref("ar"), lang: "ar", current: locale === "ar" },
  { label: "Español", href: harnessHref("es"), lang: "es", current: locale === "es" },
];

function Newsletter({ ctx, withHandler }: { ctx: SceneContext; withHandler: boolean }) {
  const [sent, setSent] = useState<string[]>([]);
  return (
    <ToastProvider>
      <div data-testid="harness-footer">
        <SiteFooter
          copy={{
            ...COPY,
            newsletter: {
              title: "[Newsletter]",
              email: "[Email]",
              subscribe: "[Subscribe]",
              invalid: "[Enter a valid email]",
              success: "[Subscribed]",
            },
          }}
          links={LINKS}
          languageLinks={languages(ctx.locale)}
          newsletter
          onSubscribe={withHandler ? (email) => setSent((s) => [...s, email]) : undefined}
        />
        <output data-testid="subscribed">{sent.join(",")}</output>
      </div>
    </ToastProvider>
  );
}

export const scenes: Scenes = {
  default: (ctx) => (
    <div data-testid="harness-footer">
      <SiteFooter copy={COPY} links={LINKS} languageLinks={languages(ctx.locale)} />
    </div>
  ),
  "list-with-us-held": (ctx) => (
    <div data-testid="harness-footer">
      <SiteFooter
        copy={COPY}
        links={LINKS}
        languageLinks={languages(ctx.locale)}
        listWithUs={{ label: "[List with us]" }}
      />
    </div>
  ),
  "newsletter-on": (ctx) => <Newsletter ctx={ctx} withHandler />,
  "newsletter-no-handler": (ctx) => <Newsletter ctx={ctx} withHandler={false} />,
};
