"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronIcon, CloseIcon } from "../icons/icons";

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
} as const;

export type NavLabels = { [K in keyof typeof DEFAULT_LABELS]: string };

/** Matches @container site-nav (min-width: 1088px). Below this, the menu stays. */
const NAV_ROW_MIN = 1088;

type Locale = "en" | "ar" | "es";
type Currency = "AED" | "USD" | "EUR";

const CURRENCIES = [
  { value: "AED", label: "AED" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
] as const;

const LOCALES = [
  { value: "en", label: "EN" },
  { value: "ar", label: "AR" },
  { value: "es", label: "ES" },
] as const;

type NavOption<T extends string> = { value: T; label: string };

/** Exported Framer logos. Ivory nav uses the black pair. URL strings, not SVG module objects. */
const WORDMARK_SRC = "https://framerusercontent.com/images/RX7lhKpzXFpv2KTvbxNSm3UZz8.svg";
const MONOGRAM_SRC = "https://framerusercontent.com/images/prMcX1bT4P2ZzVsjpoFmR4T5nA.svg";

function NavDrop<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly NavOption<T>[];
  onChange: (next: T) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    root?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();

    function onPointer(event: PointerEvent) {
      if (!root?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function focusIndex(index: number) {
    const nodes = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    nodes?.[index]?.focus();
  }

  function closeToTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: T) {
    onChange(next);
    closeToTrigger();
  }

  function onRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeToTrigger();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) setOpen(true);
  }

  function onOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusIndex((index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusIndex((index - 1 + options.length) % options.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusIndex(options.length - 1);
    }
  }

  return (
    <div ref={rootRef} className={className} onKeyDown={onRootKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="nav-drop-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="nav-drop-name">{label}</span>
        <span className="nav-drop-value">{selected.label}</span>
        <span className="nav-drop-icon" aria-hidden="true">
          <ChevronIcon size={16} />
        </span>
      </button>
      <ul
        id={listId}
        className={open ? "nav-drop-panel is-open" : "nav-drop-panel"}
        role="listbox"
        aria-label={label}
        aria-hidden={open ? undefined : true}
      >
        {options.map((option, index) => (
          <li key={option.value} role="presentation">
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              className="nav-drop-option"
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteNav({
  locale,
  onLocale,
  labels,
  loginHref = "#log-in",
  markCurrent = true,
  currency: currencyProp,
  onCurrency,
}: {
  locale: Locale;
  onLocale: (next: Locale) => void;
  labels?: Partial<NavLabels>;
  loginHref?: string;
  markCurrent?: boolean;
  currency?: Currency;
  onCurrency?: (next: Currency) => void;
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
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setOpen(false);
    menuRef.current?.focus();
  }

  useEffect(() => {
    const root = menuRef.current?.closest<HTMLElement>(".site-nav");
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
    const root = document.getElementById(menuId)?.closest(".site-nav");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        menuRef.current?.focus();
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

  return (
    <header className={open ? "site-nav is-menu" : "site-nav"}>
      <a className="wordmark" href="#content">
        <img className="wordmark-full" alt="ALMAR" src={WORDMARK_SRC} />
        <img className="wordmark-mark" alt="" src={MONOGRAM_SRC} />
      </a>
      <button
        ref={menuRef}
        type="button"
        className="nav-menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(true)}
      >
        {text.menu}
      </button>
      <button
        ref={closeRef}
        type="button"
        className="nav-close icon-button"
        aria-label={text.close}
        onClick={closeMenu}
      >
        <CloseIcon size={20} />
      </button>
      <div id={menuId} className="nav-panel">
        <nav className={open ? "site-links is-open" : "site-links"} aria-label="Primary">
          {links.map(([name, href], index) => (
            <a
              key={href}
              href={href}
              className={markCurrent && index === 0 ? "is-active" : undefined}
              aria-current={markCurrent && index === 0 ? "page" : undefined}
              onClick={() => {
                if (open) closeMenu();
              }}
            >
              {name}
            </a>
          ))}
        </nav>
        <div className="nav-tools">
          <NavDrop
            label={text.currency}
            value={currency}
            options={CURRENCIES}
            onChange={setCurrency}
            className="nav-drop is-currency"
          />
          <NavDrop
            label={text.language}
            value={locale}
            options={LOCALES}
            onChange={onLocale}
            className="nav-drop locale-switch"
          />
          <a
            className="nav-login"
            href={loginHref}
            onClick={() => {
              if (open) closeMenu();
            }}
          >
            {text.login}
          </a>
        </div>
      </div>
    </header>
  );
}
