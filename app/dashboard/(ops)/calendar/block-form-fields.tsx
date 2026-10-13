"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { DateRangeField } from "../../../../components/ops/date-range-field";
import type { Locale3 } from "../../../../components/ops/api-types";
import { AlertCircleIcon } from "../../../../components/icons/icons";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Select } from "../../../../components/ui/select";
import { ToggleCardGroup } from "../../../../components/ui/toggle-card";
import { OPS_CALENDAR_COPY } from "../../../../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { REASON_MAX, blockPayload, type BlockFormValues, type BlockPayload, type BlockScope } from "./block-form";

export type CalendarPlace = { id: string; name: string };
export type CalendarStay = CalendarPlace & { destinationId: string };

/**
 * The fields and the logic of Block dates, with no panel around them: what to block, the one or the other pick list,
 * the one "Dates" range (first day, then last day; one day is the same day twice; days before today are not pickable),
 * the optional reason and the Block button. Whatever panel the owner picks for the dashboard hosts this component; it
 * reports `onDirtyChange` so the panel can ask before discarding, and calls `onSubmit` with the contract 5.4 payload.
 */
export function BlockForm({
  locale,
  today,
  destinations,
  stays,
  initial,
  busy,
  error,
  onSubmit,
  onDirtyChange,
}: {
  locale: Locale3;
  /** Today in Dubai, `YYYY-MM-DD`. */
  today: string;
  destinations: CalendarPlace[];
  stays: CalendarStay[];
  initial: BlockFormValues;
  busy: boolean;
  /** The sentence of the last failed Block, or null. */
  error: string | null;
  onSubmit: (payload: BlockPayload) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const copy = OPS_CALENDAR_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const ids = useId();
  const [values, setValues] = useState<BlockFormValues>(initial);
  const [missing, setMissing] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function change(next: Partial<BlockFormValues>) {
    setMissing(null);
    setValues((old) => ({ ...old, ...next }));
  }

  function submit() {
    const result = blockPayload(values);
    if (!result.ok) {
      setMissing(
        result.field === "destination"
          ? copy.needDestination
          : result.field === "stay"
            ? copy.needStay
            : result.field === "dates"
              ? copy.needDates
              : kit.errors.invalid,
      );
      return;
    }
    setMissing(null);
    onSubmit(result.payload);
  }

  const message = missing ?? error;

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) submit();
      }}
    >
      <p className="m-0 text-body text-pretty text-ink">{copy.blockedNote}</p>

      <div className="grid gap-2">
        <span id={`${ids}-scope`} className="text-label text-ink">
          {copy.whatToBlock}
        </span>
        <ToggleCardGroup
          labelId={`${ids}-scope`}
          value={values.scope}
          onChange={(scope) => change({ scope: scope as BlockScope })}
          options={[
            { value: "all", title: copy.everything, detail: copy.everythingDetail },
            { value: "destination", title: copy.oneDestination, detail: copy.oneDestinationDetail },
            { value: "stay", title: copy.oneStay },
          ]}
        />
      </div>

      {values.scope === "destination" ? (
        <Labelled id={`${ids}-destination`} label={copy.destinations}>
          <Select
            value={values.destinationId}
            options={destinations.map((one) => ({ value: one.id, label: one.name }))}
            onChange={(destinationId) => change({ destinationId })}
            label={`${copy.destinations}: {name}`}
            placeholder={copy.chooseDestination}
            dir={dir}
            className="w-full"
          />
        </Labelled>
      ) : null}
      {values.scope === "stay" ? (
        <Labelled id={`${ids}-stay`} label={copy.stays}>
          <Select
            value={values.stayId}
            options={stays.map((one) => ({ value: one.id, label: one.name }))}
            onChange={(stayId) => change({ stayId })}
            label={`${copy.stays}: {name}`}
            placeholder={copy.chooseStay}
            dir={dir}
            className="w-full"
          />
        </Labelled>
      ) : null}

      <DateRangeField
        id={`${ids}-dates`}
        label={copy.dates}
        hint={copy.sameDayHint}
        value={{ first: values.first, last: values.last }}
        onChange={({ first, last }) => change({ first, last })}
        min={today}
      />

      <Field
        id={`${ids}-reason`}
        label={copy.reasonOptional}
        name="reason"
        maxLength={REASON_MAX}
        value={values.reason}
        onChange={(event) => change({ reason: event.target.value })}
        className="max-w-none"
      />

      {message ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-label text-error">
          <AlertCircleIcon size={20} className="shrink-0" />
          <span>{message}</span>
        </p>
      ) : null}
      <Button type="submit" busy={busy}>
        {copy.block}
      </Button>
    </form>
  );
}

function Labelled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid max-w-96 gap-2">
      <span id={id} className="text-label text-ink">
        {label}
      </span>
      {children}
    </div>
  );
}
