"use client";

// Plan 04-05 (Task 2, signed 2026-10-26): the guest booking page /<locale>/bookings/trip drawn from the real
// BookingPageView, one state per scene, for the owner's pictures. Every view is a fixture of
// tests/helpers/booking-view-fixtures.ts (E-06: repeating-digit fils, bracketed names, the documentation IBAN), read at
// FIXTURE_NOW, so the Withdraw control and the late line never depend on the clock. Every ready state passes a withdraw
// control with logging handlers, so the model alone decides where the control shows: `awaiting` is the
// withdraw-available state (E-21) and `part-received` the part-paid page (E-27). The handlers only append to a hidden
// <output data-testid="booking-page-log">: nothing is sent. Not in tests/journey/matrix.ts (no baselines).

import { useState, type ReactNode } from "react";
import { bookingPageModel, type WithdrawUi } from "../../../app/bookings/trip/booking-page-model";
import { BookingPageView, type BookingPageState } from "../../../app/bookings/trip/booking-page-view";
import { BOOKING_PAGE_COPY } from "../../../lib/copy/booking-page";
import { localeHrefs } from "../../../lib/locale-path";
import { FIXTURE_NOW, viewFixture, type ViewState } from "../../helpers/booking-view-fixtures";
import type { SceneContext, Scenes } from "../scene-types";

type SceneOptions = {
  view?: ViewState;
  state?: BookingPageState;
  ui?: WithdrawUi;
  isTest?: boolean;
  showBackLink?: boolean;
};

function Page({ ctx, o }: { ctx: SceneContext; o: SceneOptions }) {
  const locale = ctx.locale;
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((current) => [...current, line]);
  const state: BookingPageState =
    o.state ?? { kind: "ready", view: viewFixture(o.view ?? "awaiting", locale), nowMs: FIXTURE_NOW };
  const withdraw =
    state.kind === "ready"
      ? {
          ui: o.ui ?? ({ step: "idle" } as WithdrawUi),
          onOpen: () => note("open"),
          onCancel: () => note("cancel"),
          onConfirm: () => note("confirm"),
        }
      : undefined;
  const out: ReactNode = (
    <output data-testid="booking-page-log" hidden>
      {log.join(" ")}
    </output>
  );
  return (
    <>
      <BookingPageView
        locale={locale}
        copy={BOOKING_PAGE_COPY[locale]}
        state={state}
        localeHrefs={localeHrefs("/bookings/trip")}
        isTest={o.isTest ?? false}
        onRetry={() => note("retry")}
        showBackLink={o.showBackLink ?? false}
        withdraw={withdraw}
      />
      {out}
    </>
  );
}

const ready = (view: ViewState, more: Omit<SceneOptions, "view" | "state"> = {}) => (ctx: SceneContext) => <Page ctx={ctx} o={{ view, ...more }} />;

export const scenes: Scenes = {
  awaiting: ready("awaiting"),
  "awaiting-owner-made": ready("awaiting-owner-made"),
  "part-received": ready("part-received", { isTest: true }),
  "part-paid-late": ready("part-paid-late"),
  "deposit-balance": ready("deposit-balance"),
  "paid-full": ready("paid-full"),
  confirmed: ready("confirmed", { showBackLink: true }),
  completed: ready("completed", { showBackLink: true }),
  cancelled: ready("cancelled"),
  expired: ready("expired"),
  "not-sent": ready("not-sent"),
  // Plan 05-03: a confirmed booking with one part refund (symbolic fixture amount): the Refunds block, the date and amount only.
  refunded: (ctx) => {
    const view = viewFixture("confirmed", ctx.locale);
    view.money.refundedFils = 1111;
    view.refunds = [{ refundedOn: "2026-11-04", amountFils: 1111 }];
    return <Page ctx={ctx} o={{ state: { kind: "ready", view, nowMs: FIXTURE_NOW }, showBackLink: true }} />;
  },
  "not-found": (ctx) => <Page ctx={ctx} o={{ state: { kind: "not_found", signIn: true } }} />,
  unavailable: (ctx) => <Page ctx={ctx} o={{ state: { kind: "unavailable" } }} />,
  "print-awaiting": ready("awaiting"),
  "print-confirmed": ready("confirmed", { showBackLink: true }),
  "withdraw-confirm": ready("awaiting", { ui: { step: "confirm" } }),
  "withdraw-failed": ready("awaiting", { ui: { step: "failed" } }),
  "withdraw-done": (ctx) => (
    <Page
      ctx={ctx}
      o={{ view: "withdrawn", ui: { step: "done", stayPath: bookingPageModel(viewFixture("withdrawn", ctx.locale), FIXTURE_NOW, ctx.locale).stayPath } }}
    />
  ),
  "withdraw-refused-part-paid": ready("part-received", { ui: { step: "refused", reason: "part_paid" } }),
  "withdraw-refused-not-withdrawable": ready("expired", { ui: { step: "refused", reason: "not_withdrawable" } }),
};
