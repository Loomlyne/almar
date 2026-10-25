"use client";

import { useId } from "react";
import { CheckIcon, ChevronIcon, CloseIcon } from "../../../../components/icons/icons";
import { Button } from "../../../../components/ui/button";
import { Dialog } from "../../../../components/ui/dialog";
import { Field } from "../../../../components/ui/field";
import { Select, type SelectOption } from "../../../../components/ui/select";
import { BANK_TEXT_LIMITS, formatIban, isValidIban } from "../../../../lib/booking/bank";
import { fillCopy } from "../../../../lib/copy/ops-kit";
import type { OpsMoneyCopy, OpsMoneyLocale } from "../../../../lib/copy/ops-money";
import { uaeDateTimeText } from "../../../../lib/ops/booking-rules";
import { canSaveMoney, moneyErrors, type MoneyForm } from "../../../../lib/ops/money-form";

// Plan 04-09 Task 3: the Bank transfer section of Settings (signed 2026-10-25, all option A): the transfer window as a
// number and a unit, a confirm before a bank change, the readiness list. Drawn from props only: no fetch, no clock, no
// router. The screen that owns the data is 04-09 Task 8 (settings-screen.tsx mounts this section). The section has its
// own Save, named "Save bank transfer": the page's bottom Save stays the only button named exactly "Save".

export type MoneyReadiness = { window: boolean; bank: boolean; terms: boolean };

const LRI = "⁦";
const PDI = "⁩";

/** A directional isolate keeps an IBAN or a time in order inside an Arabic sentence. */
function isolate(text: string): string {
  return `${LRI}${text}${PDI}`;
}

function GroupTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="m-0 font-display text-title font-normal text-teal">
      {children}
    </h2>
  );
}

export function MoneySection({
  locale,
  copy,
  closeLabel,
  form,
  saved,
  readiness,
  showTranslations,
  translationLine,
  status,
  busy,
  confirmOpen,
  updatedAt,
  onChange,
  onToggleTranslations,
  onSave,
  onConfirm,
  onCancelConfirm,
}: {
  locale: OpsMoneyLocale;
  copy: OpsMoneyCopy;
  closeLabel: string;
  form: MoneyForm;
  /** The form as last saved, for Save's on / off. */
  saved: MoneyForm;
  readiness: MoneyReadiness;
  showTranslations: boolean;
  /** The sentence about the Arabic and Spanish note lines after a save, or null. */
  translationLine: string | null;
  status: "idle" | "saved" | "failed";
  busy: boolean;
  confirmOpen: boolean;
  /** ISO time of the last change, or null when never saved. */
  updatedAt: string | null;
  onChange: (patch: Partial<MoneyForm>) => void;
  onToggleTranslations: () => void;
  onSave: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const uid = useId();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const errors = moneyErrors(form);
  const units: SelectOption[] = [
    { value: "minutes", label: copy.units.minutes },
    { value: "hours", label: copy.units.hours },
    { value: "days", label: copy.units.days },
  ];
  const ibanHint = form.iban.trim() !== "" && isValidIban(form.iban) ? <bdi dir="ltr">{formatIban(form.iban)}</bdi> : undefined;
  const regionId = `${uid}-translations`;
  const canSave = canSaveMoney(form, saved) && !busy;

  function longText(max: number): string {
    return fillCopy(copy.errors.long, { max });
  }
  function textError(field: "accountName" | "bankName" | "bankAddress" | "noteEn" | "noteAr" | "noteEs", max: number): string | undefined {
    const code = errors[field];
    if (code === "required") return copy.errors.required;
    if (code === "long") return longText(max);
    return undefined;
  }
  const windowError = errors.window === "range" ? copy.errors.windowRange : errors.window === "whole" ? copy.errors.whole : undefined;
  const balanceError = errors.balanceDays === "range" ? copy.errors.daysRange : errors.balanceDays === "whole" ? copy.errors.whole : undefined;
  const ibanError = errors.iban === "checksum" ? copy.errors.checksum : errors.iban === "required" ? copy.errors.required : errors.iban === "long" ? longText(34) : undefined;
  const swiftError = errors.swift === "shape" ? copy.errors.shape : errors.swift === "required" ? copy.errors.required : undefined;

  const readinessRows: { key: string; label: string; ok: boolean }[] = [
    { key: "window", label: copy.readiness.window, ok: readiness.window },
    { key: "bank", label: copy.readiness.bank, ok: readiness.bank },
    { key: "terms", label: copy.readiness.terms, ok: readiness.terms },
  ];

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-title`} data-money-section>
      <GroupTitle id={`${uid}-title`}>{copy.title}</GroupTitle>

      <div className="flex flex-wrap items-end gap-2">
        <Field
          id={`${uid}-balance`}
          label={copy.balanceDue}
          inputMode="numeric"
          autoComplete="off"
          className="w-28 max-w-none tabular-nums"
          value={form.balanceDays}
          error={balanceError}
          onChange={(event) => onChange({ balanceDays: event.target.value })}
        />
        <span className="pb-3 text-label text-ink">{copy.balanceDaysAfter}</span>
      </div>
      <p className="m-0 text-caption text-muted">{copy.balanceHint}</p>

      <div className="flex flex-wrap items-end gap-2">
        <Field
          id={`${uid}-window`}
          label={copy.window}
          inputMode="numeric"
          autoComplete="off"
          className="w-28 max-w-none tabular-nums"
          value={form.windowValue}
          error={windowError}
          onChange={(event) => onChange({ windowValue: event.target.value })}
        />
        <Select
          value={form.windowUnit}
          options={units}
          dir={dir}
          label={`${copy.windowUnit}: {name}`}
          onChange={(next) => (next === "minutes" || next === "hours" || next === "days" ? onChange({ windowUnit: next }) : undefined)}
        />
      </div>
      <p className="m-0 text-caption text-muted">{copy.windowHint}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id={`${uid}-account`}
          label={copy.accountName}
          autoComplete="off"
          className="max-w-none"
          value={form.accountName}
          error={textError("accountName", BANK_TEXT_LIMITS.accountName)}
          onChange={(event) => onChange({ accountName: event.target.value })}
        />
        <Field
          id={`${uid}-bank`}
          label={copy.bankName}
          autoComplete="off"
          className="max-w-none"
          value={form.bankName}
          error={textError("bankName", BANK_TEXT_LIMITS.bankName)}
          onChange={(event) => onChange({ bankName: event.target.value })}
        />
        <Field
          id={`${uid}-iban`}
          label={copy.iban}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className="max-w-none"
          value={form.iban}
          hint={ibanHint}
          error={ibanError}
          onChange={(event) => onChange({ iban: event.target.value })}
        />
        <Field
          id={`${uid}-swift`}
          label={copy.swift}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className="max-w-none"
          value={form.swift}
          error={swiftError}
          onChange={(event) => onChange({ swift: event.target.value })}
        />
      </div>
      <Field
        id={`${uid}-address`}
        label={copy.bankAddress}
        autoComplete="off"
        className="max-w-none"
        value={form.bankAddress}
        error={textError("bankAddress", BANK_TEXT_LIMITS.bankAddress)}
        onChange={(event) => onChange({ bankAddress: event.target.value })}
      />
      <Field
        id={`${uid}-note`}
        label={copy.note}
        autoComplete="off"
        className="max-w-none"
        value={form.noteEn}
        hint={copy.noteHint}
        error={textError("noteEn", BANK_TEXT_LIMITS.note)}
        onChange={(event) => onChange({ noteEn: event.target.value })}
      />

      <div className="flex min-w-0 flex-col items-start gap-4">
        <button
          type="button"
          aria-expanded={showTranslations}
          aria-controls={showTranslations ? regionId : undefined}
          onClick={onToggleTranslations}
          className="inline-flex min-h-control cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
        >
          <ChevronIcon size={16} className={showTranslations ? "-rotate-90" : "rotate-90"} aria-hidden="true" />
          {showTranslations ? copy.hideTranslations : copy.editTranslations}
        </button>
        {showTranslations ? (
          <div id={regionId} className="grid w-full min-w-0 gap-4 md:grid-cols-2">
            <Field
              id={`${uid}-note-ar`}
              label={`${copy.note} · ${copy.arabic}`}
              lang="ar"
              dir="rtl"
              autoComplete="off"
              className="max-w-none"
              value={form.noteAr}
              error={textError("noteAr", BANK_TEXT_LIMITS.note)}
              onChange={(event) => onChange({ noteAr: event.target.value })}
            />
            <Field
              id={`${uid}-note-es`}
              label={`${copy.note} · ${copy.spanish}`}
              lang="es"
              dir="ltr"
              autoComplete="off"
              className="max-w-none"
              value={form.noteEs}
              error={textError("noteEs", BANK_TEXT_LIMITS.note)}
              onChange={(event) => onChange({ noteEs: event.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="m-0 text-label text-ink">{copy.readiness.title}</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-label text-ink">
          {readinessRows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              {row.ok ? <CheckIcon size={16} aria-hidden="true" /> : <CloseIcon size={16} aria-hidden="true" />}
              <span>{row.label}</span>
              <span className="text-muted">{row.ok ? copy.readiness.set : copy.readiness.notSet}</span>
            </li>
          ))}
        </ul>
      </div>

      {updatedAt ? <p className="m-0 text-caption text-muted">{fillCopy(copy.lastChanged, { time: isolate(uaeDateTimeText(updatedAt)) })}</p> : null}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button busy={busy} disabled={!canSave} onClick={onSave}>
          {busy ? copy.saving : copy.save}
        </Button>
        <p className="m-0 flex flex-col gap-1 text-label" role="status" aria-live="polite">
          {status === "saved" ? (
            <span className="flex items-center gap-1 text-success">
              <CheckIcon size={16} aria-hidden="true" />
              {copy.saved}
            </span>
          ) : status === "failed" ? (
            <span className="text-error">{copy.saveFailed}</span>
          ) : null}
          {translationLine ? <span className="text-muted">{translationLine}</span> : null}
        </p>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next) onCancelConfirm();
        }}
        title={copy.confirm.title}
        closeLabel={closeLabel}
        dismiss="confirm"
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={onCancelConfirm}>
              {copy.confirm.back}
            </Button>
            <Button busy={busy} onClick={onConfirm}>
              {copy.confirm.save}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="m-0 text-body text-ink">{fillCopy(copy.confirm.body, { name: form.accountName.trim(), iban: isolate(formatIban(form.iban)) })}</p>
          <p className="m-0 text-label text-muted">{copy.confirm.noEmailNote}</p>
        </div>
      </Dialog>
    </section>
  );
}
