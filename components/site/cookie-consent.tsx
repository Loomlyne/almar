"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { RichText } from "../ui/rich-text";
import { Switch } from "../ui/switch";
import { ANALYTICS_HOSTS, CF_WEB_ANALYTICS_TOKEN } from "../../lib/analytics-config";
import { parseConsent, serializeConsent } from "../../lib/consent";
import { COOKIE_CONSENT_COPY } from "../../lib/copy/cookie-consent";
import type { CookieBannerText } from "../../lib/data/types";
import type { Locale } from "../../lib/locale-path";

const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const OPEN_EVENT = "almar:open-cookie-settings";

const TEXT_LINK =
  "inline-flex min-h-control w-max cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4";

/** Opens the settings sheet from anywhere on the page: the footer's Cookie settings. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Appends the one beacon script, only on the live hosts. Called only once the visitor has accepted analytics; Cloudflare Web
 * Analytics sets no cookie of its own, and it still waits for consent (owner, F-05).
 */
export function loadBeacon(token: string, doc: Document = document, hostname: string = window.location.hostname): boolean {
  if (!ANALYTICS_HOSTS.includes(hostname)) return false;
  if (doc.querySelector(`script[src="${BEACON_SRC}"]`)) return false;
  const script = doc.createElement("script");
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  doc.head.appendChild(script);
  return true;
}

/** The owner's blocks: a heading keeps an anchor id of its place (a banner has one on the page, so nothing clashes). */
const blocksOf = (banner: CookieBannerText) =>
  banner.body.map((block, i) => (block.type === "heading" ? { type: "heading" as const, text: block.text, id: `cookie-banner-${i + 1}` } : { type: block.type, text: block.text }));

/**
 * The cookie banner and its settings sheet (pictures signed 2026-10-30). Renders nothing without published banner words or
 * without the token: then no banner, no sheet and no beacon. The server's HTML never has it: the choice is read on mount, so
 * with JavaScript off nothing shows and nothing loads. The banner is not a modal: the page stays usable, it sits above the
 * WhatsApp float, and Escape does not accept. A loaded script cannot be unloaded, so withdrawing stores the choice and reloads.
 */
export function CookieConsent({ locale, banner, privacyHref }: { locale: Locale; banner: CookieBannerText | null; privacyHref: string | null }) {
  const copy = COOKIE_CONSENT_COPY[locale];
  const token = CF_WEB_ANALYTICS_TOKEN;
  const enabled = banner !== null && token !== null;
  const [showBanner, setShowBanner] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const choice = parseConsent(document.cookie);
    if (choice === null) {
      before.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setShowBanner(true);
    } else if (choice.analytics) {
      loadBeacon(token);
    }
    const onOpen = () => {
      setAnalytics(parseConsent(document.cookie)?.analytics === true);
      setSheetOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [enabled, token]);

  // Focus moves into the banner when it appears; there is no trap, Tab leaves it.
  useEffect(() => {
    if (showBanner) bannerRef.current?.focus({ preventScroll: true });
  }, [showBanner]);

  if (!enabled) return null;

  function choose(next: boolean) {
    const wasOn = parseConsent(document.cookie)?.analytics === true;
    document.cookie = serializeConsent({ analytics: next });
    if (wasOn && !next) {
      window.location.reload();
      return;
    }
    if (next) loadBeacon(token as string);
    setSheetOpen(false);
    if (showBanner) {
      setShowBanner(false);
      before.current?.focus({ preventScroll: true });
    }
  }

  const privacy = privacyHref ? (
    <a className={TEXT_LINK} href={privacyHref}>
      {copy.privacyLink}
    </a>
  ) : null;

  return (
    <>
      {showBanner ? (
        <div
          ref={bannerRef}
          role="dialog"
          aria-modal="false"
          aria-label={copy.settings}
          tabIndex={-1}
          className="fixed inset-x-4 bottom-19 z-65 flex max-w-180 flex-col gap-3 border border-line border-t-gold bg-surface p-4 text-ink outline-none md:px-6 md:py-5"
        >
          <h2 className="m-0 font-display text-title font-normal text-teal">{banner.title}</h2>
          {banner.body.length > 0 ? <RichText blocks={blocksOf(banner)} className="gap-3" /> : null}
          {privacy}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button className="w-full md:w-max" onClick={() => choose(true)}>
              {copy.acceptAnalytics}
            </Button>
            <Button className="w-full md:w-max" variant="secondary" onClick={() => choose(false)}>
              {copy.necessaryOnly}
            </Button>
            <button type="button" className={TEXT_LINK} onClick={openCookieSettings}>
              {copy.settings}
            </button>
          </div>
        </div>
      ) : null}
      <Dialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={copy.settings}
        closeLabel={copy.close}
        footer={
          <>
            <Button onClick={() => choose(analytics)}>{copy.save}</Button>
            {privacy}
          </>
        }
      >
        <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="m-0 font-body text-body font-bold text-ink">{banner.necessary_label}</p>
            {banner.necessary_body ? <p className="m-0 text-pretty font-body text-body text-ink">{banner.necessary_body}</p> : null}
          </div>
          <div className="flex min-h-control shrink-0 items-center gap-3">
            <span className="font-body text-label text-muted">{copy.alwaysOn}</span>
            <Switch label="" aria-label={banner.necessary_label} className="gap-0" checked disabled />
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="m-0 font-body text-body font-bold text-ink">{banner.analytics_label}</p>
            {banner.analytics_body ? <p className="m-0 text-pretty font-body text-body text-ink">{banner.analytics_body}</p> : null}
          </div>
          <div className="flex min-h-control shrink-0 items-center">
            <Switch label="" aria-label={banner.analytics_label} className="gap-0" checked={analytics} onCheckedChange={setAnalytics} />
          </div>
        </div>
      </Dialog>
    </>
  );
}
