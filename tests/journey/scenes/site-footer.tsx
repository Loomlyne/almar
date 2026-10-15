"use client";

import { useState } from "react";
import { SiteFooter, type FooterCopy, type FooterNewsletterCopy } from "../../../components/ui/footer";
import { ToastProvider } from "../../../components/ui/toast";
import { NEWSLETTER_HONEYPOT_FIELDS } from "../../../lib/newsletter";
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

const NEWS: FooterNewsletterCopy = {
  title: "[Newsletter]",
  description: "[Newsletter line]",
  email: "[Email]",
  subscribe: "[Subscribe]",
  sending: "[Sending]",
  invalid: "[Enter a valid email]",
  success: "[Subscribed]",
  failed: "[Not added]",
  dismiss: "[Close]",
};

function Newsletter({ ctx, withHandler }: { ctx: SceneContext; withHandler: boolean }) {
  const [sent, setSent] = useState<string[]>([]);
  return (
    <ToastProvider>
      <div data-testid="harness-footer">
        <SiteFooter
          copy={{ ...COPY, newsletter: NEWS }}
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

/**
 * Plan 27: the light footer as PublicFrame renders it, with the 11 honeypots. `mode` picks the handler: "ok" waits
 * ~300 ms then resolves, "fails" waits ~300 ms then rejects, "record" resolves and writes the honeypot object it got.
 * No page-level ToastProvider: the footer brings its own.
 */
function LightNewsletter({ ctx, mode }: { ctx: SceneContext; mode: "ok" | "fails" | "record" }) {
  const [out, setOut] = useState("");
  const wait = () => new Promise((resolve) => window.setTimeout(resolve, 300));
  const handler = async (email: string, honeypots: Record<string, string>) => {
    await wait();
    if (mode === "fails") throw new Error("[handler failed]");
    setOut(mode === "record" ? JSON.stringify(honeypots) : email);
  };
  return (
    <div data-testid="harness-footer">
      <SiteFooter
        copy={{ ...COPY, newsletter: NEWS }}
        links={LINKS}
        languageLinks={languages(ctx.locale)}
        newsletter
        onSubscribe={handler}
        honeypotFields={NEWSLETTER_HONEYPOT_FIELDS}
        tone="light"
      />
      <output data-testid="subscribed">{out}</output>
    </div>
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
  "newsletter-light": (ctx) => <LightNewsletter ctx={ctx} mode="ok" />,
  "newsletter-fails": (ctx) => <LightNewsletter ctx={ctx} mode="fails" />,
  "newsletter-honeypot": (ctx) => <LightNewsletter ctx={ctx} mode="record" />,
};
