"use client";

// Plan 03.2-15: the Rates card of the stay editor (kit EditPage, option B). DRAFT for the picture gate: the shape is
// agreed with 03.2-07 through the controller before it is wired into the stay editor.
//
// The card saves on its own route (/api/ops/stay-rates, affects_site false), never through the page's Save/Publish:
// a rate is read live and never rebuilds the site (C-04). It never computes a total and never shows a default amount:
// every rate on screen is one the owner typed and the server returned.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { parseDate } from "@internationalized/date";
import { DateRangeField } from "../../../../../components/ops/date-range-field";
import { errorText } from "../../../../../components/ops/error-text";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import type { BaseRateResult, IsoDay, Locale3, OpsError, RateNight, RateRange, RatesView } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { formatDate } from "../../../../../components/ui/calendar";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_STAY_TABS_COPY } from "../../../../../lib/copy/ops-stay-tabs";
import { checkSpan, moneyString, rangePayload } from "./rates-forms";

const PATH = "/api/ops/stay-rates";

/** A calendar day as the dashboard writes it: DD/MM/YYYY. */
export function showDay(day: IsoDay): string {
  return formatDate(parseDate(day));
}

/** An amount exactly as the server returned it (a 2-decimal AED string), kept left-to-right inside Arabic text. */
function Aed({ value }: { value: string }) {
  return (
    <bdi dir="ltr" className="tabular-nums">
      {value}
    </bdi>
  );
}

type Draft = { id?: string; first: IsoDay | null; last: IsoDay | null; rate: string };
type Span = { first: IsoDay | null; last: IsoDay | null };

export function StayRatesSection({
  stayId,
  locale,
  onDirtyChange,
  onBaseSaved,
}: {
  stayId: string;
  locale: Locale3;
  /** The card has typing the server has not taken: the page ORs it into EditPage's `dirty`. */
  onDirtyChange?: (dirty: boolean) => void;
  /** The base rate the server took for this stay (null = cleared): the page updates that stay's price only, never its form. */
  onBaseSaved?: (stayId: string, base: string | null) => void;
}) {
  const copy = OPS_STAY_TABS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const id = useId();

  const [view, setView] = useState<RatesView | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [base, setBase] = useState("");
  const [baseError, setBaseError] = useState<string | null>(null);
  const [baseBusy, setBaseBusy] = useState(false);
  const [baseSaved, setBaseSaved] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<{ field: "dates" | "rate" | "form"; text: string } | null>(null);
  const [overlapId, setOverlapId] = useState<string | null>(null);
  const [rangeBusy, setRangeBusy] = useState(false);
  const [deleting, setDeleting] = useState<RateRange | null>(null);

  const [span, setSpan] = useState<Span>({ first: null, last: null });
  const [spanError, setSpanError] = useState<string | null>(null);
  const [nights, setNights] = useState<RateNight[] | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const reply = await opsFetch<RatesView>(PATH, { stay_id: stayId });
    if (!reply.ok) {
      setLoadError(true);
      return null;
    }
    setView(reply);
    return reply;
  }, [stayId]);

  useEffect(() => {
    void load().then((reply) => {
      if (reply) setBase(reply.base_nightly_rate_aed ?? "");
    });
  }, [load]);

  const savedBase = view?.base_nightly_rate_aed ?? "";
  const dirty = base.trim() !== savedBase || draft !== null;
  // Told only when it changes; the latest callback is kept in a ref so an inline one cannot loop. A layout effect, so the
  // page's own state (its "Unsaved changes" and its Escape and Back guard, a document listener re-set in a passive effect)
  // is updated in the same task as the keystroke: from a passive effect the page re-rendered at default priority, its
  // listener still held the old `dirty` after the status was painted, and an Escape in that gap closed with no
  // "Discard changes?" (slot 8, 2026-10-19, 1440 ar under load).
  const tell = useRef(onDirtyChange);
  tell.current = onDirtyChange;
  useLayoutEffect(() => {
    tell.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => tell.current?.(false), []);

  const failText = (error: OpsError) => errorText(kit, error);

  async function saveBase() {
    const money = moneyString(base, { allowEmpty: true });
    if (!money.ok) {
      setBaseError(copy.rates.moneyError);
      return;
    }
    setBaseError(null);
    setBaseBusy(true);
    const reply = await opsSend<BaseRateResult>(PATH, { action: "set_base", stay_id: stayId, base_nightly_rate_aed: money.value });
    setBaseBusy(false);
    if (!reply.ok) {
      setBaseError(failText(reply.error));
      return;
    }
    setBase(reply.base_nightly_rate_aed ?? "");
    setView((was) => (was ? { ...was, base_nightly_rate_aed: reply.base_nightly_rate_aed } : was));
    setBaseSaved(true);
    onBaseSaved?.(stayId, reply.base_nightly_rate_aed);
  }

  async function saveRange() {
    if (!draft) return;
    const payload = rangePayload(draft);
    if (!payload.ok) {
      if (payload.field === "nightly_rate_aed") setDraftError({ field: "rate", text: copy.rates.moneyError });
      else setDraftError({ field: "dates", text: payload.reason === "too_long" ? copy.rates.tooLong : copy.rates.datesError });
      return;
    }
    setDraftError(null);
    setOverlapId(null);
    setRangeBusy(true);
    const reply = await opsSend<{ range: RateRange }>(PATH, { action: "save_range", stay_id: stayId, range: payload.value });
    setRangeBusy(false);
    if (!reply.ok) {
      // 409 rate_overlap: the clashing row says why; what the owner typed stays in the form.
      if (reply.error.code === "rate_overlap") {
        const detail = reply.error.detail as { conflict_id?: unknown } | null;
        setOverlapId(typeof detail?.conflict_id === "string" ? detail.conflict_id : null);
        setDraftError({ field: "form", text: copy.rates.overlap });
      } else {
        setDraftError({ field: "form", text: failText(reply.error) });
      }
      return;
    }
    setDraft(null);
    await load();
  }

  async function deleteRange(range: RateRange) {
    setRangeBusy(true);
    const reply = await opsSend<object>(PATH, { action: "delete_range", id: range.id });
    setRangeBusy(false);
    setDeleting(null);
    if (!reply.ok) {
      setDraftError({ field: "form", text: failText(reply.error) });
      return;
    }
    if (draft?.id === range.id) setDraft(null);
    await load();
  }

  async function check() {
    const asked = checkSpan(span.first, span.last);
    if (!asked.ok) {
      setSpanError(asked.reason === "too_long" ? copy.rates.checkTooLong : copy.rates.datesError);
      return;
    }
    setSpanError(null);
    setCheckBusy(true);
    const reply = await opsFetch<RatesView>(PATH, { stay_id: stayId, from: asked.from, to: asked.to });
    setCheckBusy(false);
    if (!reply.ok) {
      setSpanError(failText(reply.error));
      return;
    }
    setNights(reply.nights ?? []);
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="m-0 text-label text-error">
          {copy.loadFailed}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (!view) {
    return (
      <p className="m-0 text-label text-muted" aria-live="polite">
        {copy.loading}
      </p>
    );
  }

  const columns: Column<RateRange>[] = [
    {
      key: "first",
      label: copy.rates.firstNight,
      phone: "title",
      render: (row) => (
        <bdi dir="ltr">{showDay(row.first_night)}</bdi>
      ),
    },
    { key: "last", label: copy.rates.lastNight, phone: "meta", render: (row) => <bdi dir="ltr">{showDay(row.last_night)}</bdi> },
    { key: "nights", label: copy.rates.nights, phone: "meta", render: (row) => <bdi dir="ltr">{row.nights}</bdi> },
    {
      key: "rate",
      label: copy.rates.perNight,
      phone: "meta",
      // The clash sentence sits on the clashing row as plain text in the last cell, outside the row's open link.
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Aed value={row.nightly_rate_aed} />
          {row.id === overlapId ? (
            <span className="text-label text-error" data-overlap>
              {copy.rates.overlap}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Base rate: the price of every night no range covers. Empty clears it and the stay stops being bookable. */}
      <div className="flex flex-col gap-3">
        {view.base_nightly_rate_aed === null ? (
          <p role="status" className="m-0 border border-error p-3 text-label text-ink">
            {copy.rates.noRate}
          </p>
        ) : null}
        <Field
          id={`${id}-base`}
          label={copy.rates.baseLabel}
          hint={copy.rates.baseHint}
          error={baseError ?? undefined}
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          value={base}
          onChange={(event) => {
            setBase(event.target.value);
            setBaseSaved(false);
          }}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => void saveBase()} disabled={baseBusy || base.trim() === savedBase}>
            {copy.rates.savePrice}
          </Button>
          {baseSaved && base.trim() === savedBase ? (
            <span role="status" className="text-label text-muted">
              {copy.rates.saved}
            </span>
          ) : null}
        </div>
      </div>

      {/* Date ranges: each with its own nightly rate; the shortest covering a night wins (C-11). */}
      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-display text-body font-normal text-ink">{copy.rates.rangesTitle}</h3>
        <p className="m-0 text-label text-ink">{copy.rates.rule}</p>
        <ListTable
          caption={copy.rates.rangesTitle}
          columns={columns}
          rows={view.ranges}
          onOpen={(row) => {
            setDraft({ id: row.id, first: row.first_night, last: row.last_night, rate: row.nightly_rate_aed });
            setDraftError(null);
          }}
          empty={<p className="m-0 text-label text-muted">{copy.rates.noRanges}</p>}
        />
        {draft ? (
          <div className="flex flex-col gap-3 border border-line p-4" data-range-form>
            <DateRangeField
              id={`${id}-range`}
              label={copy.rates.dates}
              value={{ first: draft.first, last: draft.last }}
              onChange={(next) => setDraft({ ...draft, ...next })}
              error={draftError?.field === "dates" ? draftError.text : undefined}
            />
            <Field
              id={`${id}-range-rate`}
              label={copy.rates.perNight}
              error={draftError?.field === "rate" ? draftError.text : undefined}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={draft.rate}
              onChange={(event) => setDraft({ ...draft, rate: event.target.value })}
            />
            {draftError?.field === "form" ? (
              <p role="alert" className="m-0 text-label text-error">
                {draftError.text}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => void saveRange()} disabled={rangeBusy}>
                {copy.rates.saveRange}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setDraftError(null);
                  setOverlapId(null);
                }}
              >
                {kit.cancel}
              </Button>
              {draft.id ? (
                <Button
                  variant="danger"
                  onClick={() => setDeleting(view.ranges.find((range) => range.id === draft.id) ?? null)}
                  disabled={rangeBusy}
                >
                  {kit.delete}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({ first: null, last: null, rate: "" });
              setDraftError(null);
            }}
          >
            {copy.rates.addRange}
          </Button>
        )}
      </div>

      {/* Check prices: each night's price and where it comes from, as the server reads it. Never a total. */}
      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-display text-body font-normal text-ink">{copy.rates.checkTitle}</h3>
        <DateRangeField
          id={`${id}-check`}
          label={copy.rates.dates}
          hint={copy.rates.checkLine}
          value={span}
          onChange={(next) => {
            setSpan(next);
            setNights(null);
          }}
          min="2000-01-01"
          error={spanError ?? undefined}
        />
        <Button variant="secondary" onClick={() => void check()} disabled={checkBusy}>
          {copy.rates.check}
        </Button>
        {nights ? (
          <table className="w-full border-collapse text-start text-label" data-check-table>
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{copy.rates.night}</th>
                <th className="py-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{copy.rates.perNight}</th>
                <th className="py-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{copy.rates.priceFrom}</th>
              </tr>
            </thead>
            <tbody>
              {nights.map((night) => (
                <tr key={night.night} className="border-b border-line">
                  <td className="py-2">
                    <bdi dir="ltr">{showDay(night.night)}</bdi>
                  </td>
                  <td className="py-2">{night.nightly_rate_aed === null ? "—" : <Aed value={night.nightly_rate_aed} />}</td>
                  <td className="py-2">{night.source === null ? copy.rates.source.none : copy.rates.source[night.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.rates.deleteRangeTitle}
        description={copy.rates.deleteRangeBody}
        confirmLabel={kit.delete}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          if (deleting) void deleteRange(deleting);
        }}
      />
    </div>
  );
}
