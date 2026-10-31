"use client";

import type { ReactNode } from "react";
import { StickyDock } from "../../../../../components/ui/sticky-dock";
import type { OpsNewBookingCopy } from "../../../../../lib/copy/ops-new-booking";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import { formatAed } from "../../../../../lib/money/format";
import type { OwnerBreakdown } from "../../../../../lib/ops/new-booking-contract";

// Plan 05-02 Task 3: the summary rail (360px from lg up, under the step below that) and the phone bar. Every figure is the
// server's: read from the quote's breakdown and shown through formatAed in a left-to-right isolate with tabular numbers.
// No sum and no percentage is worked out here; the VAT rate is the server's basis points shown as a number.

function Amount({ fils }: { fils: number }) {
  return (
    <bdi dir="ltr" className="tabular-nums">
      {formatAed(fils)}
    </bdi>
  );
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-baseline justify-between gap-3 py-2 font-bold text-ink" : "flex items-baseline justify-between gap-3 py-2 text-ink"}>
      <dt className="text-label">{label}</dt>
      <dd className="m-0 text-body">{children}</dd>
    </div>
  );
}

/** The VAT rate as the settings hold it: basis points shown as a percentage number (500 is 5). Display only. */
function rateText(vatBp: number): string {
  const whole = Math.trunc(vatBp / 100);
  const rest = vatBp - whole * 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

export function BookingSummary({
  copy,
  guestName,
  stayTitle,
  datesText,
  breakdown,
}: {
  copy: OpsNewBookingCopy;
  guestName: string;
  stayTitle: string | null;
  datesText: string | null;
  breakdown: OwnerBreakdown | null;
}) {
  const s = copy.summary;
  return (
    <aside aria-label={s.title} className="grid gap-3 border border-line bg-surface p-4 md:p-6 lg:sticky lg:top-6">
      <h2 className="m-0 font-display text-title font-normal text-teal">{s.title}</h2>
      <dl className="m-0 grid gap-0 border-b border-line pb-2">
        {guestName ? <Row label={s.guest}>{guestName}</Row> : null}
        {stayTitle ? <Row label={s.stay}>{stayTitle}</Row> : null}
        {datesText ? (
          <Row label={s.dates}>
            <bdi dir="ltr">{datesText}</bdi>
          </Row>
        ) : null}
      </dl>
      {breakdown ? (
        <dl className="m-0 grid gap-0">
          <Row label={s.nights}>
            <Amount fils={breakdown.nightsFils} />
          </Row>
          {breakdown.addonsFils > 0 ? (
            <Row label={s.extras}>
              <Amount fils={breakdown.addonsFils} />
            </Row>
          ) : null}
          <Row label={fillCopy(s.vat, { rate: rateText(breakdown.vatBp) })}>
            <Amount fils={breakdown.vatFils} />
          </Row>
          <Row label={s.total} strong>
            <Amount fils={breakdown.grandFils} />
          </Row>
          <Row label={s.dueNow}>
            <Amount fils={breakdown.dueNowFils} />
          </Row>
        </dl>
      ) : (
        <p className="m-0 text-label text-muted">{s.pending}</p>
      )}
    </aside>
  );
}

/** The phone's bottom bar: the total and the step's one action. Hidden from md up, where the rail and the step's own buttons are. */
export function PhoneBar({ copy, breakdown, action }: { copy: OpsNewBookingCopy; breakdown: OwnerBreakdown | null; action: ReactNode }) {
  return (
    <div className="md:hidden">
      <StickyDock
        summary={
          <>
            <span className="text-caption text-muted">{copy.summary.total}</span>
            <span className="text-body font-bold text-ink">{breakdown ? <Amount fils={breakdown.grandFils} /> : null}</span>
          </>
        }
        action={action}
      />
    </div>
  );
}
