"use client";

import { useEffect, useRef, useState } from "react";
import { applyReplies, plansAnything, planTranslation, requestTranslations, touchKey } from "../../../../components/ops/auto-translate";
import { errorText } from "../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../components/ops/ops-client";
import type { Locale3 } from "../../../../components/ops/api-types";
import { BANK_TEXT_LIMITS } from "../../../../lib/booking/bank";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { OPS_MONEY_COPY } from "../../../../lib/copy/ops-money";
import type { MoneyView } from "../../../../lib/ops/booking-rules";
import { bankChanged, moneyDirty, moneyForm, moneySaveBody, type MoneyForm } from "../../../../lib/ops/money-form";
import { MoneySection } from "./money-section";

// Plan 04-09 Task 8: the Bank transfer section of Settings, wired to /api/ops/money. It owns its own load, its own Save
// ("Save bank transfer") and its dirty flag; the page's bottom Save and the 02-06 groups are not touched. Only the note
// line goes to the translator (field bank_note): never a name, IBAN or SWIFT. Nothing here logs, stores or puts a bank
// value in a URL.

const AR_KEY = touchKey("ar", "bank_note");
const ES_KEY = touchKey("es", "bank_note");

export function MoneySettings({ locale, onDirtyChange }: { locale: Locale3; onDirtyChange: (dirty: boolean) => void }) {
  const copy = OPS_MONEY_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const closeLabel = DASHBOARD_COPY[locale].close;

  const [saved, setSaved] = useState<MoneyForm | null>(null);
  const [form, setForm] = useState<MoneyForm | null>(null);
  const [bankComplete, setBankComplete] = useState(false);
  const [termsFinal, setTermsFinal] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  // The Arabic / Spanish note lines the owner typed herself since the last save: the AI leaves those alone.
  const touched = useRef(new Set<string>());
  const inFlight = useRef(false);

  function take(money: MoneyView) {
    const next = moneyForm(money);
    setSaved(next);
    setForm(next);
    setBankComplete(money.bank_complete);
    setUpdatedAt(money.updated_at);
  }

  useEffect(() => {
    let live = true;
    void opsFetch<{ money: MoneyView; terms_final: boolean }>("/api/ops/money").then((reply) => {
      if (!live) return;
      if (!reply.ok) {
        setLoadFailed(true);
        return;
      }
      take(reply.money);
      setTermsFinal(reply.terms_final === true);
    });
    return () => {
      live = false;
    };
  }, []);

  const dirty = form !== null && saved !== null && moneyDirty(form, saved);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  if (loadFailed) {
    return (
      <section className="flex flex-col gap-2 border-t border-line pt-4" data-money-section>
        <h2 className="m-0 font-display text-title font-normal text-teal">{copy.title}</h2>
        <p className="m-0 text-label text-error" role="alert">
          {copy.loadFailed}
        </p>
      </section>
    );
  }
  if (!form || !saved) return null;

  function change(patch: Partial<MoneyForm>) {
    if ("noteAr" in patch) touched.current.add(AR_KEY);
    if ("noteEs" in patch) touched.current.add(ES_KEY);
    setForm((current) => (current ? { ...current, ...patch } : current));
    setStatus("idle");
    setLine(null);
  }

  function onSave() {
    if (busy || !form || !saved) return;
    if (bankChanged(form, saved)) setConfirmOpen(true);
    else void save();
  }

  async function save() {
    if (inFlight.current || !form || !saved) return;
    inFlight.current = true;
    setBusy(true);
    setStatus("idle");
    setLine(null);
    try {
      let notes: { ar: string | null; es: string | null } = { ar: form.noteAr, es: form.noteEs };
      let translationLine: string | null = null;
      if (bankChanged(form, saved)) {
        const plan = planTranslation(
          { bank_note: form.noteEn.trim() },
          { bank_note: saved.noteEn.trim() },
          { ar: { bank_note: form.noteAr }, es: { bank_note: form.noteEs } },
          touched.current,
        );
        const replies = await requestTranslations(plan, opsSend);
        const outcome = applyReplies(
          plan,
          { ar: { bank_note: form.noteAr }, es: { bank_note: form.noteEs } },
          replies,
          { bank_note: BANK_TEXT_LIMITS.note },
        );
        // A field that did not come back is left out of the body, never sent as the old text (Q-14).
        const pick = (value: unknown) => (typeof value === "string" ? value : null);
        notes = { ar: pick(outcome.translations.ar.bank_note), es: pick(outcome.translations.es.bank_note) };
        if (plansAnything(plan)) {
          translationLine = outcome.complete
            ? copy.translations.updated
            : outcome.reason === "limit"
              ? copy.translations.limit
              : outcome.reason === "busy"
                ? copy.translations.busy
                : copy.translations.notUpdated;
        }
      }
      const body = moneySaveBody(form, saved, notes);
      if (body === null) return;
      const reply = await opsSend<{ money: MoneyView }>("/api/ops/money", body);
      setConfirmOpen(false);
      if (!reply.ok) {
        setStatus("failed");
        setLine(errorText(kit, reply.error));
        return;
      }
      take(reply.money);
      touched.current = new Set();
      setStatus("saved");
      setLine(translationLine);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <MoneySection
      locale={locale}
      copy={copy}
      closeLabel={closeLabel}
      form={form}
      saved={saved}
      readiness={{ window: saved.windowValue !== "", bank: bankComplete, terms: termsFinal }}
      showTranslations={showTranslations}
      translationLine={line}
      status={status}
      busy={busy}
      confirmOpen={confirmOpen}
      updatedAt={updatedAt}
      onChange={change}
      onToggleTranslations={() => setShowTranslations((open) => !open)}
      onSave={onSave}
      onConfirm={() => void save()}
      onCancelConfirm={() => setConfirmOpen(false)}
    />
  );
}
