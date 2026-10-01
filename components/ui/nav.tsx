"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../icons/icons";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { LocaleSelect } from "./locale-select";
import charcoalLogo from "../../brand/Logo Typography/Stacked_Charcoal.svg";
import whiteLogo from "../../brand/Logo Typography/Poly_White.svg";

const DEFAULT_LABELS = {
  destinations: "Destinations",
  experiences: "Experiences",
  about: "About",
  contact: "Contact",
  currency: "Currency",
  language: "Language",
  login: "Login",
  menu: "Menu",
  close: "Close menu",
  bookings: "Bookings",
  account: "Account",
  signOut: "Sign out",
} as const;

export type NavLabels = { [K in keyof typeof DEFAULT_LABELS]: string };

/** Matches the @6xl container variant (72rem). Below this, the menu stays. */
const NAV_ROW_MIN = 1152;

type Locale = "en" | "ar" | "es";
type Currency = "AED" | "USD" | "EUR";

const LINK =
  "inline-flex min-h-control items-center whitespace-nowrap px-3 font-body text-caption uppercase tracking-kicker no-underline ar:normal-case ar:tracking-normal hover:underline decoration-gold decoration-1 underline-offset-4";

const nav = cva("@container sticky top-0 z-40 w-full border-b", {
  variants: {
    tone: {
      solid: "border-line bg-ivory text-ink",
      "on-image": "absolute inset-x-0 border-transparent bg-transparent text-ivory",
    },
  },
  defaultVariants: { tone: "solid" },
});

export function SiteNav({
  locale,
  onLocale,
  labels,
  loginHref = "#log-in",
  markCurrent = true,
  currency: currencyProp,
  onCurrency,
  signedIn = false,
  onSignOut,
  tone = "solid",
}: {
  locale: Locale;
  onLocale: (next: Locale) => void;
  labels?: Partial<NavLabels>;
  loginHref?: string;
  markCurrent?: boolean;
  currency?: Currency;
  onCurrency?: (next: Currency) => void;
  /** No session exists this phase. Default false. Do not pass true from a call site. */
  signedIn?: boolean;
  onSignOut?: () => void;
  /** on-image sits over the hero: transparent bar, ivory text, Poly_White logo. */
  tone?: "solid" | "on-image";
}) {
  const text: NavLabels = { ...DEFAULT_LABELS, ...labels };
  const links = [
    [text.destinations, "#destinations"],
    [text.experiences, "#experiences"],
    [text.about, "#about"],
    [text.contact, "#contact"],
  ] as const;
  const [open, setOpen] = useState(false);
  const [currencyState, setCurrencyState] = useState<Currency>("AED");
  const currency = currencyProp ?? currencyState;
  function setCurrency(next: Currency) {
    if (currencyProp === undefined) setCurrencyState(next);
    onCurrency?.(next);
  }
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The Menu button is hidden while the menu is open, so focus returns to it after the re-render.
  const restoreFocusRef = useRef(false);

  function closeMenu() {
    restoreFocusRef.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    menuRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const root = headerRef.current;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const raw = entries[0]?.contentBoxSize;
      const box = Array.isArray(raw) ? raw[0] : raw;
      const width = box?.inlineSize ?? root.clientWidth;
      if (width >= NAV_ROW_MIN) setOpen(false);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const root = headerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: globalThis.KeyboardEvent) {
      // An open Language or Currency list handles its own Escape first.
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter(
        (node) => node.getClientRects().length > 0,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, menuId]);

  const onImage = tone === "on-image" && !open;
  const localeCopy = JOURNEY_COPY[locale].locale;
  const tools = onImage ? "on-image" : "default";
  const login = cn(LINK, "@6xl:ms-2");
  const closeMenuIfOpen = () => {
    if (open) closeMenu();
  };

  return (
    <header ref={headerRef} className={nav({ tone })}>
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-4 px-3 py-2 @6xl:gap-8 @6xl:px-6",
          open && "fixed inset-0 z-50 flex-col items-start overflow-auto overscroll-contain bg-ivory p-3 text-ink",
        )}
      >
        <a
          href="#content"
          aria-label="ALMAR Private Journeys home"
          className={cn("inline-flex min-h-control min-w-control items-center", open && "me-12")}
        >
          <img
            alt="ALMAR Private Journeys"
            src={(onImage ? whiteLogo : charcoalLogo).src}
            className="block h-auto w-28 @6xl:w-37.5"
          />
        </a>
        <button
          ref={menuRef}
          type="button"
          className={cn(
            "ms-auto inline-flex h-control min-w-control cursor-pointer items-center justify-center whitespace-nowrap rounded-none border px-4 font-body text-label uppercase tracking-kicker ar:normal-case ar:tracking-normal @6xl:hidden",
            onImage ? "border-ivory/70 bg-transparent text-ivory" : "border-muted bg-surface text-ink",
            open && "hidden",
          )}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(true)}
        >
          {text.menu}
        </button>
        <button
          ref={closeRef}
          type="button"
          className={cn(
            "absolute end-3 top-3 size-11 cursor-pointer items-center justify-center rounded-none border border-muted bg-surface text-teal",
            open ? "inline-flex" : "hidden",
          )}
          aria-label={text.close}
          onClick={closeMenu}
        >
          <CloseIcon size={20} />
        </button>
        <div
          id={menuId}
          className={cn(
            "min-w-0 gap-4 @6xl:flex @6xl:flex-1 @6xl:flex-row @6xl:items-center @6xl:gap-8",
            open ? "flex w-full flex-col items-start" : "hidden",
          )}
        >
          <nav
            aria-label="Primary"
            className="flex flex-col items-start @6xl:flex-row @6xl:items-center @6xl:gap-3"
          >
            {links.map(([name, href], index) => {
              const active = markCurrent && index === 0;
              return (
                <a
                  key={href}
                  href={href}
                  className={cn(LINK, active && "underline decoration-2")}
                  aria-current={active ? "page" : undefined}
                  onClick={closeMenuIfOpen}
                >
                  {name}
                </a>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-4 @6xl:ms-auto @6xl:flex-nowrap">
            <LocaleSelect
              kind="currency"
              dir={locale === "ar" ? "rtl" : "ltr"}
              value={currency}
              tone={tools}
              copy={localeCopy}
              onChange={(next) => setCurrency(next as Currency)}
            />
            <LocaleSelect
              kind="language"
              value={locale}
              tone={tools}
              copy={localeCopy}
              onChange={(next) => onLocale(next as Locale)}
            />
            {signedIn ? (
              <>
                <a className={login} href="/bookings" onClick={closeMenuIfOpen}>
                  {text.bookings}
                </a>
                <a className={login} href="/account" onClick={closeMenuIfOpen}>
                  {text.account}
                </a>
                <button
                  type="button"
                  className={cn(login, "cursor-pointer bg-transparent")}
                  onClick={() => {
                    closeMenuIfOpen();
                    onSignOut?.();
                  }}
                >
                  {text.signOut}
                </button>
              </>
            ) : (
              <a className={login} href={loginHref} onClick={closeMenuIfOpen}>
                {text.login}
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
