"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CloseIcon } from "../../../components/icons/icons";
import { Sidebar } from "../../../components/ui/sidebar";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../lib/copy/dashboard";
import { isDocumentLocale, setDocumentLocale, type DocumentLocale } from "../../../lib/set-document-locale";
import styles from "../dashboard.module.css";

/** Same URL strings as the unexported constants in components/ui/nav.tsx. */
const WORDMARK_SRC = "https://framerusercontent.com/images/RX7lhKpzXFpv2KTvbxNSm3UZz8.svg";
const MONOGRAM_SRC = "https://framerusercontent.com/images/prMcX1bT4P2ZzVsjpoFmR4T5nA.svg";
const INTERIOR_MARK = "DASHBOARD";

type RailKey = keyof DashboardCopy["rail"];
type RailLink = { key: RailKey; label: string; href: string };
type RailGroup = { key: RailKey; label: string; children: RailLink[] };
type RailItem = RailLink | RailGroup;

const RAIL: RailItem[] = [
  { key: "home", label: "Home", href: "/dashboard/home" },
  { key: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { key: "customers", label: "Customers", href: "/dashboard/customers" },
  { key: "calendar", label: "Calendar", href: "/dashboard/calendar" },
  {
    key: "catalog",
    label: "Catalog",
    children: [
      { key: "destinations", label: "Destinations", href: "/dashboard/catalog/destinations" },
      { key: "stays", label: "Stays", href: "/dashboard/catalog/stays" },
      { key: "experiences", label: "Experiences & Services", href: "/dashboard/catalog/experiences" },
      { key: "packages", label: "Packages", href: "/dashboard/catalog/packages" },
    ],
  },
  {
    key: "content",
    label: "Content",
    children: [
      { key: "pages", label: "Pages", href: "/dashboard/content/pages" },
      { key: "blog", label: "Blog", href: "/dashboard/content/blog" },
      { key: "team", label: "Team", href: "/dashboard/content/team" },
      { key: "legal", label: "Legal", href: "/dashboard/content/legal" },
    ],
  },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
  { key: "profile", label: "Profile", href: "/dashboard/profile" },
];

function isGroup(item: RailItem): item is RailGroup {
  return "children" in item;
}

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function OpsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    const next = readLocale();
    setLocale(next);
    setDocumentLocale(next);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-density");
    root.setAttribute("data-density", "compact");
    return () => {
      if (previous) root.setAttribute("data-density", previous);
      else root.removeAttribute("data-density");
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1439px)");
    function syncViewport(event: MediaQueryList | MediaQueryListEvent) {
      setCompact(event.matches);
      if (!event.matches) setMenuOpen(false);
    }
    syncViewport(query);
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const root = document.getElementById(menuId);
    root?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = [...(root?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])].filter(
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
  }, [menuOpen, menuId]);

  function renderLink(item: RailLink) {
    const current = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={styles.railLink}
        aria-current={current ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
      >
        {copy.rail[item.key]}
      </Link>
    );
  }

  return (
    <div
      className={styles.shell}
      data-density="compact"
      style={{ paddingInline: "max(env(safe-area-inset-left), env(safe-area-inset-right))" }}
    >
      <a className={styles.skip} href="#content">
        {copy.skip}
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/dashboard/home">
          <img className={styles.wordmark} alt="ALMAR" src={WORDMARK_SRC} />
          <img className={styles.monogram} alt="" src={MONOGRAM_SRC} />
          <span className={styles.interiorMark}>{INTERIOR_MARK}</span>
        </Link>
        {menuOpen ? (
          <button
            type="button"
            className={styles.menuButton}
            aria-label={copy.closeMenu}
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
          >
            <CloseIcon size={20} />
          </button>
        ) : (
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={false}
            aria-controls={menuId}
            aria-label={copy.menu}
            onClick={() => setMenuOpen(true)}
          >
            <MenuGlyph />
          </button>
        )}
      </header>
      <div className={styles.body}>
        <nav
          id={menuId}
          className={menuOpen ? styles.railOpen : styles.rail}
          aria-label={INTERIOR_MARK}
          inert={compact && !menuOpen ? true : undefined}
        >
          {RAIL.map((item) =>
            isGroup(item) ? (
              <div className={styles.group} key={item.key}>
                <p className={styles.groupLabel}>{copy.rail[item.key]}</p>
                <div className={styles.children}>{item.children.map(renderLink)}</div>
              </div>
            ) : (
              renderLink(item)
            ),
          )}
        </nav>
        <main id="content" className={styles.content} inert={menuOpen ? true : undefined}>
          {children}
        </main>
      </div>
      <Sidebar open={false} onOpenChange={() => undefined} title={copy.rail.home} closeLabel={copy.close} />
    </div>
  );
}
