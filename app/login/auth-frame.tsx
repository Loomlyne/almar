"use client";

import type { ReactNode } from "react";
import { LocaleSelect } from "../../components/ui/locale-select";
import { GUEST_COPY } from "../../lib/copy/guest";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import type { DocumentLocale } from "../../lib/set-document-locale";
import charcoalLogo from "../../brand/Logo Typography/Stacked_Charcoal.svg";
import whiteLogo from "../../brand/Logo Typography/Poly_White.svg";

const IMAGE = "/assets/img/caedcb84dd0d35bb.webp";

/**
 * The split-screen frame of canvas board 6a, shared by the sign-in page and the Continue page
 * (plan 02-24): picture and tagline, logo, language select, contact line. `children` is the card.
 */
export function AuthFrame({
  locale,
  onLocaleChange,
  children,
  after,
}: {
  locale: DocumentLocale;
  onLocaleChange: (next: DocumentLocale) => void;
  children: ReactNode;
  /** Rendered after the frame's main column, e.g. the WhatsApp button. */
  after?: ReactNode;
}) {
  const copy = GUEST_COPY[locale];
  const localeCopy = JOURNEY_COPY[locale].locale;

  const brandLine = (
    <div className="grid gap-3">
      <span className="text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">
        ALMAR Private Journeys
      </span>
      <span className="font-display text-display tracking-display text-ivory">{copy.auth.tagline}</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ivory lg:flex-row">
      <div className="relative h-80 shrink-0 overflow-hidden bg-teal md:h-96 lg:order-2 lg:m-4 lg:h-auto lg:flex-1">
        <img src={IMAGE} alt={copy.auth.imageAlt} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-ink/30" aria-hidden="true" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-4 md:inset-x-8 md:top-6 lg:hidden">
          <a href="/" className="inline-flex min-h-control items-center" aria-label="ALMAR Private Journeys home">
            <img src={whiteLogo.src} alt="ALMAR Private Journeys" className="block h-auto w-28 md:w-37.5" />
          </a>
          <LocaleSelect kind="language" value={locale} tone="on-image" copy={localeCopy} onChange={(next) => onLocaleChange(next as DocumentLocale)} />
        </div>
        <div className="absolute inset-x-4 bottom-6 md:inset-x-8 md:bottom-8 lg:inset-x-12 lg:bottom-12">{brandLine}</div>
      </div>

      <main
        id="content"
        className="flex flex-1 flex-col justify-between gap-12 px-4 py-8 md:px-8 lg:order-1 lg:w-140 lg:flex-none lg:px-16"
      >
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <a href="/" className="inline-flex min-h-control items-center" aria-label="ALMAR Private Journeys home">
            <img src={charcoalLogo.src} alt="ALMAR Private Journeys" className="block h-auto w-37.5" />
          </a>
          <LocaleSelect kind="language" value={locale} copy={localeCopy} onChange={(next) => onLocaleChange(next as DocumentLocale)} />
        </div>

        {children}

        <span className="text-caption text-muted">
          <bdi>inquiries@almarprivatejourney.com</bdi>
        </span>
      </main>
      {after}
    </div>
  );
}
