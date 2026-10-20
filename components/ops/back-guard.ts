// The editor page's Back guard (kit panel B; follow-up 2, PR #15 round 3 and 03.2-06/03.2-13 on 2026-10-15). With
// unsaved changes the page keeps one extra history entry for its own address, so the browser's Back lands on the same
// page and the question can be asked. The entry is flagged on history.state (not by address and history length), so a
// reload, Forward or a duplicated tab finds it, and a full history list or a location.replace never looks like one.
//
// Closing or saving takes no history step: a step there races the next navigation (Playwright's page.goto aborted with
// net::ERR_ABORTED, 03.2-13) and, under React strict mode's double effect, landed as a Back on the second guard (the
// "Discard changes?" at once, 03.2-06). The entry is left as a spare instead, and the watcher steps past a spare entry
// when the owner reaches it: Back from it moves on to the page before, Forward onto it steps back off it.
//
// Next's own router replaces history.state without custom keys on a refresh or a server action. The editors talk to
// /api/ops with fetch, so none runs while a page is open; if one did, the flag is lost and one Back stays on the page.

/** The key on history.state that marks a guard entry; its value is the guard's id. */
export const TRAP_KEY = "__almarEditTrap";

type GuardHistory = Pick<History, "state" | "pushState" | "back">;

/** The part of `window` the guard uses (a fake one in tests). */
export interface GuardWindow {
  history: GuardHistory;
  location: { href: string };
  addEventListener(type: "popstate", listener: (event: { state: unknown }) => void): void;
}

export interface BackGuards {
  /**
   * Once per load: a load on a spare guard entry (a reload or Forward with unsaved changes) steps off it. An entry this
   * document stood up itself is never a load's spare: strict mode runs it again after the first arm.
   */
  loaded(): void;
  /**
   * Unsaved changes: stand a guard entry up (or stand on the spare one already under the page) and own it. Idempotent:
   * a second arm on the same page reuses the entry, so a double effect adds nothing and takes no step.
   */
  arm(): string;
  /** The page closed, saved or was left: the entry is no longer owned. No history step. */
  release(id: string): void;
}

export function trapOf(state: unknown): string | null {
  if (state === null || typeof state !== "object") return null;
  const id = (state as Record<string, unknown>)[TRAP_KEY];
  return typeof id === "string" ? id : null;
}

/** How long a step of our own is waited for before a popstate counts as the owner's again. */
const STEP_WAIT_MS = 1000;

export function createBackGuards(win: GuardWindow, now: () => number = Date.now): BackGuards {
  let owned: string | null = null;
  // The guard entry the tab stands on now (its id and address), for the one Back that moves nothing.
  let standing: { id: string; href: string } | null = null;
  let steppingUntil = 0;
  let count = 0;
  // The guard entries this document pushed: a second loaded() (strict mode's double mount) must not step off them.
  const made = new Set<string>();

  const stepping = () => now() < steppingUntil;
  const stepBack = () => {
    if (stepping()) return;
    steppingUntil = now() + STEP_WAIT_MS;
    win.history.back();
  };

  win.addEventListener("popstate", (event) => {
    const id = trapOf(event.state);
    const from = standing;
    standing = id === null ? null : { id, href: win.location.href };
    if (stepping()) {
      // Our own step has landed; the owner did not ask for this one.
      steppingUntil = 0;
      return;
    }
    // Forward (or Back from a later page) onto a spare guard entry: it is the page under it, so step off it.
    if (id !== null && id !== owned) {
      stepBack();
      return;
    }
    // Back from a spare guard entry onto its own page moved nothing: take the step the owner asked for.
    if (id === null && from !== null && from.id !== owned && from.href === win.location.href) stepBack();
  });

  return {
    loaded() {
      const id = trapOf(win.history.state);
      if (id === null || made.has(id)) return;
      standing = { id, href: win.location.href };
      if (id !== owned) stepBack();
    },
    arm() {
      const here = trapOf(win.history.state);
      let id = here;
      if (id === null) {
        count += 1;
        id = `${now().toString(36)}-${count}`;
        const state = win.history.state !== null && typeof win.history.state === "object" ? win.history.state : {};
        win.history.pushState({ ...state, [TRAP_KEY]: id }, "", win.location.href);
        made.add(id);
      }
      owned = id;
      standing = { id, href: win.location.href };
      return id;
    },
    release(id) {
      if (owned === id) owned = null;
    },
  };
}

let shared: BackGuards | null = null;

/** The guards of this tab (one watcher for every editor page). */
export function backGuards(): BackGuards {
  shared ??= createBackGuards(window);
  return shared;
}
