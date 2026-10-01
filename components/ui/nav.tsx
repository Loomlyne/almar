"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../icons/icons";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { LocaleSelect } from "./locale-select";
import { AccountMenu, type NavAccount } from "./account-menu";
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
  profile: "Profile",
  preferences: "Preferences",
  accountMenu: "Account menu",
  /** Shown in the currency control while no currency has been chosen. */
  currencyNone: "Currency",
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

export type NavLink = { label: string; href: string };

export function SiteNav({
  locale,
  onLocale,
  labels,
  loginHref = "#log-in",
  markCurrent = true,
  currency: currencyProp,
  onCurrency,
  account = null,
  tone = "solid",
  links: linksProp,
  homeHref = "#content",
  localeHrefs,
  currentPath,
  login: loginProp,
}: {
  locale: Locale;
  /** Optional on pages whose language switch is a navigation (see localeHrefs). */
  onLocale?: (next: Locale) => void;
  labels?: Partial<NavLabels>;
  loginHref?: string;
  /** Without currentPath: the first link is marked current, as before. */
  markCurrent?: boolean;
  /**
   * Omitted: the currency control keeps its own state, starting at AED (today's behaviour).
   * A currency: controlled. null: controlled with no choice yet, nothing selected.
   * false: no currency control at all (a page with no amount has nothing to convert).
   */
  currency?: Currency | null | false;
  onCurrency?: (next: Currency) => void;
  /** The signed-in guest, read on the server (plan 02-02). Null shows Login. */
  account?: NavAccount | null;
  /** on-image sits over the hero: transparent bar, ivory text, Poly_White logo. */
  tone?: "solid" | "on-image";
  /** Real, locale-aware links. Omitted: the four page anchors of the one-page layout. */
  links?: NavLink[];
  /** Where the wordmark goes. */
  homeHref?: string;
  /** The same page in each language (same-origin paths): the language switch navigates. */
  localeHrefs?: Record<string, string>;
  /** The page's own path. The link whose href equals it is aria-current; none when none does. */
  currentPath?: string;
  /** false omits Login (no session exists yet). Anything else keeps it. */
  login?: false;
  /** The cart is not live: there is no cart UI, so only false (the default) is accepted. */
  cart?: false;
}) {
  const text: NavLabels = { ...DEFAULT_LABELS, ...labels };
  const links: NavLink[] = linksProp ?? [
    { label: text.destinations, href: "#destinations" },
    { label: text.experiences, href: "#experiences" },
    { label: text.about, href: "#about" },
    { label: text.contact, href: "#contact" },
  ];
  const [open, setOpen] = useState(false);
  const [currencyState, setCurrencyState] = useState<Currency>("AED");
  const showCurrency = currencyProp !== false;
  const currency = currencyProp === undefined ? currencyState : currencyProp === false ? null : currencyProp;
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
    // cn() merges the cva string, so the tone's `absolute` replaces the base `sticky` (both are `position`).
    <header ref={headerRef} className={cn(nav({ tone }))}>
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-4 px-3 py-2 @6xl:gap-8 @6xl:px-6",
          open && "fixed inset-0 z-50 flex-col items-start overflow-auto overscroll-contain bg-ivory p-3 text-ink",
        )}
      >
        <a
          href={homeHref}
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
            {links.map(({ label, href }, index) => {
              const active = currentPath !== undefined ? href === currentPath : markCurrent && index === 0;
              return (
                <a
                  key={href}
                  href={href}
                  className={cn(LINK, active && "underline decoration-2")}
                  aria-current={active ? "page" : undefined}
                  onClick={closeMenuIfOpen}
                >
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-4 @6xl:ms-auto @6xl:flex-nowrap">
            {showCurrency ? (
              <LocaleSelect
                kind="currency"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={currency}
                placeholder={text.currencyNone}
                tone={tools}
                copy={localeCopy}
                onChange={(next) => setCurrency(next as Currency)}
              />
            ) : null}
            <LocaleSelect
              kind="language"
              value={locale}
              hrefs={localeHrefs}
              tone={tools}
              copy={localeCopy}
              onChange={(next) => onLocale?.(next as Locale)}
            />
            {account ? (
              <AccountMenu
                account={account}
                tone={tools}
                onNavigate={closeMenuIfOpen}
                labels={{
                  menuLabel: text.accountMenu,
                  bookings: text.bookings,
                  profile: text.profile,
                  preferences: text.preferences,
                  signOut: text.signOut,
                }}
              />
            ) : loginProp === false ? null : (
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
