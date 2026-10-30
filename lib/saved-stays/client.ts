"use client";

// Plan 06-07, browser side: one store per page behind every heart. The pages are static files, so the state comes from
// GET /api/saved-stays, fetched once per page and only when the sign-in hint is present: a signed-out page view costs no Worker
// request (T-06-77). A failed read reads as signed out: the heart then offers sign-in, which works either way. The login page sends
// a signed-in guest straight back, and the save intent completes there.

import { useSyncExternalStore } from "react";
import { hasSignedInHint } from "../../components/site/account-sync";
import { readIntent, SAVE_INTENT_KEY } from "./rules";

type SavedStatus = "unknown" | "signed-out" | "ready";
type SavedStore = { status: SavedStatus; slugs: ReadonlySet<string>; busy: ReadonlySet<string> };

const EMPTY: ReadonlySet<string> = new Set();
const INITIAL: SavedStore = { status: "unknown", slugs: EMPTY, busy: EMPTY };
const ENDPOINT = "/api/saved-stays";

let store = INITIAL;
const listeners = new Set<() => void>();

function update(patch: Partial<SavedStore>): void {
  store = { ...store, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function withSlug(set: ReadonlySet<string>, slug: string, present: boolean): ReadonlySet<string> {
  const next = new Set(set);
  if (present) next.add(slug);
  else next.delete(slug);
  return next;
}

let loading: Promise<void> | null = null;
let watchingRestore = false;

async function fetchSaved(): Promise<void> {
  if (!hasSignedInHint()) {
    update({ status: "signed-out", slugs: EMPTY });
    return;
  }
  try {
    const response = await fetch(ENDPOINT, { credentials: "same-origin", cache: "no-store" });
    const body = (await response.json()) as { ok?: boolean; signedIn?: boolean; stays?: unknown };
    if (response.ok && body.ok === true && body.signedIn === true && Array.isArray(body.stays)) {
      update({ status: "ready", slugs: new Set(body.stays.filter((slug): slug is string => typeof slug === "string")) });
    } else {
      update({ status: "signed-out", slugs: EMPTY });
    }
  } catch {
    update({ status: "signed-out", slugs: EMPTY });
  }
}

/** Single-flight per page. A page the back button restores from memory counts as a new page: Account may have changed the list. */
export function loadSaved(): Promise<void> {
  if (!watchingRestore && typeof window !== "undefined") {
    watchingRestore = true;
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      loading = null;
      void loadSaved();
    });
  }
  if (!loading) loading = fetchSaved();
  return loading;
}

export type SaveResult = "ok" | "failed" | "signed-out" | "busy";

/** Optimistic: the heart changes at once and goes back on any answer but 200. A 401 turns the hearts into sign-in links. */
export async function setSaved(slug: string, saved: boolean): Promise<SaveResult> {
  if (store.busy.has(slug)) return "busy";
  const before = store.slugs.has(slug);
  update({ slugs: withSlug(store.slugs, slug, saved), busy: withSlug(store.busy, slug, true) });
  let result: SaveResult = "failed";
  try {
    // A real Origin on the request even if a page sets no-referrer, as /api/preferences does.
    const response = saved
      ? await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stay: slug }),
          credentials: "same-origin",
          referrerPolicy: "same-origin",
          cache: "no-store",
        })
      : await fetch(`${ENDPOINT}?stay=${encodeURIComponent(slug)}`, {
          method: "DELETE",
          credentials: "same-origin",
          referrerPolicy: "same-origin",
          cache: "no-store",
        });
    result = response.status === 200 ? "ok" : response.status === 401 ? "signed-out" : "failed";
  } catch {
    result = "failed";
  }
  if (result === "signed-out") {
    update({ status: "signed-out", slugs: EMPTY, busy: withSlug(store.busy, slug, false) });
    return result;
  }
  update({ slugs: result === "ok" ? store.slugs : withSlug(store.slugs, slug, before), busy: withSlug(store.busy, slug, false) });
  return result;
}

/** Saves a stay that is not saved and removes one that is. */
export function toggle(slug: string): Promise<SaveResult> {
  return setSaved(slug, !store.slugs.has(slug));
}

/** Her tap on a signed-out heart. Blocked storage means no intent, and nothing breaks: the link still goes to sign-in. */
export function rememberIntent(slug: string): void {
  try {
    window.localStorage.setItem(SAVE_INTENT_KEY, JSON.stringify({ stay: slug, at: Date.now() }));
  } catch {
    // No storage: she signs in and saves with one more tap.
  }
}

/** The intent for this stay, read once: returned and deleted. A stale one is deleted too; another stay's fresh one stays for its own page. */
export function takeIntent(slug: string): string | null {
  try {
    const raw = window.localStorage.getItem(SAVE_INTENT_KEY);
    if (raw === null) return null;
    const stay = readIntent(raw, Date.now());
    if (stay !== null && stay !== slug) return null;
    window.localStorage.removeItem(SAVE_INTENT_KEY);
    return stay;
  } catch {
    return null;
  }
}

export function useSavedStay(slug: string): { status: SavedStatus; saved: boolean; busy: boolean } {
  const current = useSyncExternalStore(subscribe, () => store, () => INITIAL);
  return { status: current.status, saved: current.slugs.has(slug), busy: current.busy.has(slug) };
}

// The hearts' notices. A heart often sits inside the hero or a card, where a fixed toast would not be placed or stacked right, so it
// says what it has to say here and SaveStayNotices, once per page, shows it.
export type SaveNoticeTone = "success" | "warning";
type NoticeListener = (text: string, tone: SaveNoticeTone) => void;
const noticeListeners = new Set<NoticeListener>();

export function subscribeNotices(listener: NoticeListener): () => void {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}

export function pushNotice(text: string, tone: SaveNoticeTone): void {
  for (const listener of noticeListeners) listener(text, tone);
}
