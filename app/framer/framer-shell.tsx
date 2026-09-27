"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "../../components/ui/nav";
import styles from "./framer-shell.module.css";

type Locale = "en" | "ar" | "es";
type Currency = "AED" | "USD" | "EUR";

const HERO = '[data-framer-name="Hero Section"]';
const CURRENCY_COOKIE = "almar-currency";

function readCurrency(): Currency | null {
  const match = document.cookie.match(/(?:^|; )almar-currency=(AED|USD|EUR)(?:;|$)/);
  return match ? (match[1] as Currency) : null;
}

export function FramerShell() {
  const [locale, setLocale] = useState<Locale>("en");
  const [currency, setCurrency] = useState<Currency>("AED");
  const [rates, setRates] = useState<{ aed: number; eur: number } | null>(null);
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const saved = readCurrency();
    if (saved) setCurrency(saved);
  }, []);

  useEffect(() => {
    let gone = false;
    fetch("/fx")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { aed?: unknown; eur?: unknown } | null) => {
        if (gone || !body) return;
        const aed = typeof body.aed === "number" ? body.aed : Number.NaN;
        const eur = typeof body.eur === "number" ? body.eur : Number.NaN;
        if (!Number.isFinite(aed) || !Number.isFinite(eur)) return;
        setRates({ aed, eur });
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);

  function chooseCurrency(next: Currency) {
    setCurrency(next);
    document.cookie = `${CURRENCY_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  useEffect(() => {
    const frame = document.getElementById("content");
    if (!(frame instanceof HTMLIFrameElement)) return;
    const post = () => {
      frame.contentWindow?.postMessage(
        {
          currency,
          aed: rates?.aed ?? null,
          eur: rates?.eur ?? null,
          locale,
        },
        window.location.origin,
      );
    };
    frame.addEventListener("load", post);
    post();
    return () => frame.removeEventListener("load", post);
  }, [currency, locale, rates]);

  useEffect(() => {
    const frame = document.getElementById("content");
    if (!(frame instanceof HTMLIFrameElement)) return;

    let detach = () => {};

    const measure = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const hero = doc.querySelector(HERO);
      const nav = frame.parentElement?.querySelector("header.site-nav");
      if (!hero || !(nav instanceof HTMLElement)) return;
      const navHeight = nav.getBoundingClientRect().height;
      const heroBottom = hero.getBoundingClientRect().bottom;
      const next = heroBottom > navHeight;
      setOverHero((prev) => (prev === next ? prev : next));
    };

    const bind = () => {
      detach();
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) return;

      let observedHero: Element | null = null;
      const ro = new ResizeObserver(() => measure());

      const onScroll = () => {
        const hero = doc.querySelector(HERO);
        if (hero && hero !== observedHero) {
          if (observedHero) ro.unobserve(observedHero);
          ro.observe(hero);
          observedHero = hero;
        }
        measure();
      };

      win.addEventListener("scroll", onScroll, { passive: true });
      doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
      win.addEventListener("resize", onScroll);
      ro.observe(doc.documentElement);
      onScroll();

      detach = () => {
        win.removeEventListener("scroll", onScroll);
        doc.removeEventListener("scroll", onScroll, true);
        win.removeEventListener("resize", onScroll);
        ro.disconnect();
      };
    };

    frame.addEventListener("load", bind);
    bind();

    return () => {
      frame.removeEventListener("load", bind);
      detach();
    };
  }, []);

  const shellClass = overHero ? styles.shell : `${styles.shell} ${styles.isSolid}`;

  return (
    <div className={shellClass}>
      <SiteNav
        locale={locale}
        onLocale={setLocale}
        currency={currency}
        onCurrency={chooseCurrency}
      />
      <iframe id="content" className={styles.frame} title="ALMAR" src="/framer/source" />
    </div>
  );
}
