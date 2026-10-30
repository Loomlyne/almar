"use client";

// Plan 04-05, Task 5: the guest booking page's client screen. The static page (app/<locale>/bookings/trip/page.tsx)
// renders it under Suspense; it reads `ref` and `t` from the address in the browser, makes the one POST to 04-08's
// /api/booking/view (same origin, no-store; the page's referrer policy keeps the Origin, F-02) and draws the answer
// through BookingPageView. A ref that is not a booking reference is "not found" with no request. The token lives in
// this tab's memory, the address and the POST body only: never a storage, a cookie, a log or a link to another site.
//
// Task 6 (R2): on a ready view the screen drives the Withdraw control. Open -> confirm; Keep my request -> idle, nothing
// sent; confirm -> one postWithdraw (an in-flight ref: a double click posts once), then done / refused / gone read the
// view again (the current page stays on screen meanwhile) and failed keeps the dialog open with Try again. An answer
// that lands after Keep my request is still applied for done, refused and gone (the server decided); a failure after
// it changes nothing. On done or refused focus moves to the notice: the trigger Radix would return it to is gone.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { bookingPagePath, isTestHost } from "../../../lib/booking/origin";
import { isBookingRef } from "../../../lib/booking/ref";
import { BOOKING_PAGE_COPY } from "../../../lib/copy/booking-page";
import type { SiteLegalChrome } from "../../../lib/data/types";
import type { Locale } from "../../../lib/locale-path";
import { bookingPageModel, type WithdrawControl, type WithdrawUi } from "./booking-page-model";
import { BookingPageView, type BookingPageState } from "./booking-page-view";
import { viewAnswer, viewRequestBody, type ViewAnswer } from "./booking-view-answer";
import { postWithdraw } from "./booking-withdraw";

const VIEW_PATH = "/api/booking/view";
const VIEW_TIMEOUT_MS = 15_000;

/** One view call. Never throws: a network error or a timeout is "unavailable". */
async function readView(ref: string, t: string | undefined, locale: Locale): Promise<ViewAnswer> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), VIEW_TIMEOUT_MS);
  try {
    const res = await fetch(VIEW_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(viewRequestBody(ref, t, locale)),
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return viewAnswer(res.status, json, ref);
  } catch {
    return { kind: "unavailable" };
  } finally {
    window.clearTimeout(timer);
  }
}

function stateOf(answer: ViewAnswer, signIn: boolean): BookingPageState {
  if (answer.kind === "ready") return { kind: "ready", view: answer.view, nowMs: Date.now() };
  if (answer.kind === "not_found") return { kind: "not_found", signIn };
  return { kind: "unavailable" };
}

export function BookingTripScreen({ locale, legal }: { locale: Locale; legal?: SiteLegalChrome }) {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const rawT = params.get("t");
  const t = rawT !== null && rawT !== "" ? rawT : undefined;
  const validRef = isBookingRef(ref);
  // E-15: the sign-in line only when the address has no link token.
  const signIn = t === undefined;

  const [state, setState] = useState<BookingPageState>(() => (validRef ? { kind: "loading" } : { kind: "not_found", signIn }));
  const [isTest, setIsTest] = useState(false);
  const seq = useRef(0);
  const started = useRef<string | null>(null);
  const [ui, setUi] = useState<WithdrawUi>({ step: "idle" });
  const inFlight = useRef(false);

  useEffect(() => {
    setIsTest(isTestHost(window.location.host));
  }, []);

  /** Reads the view; only the latest call's answer is drawn. `again` keeps the current page on screen meanwhile. */
  const load = useCallback(
    async (again: boolean) => {
      if (!validRef) return;
      const n = ++seq.current;
      if (!again) setState({ kind: "loading" });
      const answer = await readView(ref, t, locale);
      if (n === seq.current) setState(stateOf(answer, signIn));
    },
    [validRef, ref, t, locale, signIn],
  );

  useEffect(() => {
    const key = `${locale}|${ref}|${t ?? ""}`;
    if (!validRef) {
      setState({ kind: "not_found", signIn });
      return;
    }
    // One read per address, also under React's development double effect.
    if (started.current === key) return;
    started.current = key;
    void load(false);
  }, [locale, ref, t, validRef, signIn, load]);

  const onConfirm = useCallback(async () => {
    if (inFlight.current || state.kind !== "ready") return;
    inFlight.current = true;
    const stayPath = bookingPageModel(state.view, state.nowMs, locale).stayPath;
    const answer = await postWithdraw(t === undefined ? { ref } : { ref, t });
    inFlight.current = false;
    if (answer.kind === "failed") {
      setUi((current) => (current.step === "confirm" || current.step === "failed" ? { step: "failed" } : current));
      return;
    }
    if (answer.kind === "done") setUi({ step: "done", stayPath });
    else if (answer.kind === "refused") setUi({ step: "refused", reason: answer.reason });
    else setUi({ step: "idle" });
    void load(true);
  }, [state, locale, ref, t, load]);

  // Radix hands focus back to the Withdraw button when the dialog closes (its own 0 ms timer); on done or refused that
  // button is gone, so the notice takes focus just after.
  useEffect(() => {
    if (ui.step !== "done" && ui.step !== "refused") return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>("[data-testid=withdraw-notice]")?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [ui]);

  // Always passed: the view draws the section and the dialog only on a ready view the model says can be withdrawn,
  // and the done or refused notice in every state but loading (it stays if the re-read fails).
  const withdraw: WithdrawControl = {
    ui,
    onOpen: () => setUi({ step: "confirm" }),
    onCancel: () => setUi({ step: "idle" }),
    onConfirm: () => void onConfirm(),
  };

  // E-05: the language control keeps the booking (same-origin links; the referrer policy keeps the token home).
  const hrefs = useMemo<Record<Locale, string> | undefined>(
    () =>
      validRef
        ? { en: bookingPagePath("en", ref, t), ar: bookingPagePath("ar", ref, t), es: bookingPagePath("es", ref, t) }
        : undefined,
    [validRef, ref, t],
  );

  return (
    <BookingPageView
      locale={locale}
      copy={BOOKING_PAGE_COPY[locale]}
      state={state}
      localeHrefs={hrefs}
      isTest={isTest}
      onRetry={() => void load(false)}
      showBackLink={t === undefined && state.kind === "ready"}
      withdraw={withdraw}
      legal={legal}
    />
  );
}
