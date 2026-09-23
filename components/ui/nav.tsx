"use client";

import { useState } from "react";
import wordmark from "../../brand/Logo Typography/Poly_Black.svg";
import monogram from "../../brand/Logo Monogram/Curves_black.svg";
import { CloseIcon } from "../icons/icons";

const LINKS = [
  ["Destinations", "#destinations"],
  ["Experiences & Services", "#experiences"],
  ["About", "#about"],
  ["Contact", "#contact"],
  ["Log in", "#log-in"],
] as const;

type Locale = "en" | "ar" | "es";

function svgUri(source: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

export function SiteNav({
  locale,
  onLocale,
}: {
  locale: Locale;
  onLocale: (next: Locale) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-nav">
      <a className="wordmark" href="#content">
        <img className="wordmark-full" alt="ALMAR" src={svgUri(wordmark)} />
        <img className="wordmark-mark" alt="" src={svgUri(monogram)} />
      </a>
      <button type="button" className="nav-menu" aria-expanded={open} onClick={() => setOpen(true)}>
        Menu
      </button>
      <nav className={open ? "site-links is-open" : "site-links"} aria-label="Primary">
        {LINKS.map(([name, href], index) => (
          <a
            key={name}
            href={href}
            className={index === 0 ? "is-active" : undefined}
            aria-current={index === 0 ? "page" : undefined}
          >
            {name}
          </a>
        ))}
        <button type="button" className="nav-close icon-button" aria-label="Close menu" onClick={() => setOpen(false)}>
          <CloseIcon size={20} />
        </button>
      </nav>
      <div className="locale-switch" role="group" aria-label="Language">
        {(["en", "ar", "es"] as const).map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={locale === code}
            className={locale === code ? "is-active" : undefined}
            onClick={() => onLocale(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}
