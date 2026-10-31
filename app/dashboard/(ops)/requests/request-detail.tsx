"use client";

import { useState, type ReactNode } from "react";
import type { Locale3, OpsError, SiteRequestSummary } from "../../../../components/ops/api-types";
import { errorText } from "../../../../components/ops/error-text";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { Button, LinkButton } from "../../../../components/ui/button";
import { BackChevron, LINK_BUTTON, LINK_BUTTON_DANGER, RemoveMark } from "../../../../components/ui/link";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { cn } from "../../../../lib/cn";
import { OPS_BOOKINGS_COPY } from "../../../../lib/copy/ops-bookings";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { OPS_REQUESTS_COPY } from "../../../../lib/copy/ops-requests";
import { SITE_REQUESTS_COPY } from "../../../../lib/copy/site-requests";
import { isPlainEmail } from "../../../../lib/email-address";
import { UAE_AIRPORTS } from "../../../../lib/site-requests/validate";

// One request (plan 06-05, F-10; pictures/06-05 request-*): every field the guest sent, Mark handled / Mark not handled, Reply by
// email, Open WhatsApp, and for a booked consultation Cancel consultation behind a question. No email goes out on a cancel: the
// owner tells the guest herself, as the signed line says. Times are Dubai time; the guest's own time is beside her zone.

const TAGS: Record<Locale3, string> = { en: "en-GB", ar: "ar-AE-u-ca-gregory-nu-latn", es: "es" };
const DUBAI = "Asia/Dubai";

const fill = (line: string, values: Record<string, string>) => line.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

export const receivedIn = (iso: string, locale: Locale3) =>
  new Intl.DateTimeFormat(TAGS[locale], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: DUBAI }).format(new Date(iso));

const timeIn = (iso: string, zone: string, locale: Locale3) => new Intl.DateTimeFormat(TAGS[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).format(new Date(iso));

/** "3 Nov, 15:00": the list's Summary of a consultation. */
export const shortSlot = (iso: string, locale: Locale3) => `${new Intl.DateTimeFormat(TAGS[locale], { day: "numeric", month: "short", timeZone: DUBAI }).format(new Date(iso))}, ${timeIn(iso, DUBAI, locale)}`;

const longSlot = (iso: string, locale: Locale3) =>
  `${new Intl.DateTimeFormat(TAGS[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: DUBAI }).format(new Date(iso))}, ${timeIn(iso, DUBAI, locale)}`;

const dayIn = (day: string, locale: Locale3) => new Intl.DateTimeFormat(TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

const text = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
};

function datesOf(payload: Record<string, unknown>, locale: Locale3): string {
  const from = text(payload.from);
  const to = text(payload.to);
  if (from && to) return `${dayIn(from, locale)} – ${dayIn(to, locale)}`;
  return from ? dayIn(from, locale) : to ? dayIn(to, locale) : "";
}

/** A static label in the picture's two looks: on (teal outline) and off (quiet). */
export function Tag({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={cn("inline-flex min-h-6 items-center whitespace-nowrap border px-2 text-caption", on ? "border-teal text-teal" : "border-line text-muted")}>{children}</span>;
}

function rowsOf(request: SiteRequestSummary, locale: Locale3): Array<[string, string]> {
  const copy = OPS_REQUESTS_COPY[locale];
  const d = copy.d;
  const p = request.payload;
  const rows: Array<[string, string]> = [];
  if (request.kind === "plan") {
    const at = (UAE_AIRPORTS as readonly string[]).indexOf(text(p.airport));
    rows.push(
      [d.destination, text(p.destination)],
      [d.dates, datesOf(p, locale)],
      [d.guests, text(p.guests)],
      [d.budget, text(p.budget)],
      [d.airport, at >= 0 ? (SITE_REQUESTS_COPY[locale].plan.airports[at] ?? "") : text(p.airport)],
    );
  } else if (request.kind === "list") {
    rows.push([d.propType, text(p.property_type)], [d.city, text(p.city)], [d.message, text(p.message)]);
  } else if (request.kind === "package") {
    rows.push([copy.kinds.package, text(p.tier_slug)], [d.dates, datesOf(p, locale)], [d.guests, text(p.guests)], [d.city, text(p.cities)]);
  } else if (request.consultation) {
    const slot = request.consultation.slot_start;
    const zone = text(p.time_zone);
    rows.push([d.slot, fill(copy.slotLine, { dubai: longSlot(slot, locale) })], [d.tz, zone ? `${zone} · ${timeIn(slot, zone, locale)}` : ""]);
  }
  rows.push([d.notes, text(p.notes)], [d.name, request.name], [d.email, request.email], [d.phone, text(p.phone)], [d.received, receivedIn(request.created_at, locale)]);
  return rows.filter(([, value]) => value !== "");
}

export function RequestDetail({
  request,
  busy,
  error,
  onBack,
  onHandled,
  onCancel,
}: {
  request: SiteRequestSummary;
  busy: boolean;
  error: OpsError | null;
  onBack: () => void;
  onHandled: (handled: boolean) => void;
  /** Resolves true once the booking is cancelled. */
  onCancel: (bookingId: string) => Promise<boolean>;
}) {
  const locale = useDashboardLocale();
  const copy = OPS_REQUESTS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const [asking, setAsking] = useState(false);
  const handled = request.handled_at !== null;
  const digits = text(request.payload.phone).replace(/\D/g, "");
  const booking = request.consultation ?? null;
  const cancelled = booking?.status === "cancelled";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className={LINK_BUTTON}
        >
          <BackChevron />
          {copy.title}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            <h1 className="m-0 text-balance break-words font-display text-heading font-normal text-teal">{request.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Tag on>{copy.kinds[request.kind]}</Tag>
              <Tag on={!handled}>{handled ? copy.st.yes : copy.st.not}</Tag>
              {/* The bookings words: the signed page has no line of its own for a cancelled call. */}
              {cancelled ? <Tag on={false}>{OPS_BOOKINGS_COPY[locale].statuses.cancelled}</Tag> : null}
              {handled && request.handled_at ? <span className="text-label text-muted">{fill(copy.handledBy, { date: receivedIn(request.handled_at, locale) })}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={handled ? "secondary" : "primary"} busy={busy} onClick={() => onHandled(!handled)}>
              {handled ? copy.markNot : copy.markHandled}
            </Button>
            {/* P5-11: only the request's id travels in the URL; the New booking screen reads the row through the owner API. */}
            {request.kind !== "list" ? (
              <LinkButton variant="secondary" href={`/dashboard/bookings/new?request=${encodeURIComponent(request.id)}`}>
                {copy.makeBooking}
              </LinkButton>
            ) : null}
            {isPlainEmail(request.email) ? (
              <LinkButton variant="secondary" href={`mailto:${request.email}`}>
                {copy.reply}
              </LinkButton>
            ) : null}
            {/* wa.me needs the country code; a number typed without one opens no chat. */}
            {digits.length >= 7 && text(request.payload.phone).trim().startsWith("+") ? (
              <LinkButton variant="secondary" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                {copy.wa}
              </LinkButton>
            ) : null}
            {booking && !cancelled ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsking(true)}
                className={LINK_BUTTON_DANGER}
              >
                <RemoveMark />
                {copy.cancelC}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-label text-error">
          {errorText(kit, error)}
        </p>
      ) : null}
      <section className="border border-line bg-surface p-4 md:p-6">
        <dl className="m-0 grid gap-x-6 gap-y-1 md:grid-cols-[minmax(7.5rem,12.5rem)_1fr] md:gap-y-3">
          {rowsOf(request, locale).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-label text-muted">{label}</dt>
              <dd className="m-0 mb-3 whitespace-pre-wrap break-words text-label text-ink md:mb-0">
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.cancelTitle}
        description={copy.cancelText}
        confirmLabel={copy.cancelC}
        cancelLabel={copy.keep}
        busy={busy}
        onConfirm={() => {
          if (!booking) return;
          void onCancel(booking.booking_id).then(() => setAsking(false));
        }}
      />
    </div>
  );
}
