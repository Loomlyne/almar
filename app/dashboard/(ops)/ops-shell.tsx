"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronIcon, CloseIcon } from "../../../components/icons/icons";
import { cn } from "../../../lib/cn";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { signOutEverywhere } from "../actions";
import { clearBookingsSearch } from "../../../lib/ops/bookings-handoff";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../lib/copy/dashboard";
import { OPS_CONTENT_COPY } from "../../../lib/copy/ops-content";
import { OPS_MEDIA_COPY } from "../../../lib/copy/ops-media";
import { OPS_REQUESTS_COPY } from "../../../lib/copy/ops-requests";
import { OPS_SITE_STATUS_COPY } from "../../../lib/copy/ops-site-status";
import { SiteStatusLine } from "../../../components/ops/site-status-line";
import { isDocumentLocale, setDocumentLocale, type DocumentLocale } from "../../../lib/set-document-locale";
import { SoonChip } from "./content/coming-soon";
import charcoalLogo from "../../../brand/Logo Typography/Stacked_Charcoal.svg";

// "media" takes its label from the Media screen's own copy (plan 03.2-09) and "navigation" from lib/copy/ops-content.ts
// (plan 03.2-12), "requests" and "consultation" from lib/copy/ops-requests.ts (plan 06-05), so the shared dashboard copy is not
// edited. `soon` adds the Soon chip: the section is a Coming soon page.
type RailKey = keyof DashboardCopy["rail"] | "media" | "navigation" | "requests" | "consultation";
type RailLink = { key: RailKey; label: string; href: string; soon?: true };
type RailGroup = { key: RailKey; label: string; children: RailLink[] };
type RailItem = RailLink | RailGroup;

const RAIL: RailItem[] = [
  { key: "home", label: "Home", href: "/dashboard/home" },
  { key: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { key: "requests", label: "Requests", href: "/dashboard/requests" },
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
      { key: "media", label: "Media", href: "/dashboard/content/media" },
      { key: "navigation", label: "Navigation and footer", href: "/dashboard/content/navigation" },
      { key: "consultation", label: "Consultation", href: "/dashboard/content/consultation" },
    ],
  },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
  { key: "profile", label: "Profile", href: "/dashboard/profile" },
];

const RAIL_ITEM =
  "flex min-h-control w-full items-center justify-between gap-2 px-2 text-start font-body text-label transition-colors duration-fast ease-standard";
const MENU_BUTTON =
  "inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border border-line bg-surface p-0 text-teal xl:hidden";

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

/** Where a rail href points: the ops host never shows /dashboard in the URL (plan 02-04). */
function toHref(mode: OpsMode, href: string): string {
  return mode === "ops" ? href.replace(/^\/dashboard/, "") || "/" : href;
}

/**
 * "preview": the dev server's /dashboard review of the drawn screens (3.1 D-55).
 * "ops": the ops host after the owner is in. Unwired sections show `Not ready.` and the rail ends
 * with Sign out and Logout-all.
 */
export type OpsMode = "preview" | "ops";

export function OpsShell({ children, mode, logoSrc = null }: { children: ReactNode; mode: OpsMode; logoSrc?: string | null }) {
  const pathname = usePathname();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const signOutForm = useRef<HTMLFormElement>(null);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(false);
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const copy = DASHBOARD_COPY[locale];
  const content = OPS_CONTENT_COPY[locale];
  const railLabel = (key: RailKey) =>
    key === "requests" ? OPS_REQUESTS_COPY[locale].title : key === "consultation" ? OPS_REQUESTS_COPY[locale].ctitle : key === "media" ? OPS_MEDIA_COPY[locale].media : key === "navigation" ? content.rail.navigation : copy.rail[key];

  useEffect(() => {
    const next = readLocale();
    setLocale(next);
    setDocumentLocale(next);
  }, []);

  // Plan 05-04: a guest's email handed from Customers to Bookings is dropped as soon as the owner is anywhere but the
  // Bookings list or detail, so it cannot surface on a later visit.
  useEffect(() => {
    const onBookings = pathname !== null && /^(\/dashboard)?\/bookings(\/|$)/.test(pathname);
    if (!onBookings) clearBookingsSearch();
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith(toHref(mode, "/dashboard/catalog"))) setCatalogOpen(true);
  }, [pathname, mode]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-density");
    root.setAttribute("data-density", "compact");
    return () => {
      if (previous) root.setAttribute("data-density", previous);
      else root.removeAttribute("data-density");
    };
  }, []);

  // The drawer starts below the header, and the header is one row or two (on a phone the publish status line wraps onto its
  // own row, plan 03.2-05): follow its real height in --ops-header-h instead of a fixed offset.
  useEffect(() => {
    const header = headerRef.current;
    const shell = shellRef.current;
    if (!header || !shell) return;
    const measure = () => shell.style.setProperty("--ops-header-h", `${header.getBoundingClientRect().height}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
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
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const toggle = menuButtonRef.current ? [menuButtonRef.current] : [];
      const nodes = [...toggle, ...(root?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])].filter(
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

  useEffect(() => {
    if (menuOpen || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    menuButtonRef.current?.focus();
  }, [menuOpen]);

  function closeMenu() {
    restoreFocusRef.current = true;
    setMenuOpen(false);
  }

  function renderLink(item: RailLink, nested = false) {
    const href = toHref(mode, item.href);
    const current = pathname === href || (mode === "ops" && item.key === "home" && pathname === "/");
    return (
      <Link
        key={href}
        href={href}
        className={cn(RAIL_ITEM, nested && "ps-4", current ? "bg-teal-tint text-teal" : "text-ink hover:bg-ivory")}
        aria-current={current ? "page" : undefined}
        aria-label={item.soon ? content.soonNamed.replace("{label}", railLabel(item.key)) : undefined}
        onClick={() => setMenuOpen(false)}
      >
        {item.soon ? (
          <>
            <span>{railLabel(item.key)}</span>
            <SoonChip>{content.soon}</SoonChip>
          </>
        ) : (
          railLabel(item.key)
        )}
      </Link>
    );
  }

  function renderGroup(item: RailGroup) {
    if (item.key === "catalog") {
      const subId = `${menuId}-catalog`;
      return (
        <div key={item.key} className="flex flex-col">
          <button
            type="button"
            className={cn(RAIL_ITEM, "justify-between text-ink hover:bg-ivory", catalogOpen && "text-teal")}
            aria-expanded={catalogOpen}
            aria-controls={subId}
            onClick={() => setCatalogOpen((value) => !value)}
          >
            <span>{railLabel(item.key)}</span>
            <ChevronIcon
              size={16}
              className={cn("shrink-0 text-teal rtl:-scale-x-100", catalogOpen ? "-rotate-90" : "rotate-90")}
            />
          </button>
          <div
            id={subId}
            role="group"
            aria-label={railLabel(item.key)}
            className={cn("ms-4 flex-col border-s border-line", catalogOpen ? "flex" : "hidden")}
          >
            {item.children.map((child) => renderLink(child, true))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col" key={item.key}>
        <p className="m-0 flex min-h-control items-center px-2 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
          {railLabel(item.key)}
        </p>
        <div className="ms-4 flex flex-col border-s border-line">{item.children.map((child) => renderLink(child, true))}</div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-ivory text-ink"
      data-density="dense"
      style={{ paddingInline: "max(env(safe-area-inset-left), env(safe-area-inset-right))" }}
    >
      <a
        className="absolute start-4 top-2 z-100 inline-flex min-h-control items-center bg-surface px-2 text-teal not-focus:sr-only"
        href="#content"
      >
        {copy.skip}
      </a>
      <header ref={headerRef} className="sticky top-0 z-50 flex min-h-control flex-wrap items-center justify-between gap-2 border-b border-line bg-ivory px-4 py-1">
        <Link className="flex min-h-control min-w-0 items-center gap-2 text-teal" href={mode === "ops" ? "/" : "/dashboard/home"}>
          <img className="block aspect-2/1 h-auto w-35 max-w-full object-contain object-left" alt="ALMAR" src={logoSrc ?? charcoalLogo.src} />
          <span className="hidden whitespace-nowrap font-display text-label uppercase tracking-kicker xl:inline ar:normal-case ar:tracking-normal">
            {copy.dashboardName}
          </span>
        </Link>
        {/* Plan 03.2-05: the public site's update status, owner on the ops host only (never in the dev preview shell). */}
        {mode === "ops" ? <SiteStatusLine copy={OPS_SITE_STATUS_COPY[locale]} /> : null}
        <button
          ref={menuButtonRef}
          type="button"
          className={MENU_BUTTON}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? copy.closeMenu : copy.menu}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          {menuOpen ? <CloseIcon size={20} /> : <MenuGlyph />}
        </button>
      </header>
      <div className="flex min-w-0 flex-1 items-stretch">
        <nav
          id={menuId}
          className={cn(
            "flex-col gap-0 border-e border-line bg-surface p-2 xl:flex xl:w-sidebar xl:shrink-0",
            menuOpen ? "fixed inset-0 z-45 flex overflow-auto overscroll-contain border-e-0 bg-ivory" : "hidden",
          )}
          style={menuOpen ? { paddingTop: "calc(var(--ops-header-h, 5rem) + 0.5rem)" } : undefined}
          aria-label={copy.dashboardName}
          inert={compact && !menuOpen ? true : undefined}
        >
          {RAIL.map((item) => (isGroup(item) ? renderGroup(item) : renderLink(item)))}
          {mode === "ops" ? (
            <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
              <button type="button" className={cn(RAIL_ITEM, "text-ink hover:bg-ivory")} onClick={() => setSignOutOpen(true)}>
                {copy.signOut}
              </button>
              <button type="button" className={cn(RAIL_ITEM, "text-ink hover:bg-ivory")} onClick={() => setLogoutAllOpen(true)}>
                {copy.logoutAll}
              </button>
            </div>
          ) : null}
        </nav>
        <main id="content" className="min-w-0 flex-1 scroll-mt-16 p-4" inert={menuOpen ? true : undefined}>
          {mode === "ops" && !children ? (
            <h1 className="m-0 font-display text-heading font-normal text-teal">{copy.notReady}</h1>
          ) : (
            children
          )}
        </main>
      </div>
      {mode === "ops" ? (
        <>
          <form ref={signOutForm} action="/auth/sign-out" method="post" hidden />
          <ConfirmDialog
            open={signOutOpen}
            onOpenChange={setSignOutOpen}
            title={copy.signOut}
            confirmLabel={copy.signOutOfThisSite}
            cancelLabel={copy.staySignedIn}
            onConfirm={() => {
              // The handed email must not outlive the session: cleared before the full-page POST leaves.
              clearBookingsSearch();
              signOutForm.current?.submit();
            }}
          />
          <ConfirmDialog
            open={logoutAllOpen}
            onOpenChange={setLogoutAllOpen}
            title={copy.logoutAll}
            confirmLabel={copy.signOutEverywhere}
            cancelLabel={copy.staySignedIn}
            onConfirm={() => {
              clearBookingsSearch();
              void signOutEverywhere();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
