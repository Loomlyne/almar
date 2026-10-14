"use client";

import { useId, useState, type ReactNode } from "react";
import { DateRangeField } from "../../../../components/ops/date-range-field";
import type { Locale3 } from "../../../../components/ops/api-types";
import { Field } from "../../../../components/ui/field";
import { Select } from "../../../../components/ui/select";
import { ToggleCardGroup } from "../../../../components/ui/toggle-card";
import { OPS_CALENDAR_COPY } from "../../../../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { REASON_MAX, blockPayload, type BlockFormValues, type BlockPayload, type BlockScope } from "./block-form";

export type CalendarPlace = { id: string; name: string };
export type CalendarStay = CalendarPlace & { destinationId: string };

type Change = (next: Partial<BlockFormValues>) => void;

/**
 * The state and the check of Block dates, with no page around them. The kit editor page (EditPage) hosts the fields as
 * its cards and its Save calls `check`: the contract 5.4 payload, or null with `missing` set to the sentence that says
 * what is left to fill. A new `initial` (the form opened again, from a day or a stay link) starts the form afresh.
 */
export function useBlockForm(locale: Locale3, initial: BlockFormValues) {
  const copy = OPS_CALENDAR_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const [source, setSource] = useState(initial);
  const [values, setValues] = useState<BlockFormValues>(initial);
  const [missing, setMissing] = useState<string | null>(null);
  if (source !== initial) {
    setSource(initial);
    setValues(initial);
    setMissing(null);
  }

  const change: Change = (next) => {
    setMissing(null);
    setValues((old) => ({ ...old, ...next }));
  };

  function check(): BlockPayload | null {
    const result = blockPayload(values);
    if (result.ok) {
      setMissing(null);
      return result.payload;
    }
    setMissing(
      result.field === "destination"
        ? copy.needDestination
        : result.field === "stay"
          ? copy.needStay
          : result.field === "dates"
            ? copy.needDates
            : kit.errors.invalid,
    );
    return null;
  }

  return { values, change, dirty: JSON.stringify(values) !== JSON.stringify(initial), missing, check };
}

/** What to block (everything, one destination, one stay) and the one pick list that goes with it. */
export function BlockTargetFields({
  locale,
  destinations,
  stays,
  values,
  onChange,
}: {
  locale: Locale3;
  destinations: CalendarPlace[];
  stays: CalendarStay[];
  values: BlockFormValues;
  onChange: Change;
}) {
  const copy = OPS_CALENDAR_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const ids = useId();
  return (
    <>
      <p className="m-0 text-body text-pretty text-ink">{copy.blockedNote}</p>
      {/* The card's heading says "What to block" on screen; the group keeps it as its name. */}
      <span id={`${ids}-scope`} className="sr-only">
        {copy.whatToBlock}
      </span>
      <ToggleCardGroup
        labelId={`${ids}-scope`}
        value={values.scope}
        onChange={(scope) => onChange({ scope: scope as BlockScope })}
        options={[
          { value: "all", title: copy.everything, detail: copy.everythingDetail },
          { value: "destination", title: copy.oneDestination, detail: copy.oneDestinationDetail },
          { value: "stay", title: copy.oneStay },
        ]}
      />
      {values.scope === "destination" ? (
        <Labelled id={`${ids}-destination`} label={copy.destinations}>
          <Select
            value={values.destinationId}
            options={destinations.map((one) => ({ value: one.id, label: one.name }))}
            onChange={(destinationId) => onChange({ destinationId })}
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
            onChange={(stayId) => onChange({ stayId })}
            label={`${copy.stays}: {name}`}
            placeholder={copy.chooseStay}
            dir={dir}
            className="w-full"
          />
        </Labelled>
      ) : null}
    </>
  );
}

/** The one "Dates" range: first day, then last day; one day is the same day twice; days before today are not pickable. */
export function BlockDatesField({
  locale,
  today,
  values,
  onChange,
}: {
  locale: Locale3;
  /** Today in Dubai, `YYYY-MM-DD`. */
  today: string;
  values: BlockFormValues;
  onChange: Change;
}) {
  const copy = OPS_CALENDAR_COPY[locale];
  const id = useId();
  // The card's heading already says "Dates": the field's own label stays as the button's name, visually hidden.
  return (
    <div className="[&>div>label]:sr-only">
      <DateRangeField
        id={`${id}-dates`}
        label={copy.dates}
        hint={copy.sameDayHint}
        value={{ first: values.first, last: values.last }}
        onChange={({ first, last }) => onChange({ first, last })}
        min={today}
      />
    </div>
  );
}

/** The optional reason, for the owner only (it is not shown on the site, so it is not translated). */
export function BlockReasonField({ locale, values, onChange }: { locale: Locale3; values: BlockFormValues; onChange: Change }) {
  const copy = OPS_CALENDAR_COPY[locale];
  const id = useId();
  // The card's heading already says "Reason (optional)": the field's label stays as the input's name, visually hidden.
  return (
    <div className="[&_.field-label]:sr-only">
      <Field
        id={`${id}-reason`}
        label={copy.reasonOptional}
        name="reason"
        maxLength={REASON_MAX}
        value={values.reason}
        onChange={(event) => onChange({ reason: event.target.value })}
        className="max-w-none"
      />
    </div>
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
