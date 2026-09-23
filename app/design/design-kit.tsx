"use client";

import { useState } from "react";
import { notoNaskh, notoSans } from "../../lib/fonts";

const SWATCHES = [
  { name: "Ivory", token: "var(--color-bg)" },
  { name: "Teal", token: "var(--color-heading)" },
  { name: "Gold", token: "var(--color-accent)" },
  { name: "Charcoal", token: "var(--color-fg)" },
] as const;

const NOTO_CLASSES = `${notoNaskh.variable} ${notoSans.variable}`.split(" ");

type Locale = "en" | "ar" | "es";

function setLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}

export function DesignKit() {
  const [shown, setShown] = useState(false);
  const [locale, setLocaleState] = useState<Locale>("en");
  const [compact, setCompact] = useState(false);

  function chooseLocale(next: Locale) {
    setLocaleState(next);
    setLocale(next);
  }

  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    if (next) document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
  }

  return (
    <main className="kit" id="content">
      <header className="kit-bar">
        <h1>
          <bdi>Design system</bdi>
        </h1>
        <div className="kit-controls">
          <button
            type="button"
            className="kit-control"
            aria-pressed={locale === "en"}
            onClick={() => chooseLocale("en")}
          >
            EN
          </button>
          <button
            type="button"
            className="kit-control"
            aria-pressed={locale === "ar"}
            onClick={() => chooseLocale("ar")}
          >
            AR
          </button>
          <button
            type="button"
            className="kit-control"
            aria-pressed={locale === "es"}
            onClick={() => chooseLocale("es")}
          >
            ES
          </button>
          <button
            type="button"
            className="kit-control"
            aria-pressed={compact}
            onClick={toggleCompact}
          >
            Compact
          </button>
        </div>
      </header>

      <section className="kit-section" aria-label="Color">
        <ul className="swatches">
          {SWATCHES.map((swatch) => (
            <li key={swatch.name}>
              <figure className="swatch">
                <div
                  className="swatch-chip"
                  style={{ background: swatch.token }}
                />
                <figcaption>
                  <bdi>{swatch.name}</bdi>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className="kit-section">
        <div className="field">
          <label className="field-label" htmlFor="design-password">
            Password
          </label>
          <div className="field-control">
            <input
              id="design-password"
              name="password"
              type={shown ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="eye"
              aria-label={shown ? "Hide password" : "Show password"}
              onClick={() => setShown((value) => !value)}
            >
              <EyeIcon hidden={shown} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      className="eye-icon"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M1.75 10S4.5 4.75 10 4.75 18.25 10 18.25 10 15.5 15.25 10 15.25 1.75 10 1.75 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      {hidden ? (
        <path
          d="M4 16 16 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
