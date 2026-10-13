"use client";

// The public site's update status in the dashboard header (plan 03.2-05, pictures signed 2026-10-13): "Up to date ·
// 14:05", "Updating since 14:02", "Update failed · 14:30 · Try again", or "Status unavailable" when the endpoint does not
// answer or the live site could not be read (data-site-state is "unavailable" in both cases; no Try again). On a phone
// it takes its own row under the logo, so it never runs into the menu button. Reads and posts only
// through ops-client.ts; the logic lives in site-status-model.ts.

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import type { OpsSiteStatusCopy } from "../../lib/copy/ops-site-status";
import type { SiteStatus } from "./api-types";
import { opsFetch, opsSend } from "./ops-client";
import { createSiteStatusController, lineView, type LineState, type SiteStatusController } from "./site-status-model";

function Mark({ tone }: { tone: "ok" | "busy" | "error" }) {
  if (tone === "ok") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-success">
        <path d="M3 8.5l3 3 7-7" />
      </svg>
    );
  }
  if (tone === "busy") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" strokeWidth={1.5} className="shrink-0">
        <circle cx={8} cy={8} r={6} className="stroke-line" />
        <path d="M8 2a6 6 0 0 1 6 6" className="stroke-teal" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-error">
      <circle cx={8} cy={8} r={6} />
      <path d="M8 4.5v4.5M8 10.75v.75" />
    </svg>
  );
}

export function SiteStatusLine({ copy, initial }: { copy: OpsSiteStatusCopy; initial?: SiteStatus }) {
  const [state, setState] = useState<LineState>(initial ? { kind: "site", site: initial } : { kind: "loading" });
  const [busy, setBusy] = useState(false);
  const controller = useRef<SiteStatusController | null>(null);
  const first = useRef(initial);

  useEffect(() => {
    const ctl = createSiteStatusController({
      load: () => opsFetch<{ site: SiteStatus }>("/api/ops/site-status"),
      retry: () => opsSend<{ site: SiteStatus }>("/api/ops/site-update", {}),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
      onChange: (next, nextBusy) => {
        setState(next);
        setBusy(nextBusy);
      },
      initial: first.current,
      isHidden: () => document.hidden,
    });
    controller.current = ctl;
    const onFocus = () => ctl.focus();
    const onSite = (event: Event) => ctl.receive((event as CustomEvent<unknown>).detail);
    window.addEventListener("focus", onFocus);
    window.addEventListener("almar:site", onSite);
    ctl.start();
    return () => {
      ctl.stop();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("almar:site", onSite);
      controller.current = null;
    };
  }, []);

  const view = lineView(state, copy);

  return (
    <div
      role="status"
      data-site-state={state.kind === "site" ? state.site.state : state.kind}
      className={cn(
        "min-h-control items-center gap-2 whitespace-nowrap text-label",
        view ? "flex" : "hidden",
        view?.tone === "muted" ? "text-muted" : "text-ink",
        // Phone: its own full-width row under the logo, a hairline above it (signed pictures, 390).
        "max-sm:order-last max-sm:box-content max-sm:-mx-4 max-sm:basis-full max-sm:flex-wrap max-sm:whitespace-normal max-sm:border-t max-sm:border-line max-sm:px-4 sm:ms-auto",
      )}
    >
      {view ? (
        <>
          {view.tone !== "muted" ? <Mark tone={view.tone} /> : null}
          <span className={view.tone === "error" ? "text-error" : undefined}>
            {view.text}
            {view.tone === "busy" && view.time ? (
              <>
                {" "}
                <time dateTime={view.at ?? undefined} dir="ltr">
                  {view.time}
                </time>
              </>
            ) : null}
          </span>
          {view.tone !== "busy" && view.time ? (
            <>
              <span aria-hidden="true" className="text-muted">
                ·
              </span>
              <time dateTime={view.at ?? undefined} dir="ltr" className={view.tone === "error" ? "text-error" : undefined}>
                {view.time}
              </time>
            </>
          ) : null}
          {view.showTryAgain ? (
            <>
              <span aria-hidden="true" className="text-muted">
                ·
              </span>
              <button
                type="button"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void controller.current?.tryAgain()}
                className="-ms-2 inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent px-2 text-label text-teal underline decoration-gold decoration-1 underline-offset-4 disabled:cursor-default disabled:text-muted"
              >
                {copy.tryAgain}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
