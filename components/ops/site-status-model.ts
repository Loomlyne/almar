// The site status line's logic (plan 03.2-05), with no React and no fetch, so node tests drive it with fakes:
// what the line shows for a state, and when it reads the status again.
//
// Reads: once on start, every 15 s while "updating", once when the window gets focus (unless a read is already running),
// and whenever a write reply carries `site` (ops-client.ts raises it as the almar:site event, for writes only). A failed
// read, or a reply saying the live site could not be read (state "unavailable"), shows "Status unavailable" with no Try
// again, never a guessed state, and is read again after 15, 30, then every 60 s. A hidden tab
// does not poll; the focus read catches up. Try again POSTs /api/ops/site-update once at a time. After stop() nothing is
// scheduled or applied.

import type { OpsSiteStatusCopy } from "../../lib/copy/ops-site-status";
import { formatSiteTime, siteStatusTime } from "./site-status-time";
import type { SiteStatus } from "./api-types";
import type { OpsResponse } from "./ops-client";

export const POLL_MS = 15_000;
/** Retry delays after a failed read: 15 s, 30 s, then every 60 s. */
export const RETRY_MS = [15_000, 30_000, 60_000] as const;

export type LineState = { kind: "loading" } | { kind: "unavailable" } | { kind: "site"; site: SiteStatus };

export type LineView = {
  tone: "ok" | "busy" | "error" | "muted";
  text: string;
  /** "14:05", or null when there is no time to show. */
  time: string | null;
  /** The ISO instant behind `time`, for <time dateTime>. */
  at: string | null;
  showTryAgain: boolean;
};

const STATES = new Set(["up_to_date", "updating", "failed", "unavailable"]);

export function isSiteStatus(value: unknown): value is SiteStatus {
  return typeof value === "object" && value !== null && STATES.has((value as { state?: unknown }).state as string);
}

/** The endpoint did not answer, or it answered that the live site could not be read: the same muted line, no Try again. */
function isUnavailable(state: LineState): boolean {
  return state.kind === "unavailable" || (state.kind === "site" && state.site.state === "unavailable");
}

/** What the line shows; null while the first read is running (nothing is shown rather than a guess). */
export function lineView(state: LineState, copy: OpsSiteStatusCopy): LineView | null {
  if (state.kind === "loading") return null;
  if (isUnavailable(state)) return { tone: "muted", text: copy.unavailable, time: null, at: null, showTryAgain: false };
  if (state.kind !== "site") return null;
  const at = siteStatusTime(state.site);
  const time = formatSiteTime(at);
  switch (state.site.state) {
    case "up_to_date":
      return { tone: "ok", text: copy.upToDate, time, at: time ? at : null, showTryAgain: false };
    case "updating":
      return time
        ? { tone: "busy", text: copy.updatingSince, time, at, showTryAgain: false }
        : { tone: "busy", text: copy.updating, time: null, at: null, showTryAgain: false };
    default:
      return { tone: "error", text: copy.failed, time, at: time ? at : null, showTryAgain: true };
  }
}

type SiteReply = OpsResponse<{ site: SiteStatus }>;

export type SiteStatusController = {
  start(): void;
  stop(): void;
  /** The window got focus. */
  focus(): void;
  /** A write reply carried `site` (the almar:site event). */
  receive(site: unknown): void;
  tryAgain(): Promise<void>;
};

export function createSiteStatusController(deps: {
  load: () => Promise<SiteReply>;
  retry: () => Promise<SiteReply>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onChange: (state: LineState, busy: boolean) => void;
  initial?: SiteStatus;
  /** document.hidden in the browser; a hidden tab skips its timed reads. */
  isHidden?: () => boolean;
}): SiteStatusController {
  let state: LineState = deps.initial ? { kind: "site", site: deps.initial } : { kind: "loading" };
  let busy = false;
  let running = false;
  let timer: unknown = null;
  // Each read gets a number; an answer older than the newest applied one is dropped, so a slow poll never
  // overwrites what Try again or a write reply just said.
  let issued = 0;
  let applied = 0;
  let loading = false;
  let failures = 0;

  function clear() {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  }

  function delay(): number | null {
    if (isUnavailable(state)) return RETRY_MS[Math.min(Math.max(failures - 1, 0), RETRY_MS.length - 1)];
    if (state.kind === "site") return state.site.state === "updating" ? POLL_MS : null;
    return null;
  }

  function schedule() {
    clear();
    const ms = running ? delay() : null;
    if (ms === null) return;
    timer = deps.setTimer(() => {
      timer = null;
      if (deps.isHidden?.()) schedule();
      else void refresh();
    }, ms);
  }

  function apply(next: LineState, ticket: number) {
    if (!running || ticket < applied) return;
    applied = ticket;
    failures = isUnavailable(next) ? failures + 1 : 0;
    state = next;
    deps.onChange(state, busy);
    schedule();
  }

  function fromReply(reply: SiteReply): LineState {
    return reply.ok && isSiteStatus(reply.site) ? { kind: "site", site: reply.site } : { kind: "unavailable" };
  }

  async function refresh() {
    const ticket = ++issued;
    loading = true;
    try {
      apply(fromReply(await deps.load()), ticket);
    } finally {
      loading = false;
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      deps.onChange(state, busy);
      void refresh();
    },
    stop() {
      running = false;
      clear();
    },
    focus() {
      if (running && !loading) void refresh();
    },
    receive(site) {
      if (isSiteStatus(site)) apply({ kind: "site", site }, ++issued);
    },
    async tryAgain() {
      if (!running || busy) return;
      busy = true;
      deps.onChange(state, busy);
      const ticket = ++issued;
      const reply = await deps.retry();
      busy = false;
      if (!running) return;
      if (ticket < applied) {
        deps.onChange(state, busy);
        return;
      }
      apply(fromReply(reply), ticket);
    },
  };
}
