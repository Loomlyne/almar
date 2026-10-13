"use client";

// Plan 02-06: Settings on the ops host (pictures signed 2026-10-13). Reads and saves through /api/ops/settings only
// (components/ops/ops-client.ts); never imports a Supabase client. Corners are not a control and the FX rate is text.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Select, type SelectOption } from "../../../../components/ui/select";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { CheckIcon } from "../../../../components/icons/icons";
import { MediaPicker } from "../../../../components/ops/media-picker";
import { useMediaLibrary } from "../../../../components/ops/use-media-library";
import { opsFetch, opsSend } from "../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_SETTINGS_COPY } from "../../../../lib/copy/ops-settings";
import { setDocumentLocale } from "../../../../lib/set-document-locale";
import type { BrandKey } from "../../../../lib/settings/contrast";
import {
  canSave,
  contrastErrors,
  isDirty,
  percentError,
  percentText,
  saveBody,
  type FormLogo,
  type SettingsForm,
} from "../../../../lib/settings/form";
import type { SettingsView } from "../../../../lib/settings/handlers";
import charcoalLogo from "../../../../brand/Logo Typography/Stacked_Charcoal.svg";

const BRAND_ORDER: readonly BrandKey[] = ["teal", "charcoal", "gold", "ivory", "white"];
const SAVED_FLAG = "almar-settings-saved";

const LANGUAGES: readonly SelectOption[] = [
  { value: "en", code: "EN", label: "English" },
  { value: "ar", code: "AR", label: "العربية" },
  { value: "es", code: "ES", label: "Español" },
];
const CURRENCIES: readonly SelectOption[] = [
  { value: "AED", code: "AED", label: "AED" },
  { value: "USD", code: "USD", label: "USD" },
  { value: "EUR", code: "EUR", label: "EUR" },
];

function toForm(view: SettingsView): SettingsForm {
  return {
    colors: { ...view.colors },
    titleFace: "Questa",
    bodyFace: "Lato",
    vat: view.vat_percent ?? "",
    deposit: view.deposit_percent ?? "",
    maintenance: view.maintenance,
    logo: view.logo ? { id: view.logo.id, url: view.logo.url, bytes: view.logo.bytes, contentType: view.logo.content_type } : null,
    locale: view.locale,
    currency: view.currency,
  };
}

function GroupTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="m-0 font-display text-title font-normal text-teal">
      {children}
    </h2>
  );
}

function ErrorLine({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="m-0 flex items-center gap-1 text-label text-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v5M12 17.5v.5" />
      </svg>
      {children}
    </p>
  );
}

export function SettingsScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_SETTINGS_COPY[locale];
  const dash = DASHBOARD_COPY[locale];
  const uid = useId();

  const [saved, setSaved] = useState<SettingsForm | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [fx, setFx] = useState<SettingsView["fx"]>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [logoRefused, setLogoRefused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  const { library } = useMediaLibrary({ enabled: pickerOpen, locale, onUploaded: (item) => setPicked([item.id]) });

  useEffect(() => {
    let live = true;
    void opsFetch<{ settings: SettingsView }>("/api/ops/settings").then((reply) => {
      if (!live) return;
      if (!reply.ok) {
        setLoadError(true);
        return;
      }
      const next = toForm(reply.settings);
      setSaved(next);
      setForm(next);
      setFx(reply.settings.fx);
      try {
        if (window.sessionStorage.getItem(SAVED_FLAG) === "1") {
          window.sessionStorage.removeItem(SAVED_FLAG);
          setStatus("saved");
        }
      } catch {
        // Storage blocked: the line simply does not survive the reload.
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const dirty = form !== null && saved !== null && isDirty(form, saved);
  dirtyRef.current = dirty;

  // Unsaved changes: a link click asks first (Leave settings / Stay on settings); closing the tab gets the browser's own prompt.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.href);
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const edit = useCallback((patch: Partial<SettingsForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setStatus("idle");
  }, []);

  if (loadError) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="m-0 font-display text-heading font-normal text-teal">{dash.rail.settings}</h1>
        <p className="m-0 text-body text-ink" role="alert">
          {copy.loadFailed}
        </p>
      </div>
    );
  }
  if (!form || !saved) {
    return <h1 className="m-0 font-display text-heading font-normal text-teal">{dash.rail.settings}</h1>;
  }

  const contrast = new Set(contrastErrors(form, saved));
  const vatError = percentError(form.vat);
  const depositError = percentError(form.deposit);
  const enabled = canSave(form, saved) && !saving;

  async function onSave() {
    if (!form || !saved || !canSave(form, saved)) return;
    setSaving(true);
    setLogoRefused(false);
    const reply = await opsSend<{ affects_site: boolean }>("/api/ops/settings", saveBody(form));
    setSaving(false);
    if (!reply.ok) {
      if (reply.error.field === "logo_media_id") setLogoRefused(true);
      setStatus("failed");
      return;
    }
    const next: SettingsForm = { ...form, vat: percentText(form.vat.trim() || null), deposit: percentText(form.deposit.trim() || null) };
    const localeChanged = next.locale !== saved.locale;
    setSaved(next);
    setForm(next);
    setStatus("saved");
    if (localeChanged) {
      // D-57: a saved language re-renders the ops shell, not only this screen.
      document.cookie = `almar-locale=${next.locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setDocumentLocale(next.locale);
      try {
        window.sessionStorage.setItem(SAVED_FLAG, "1");
      } catch {
        // ignore
      }
      dirtyRef.current = false;
      window.location.reload();
    }
  }

  const logoWell = form.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={form.logo.url} alt="" className="block max-h-full max-w-full object-contain" />
  ) : saved.logo ? null : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={charcoalLogo.src} alt="" className="block max-h-full max-w-full object-contain" />
  );

  return (
    <div className="flex min-w-0 max-w-160 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{dash.rail.settings}</h1>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-brand`}>
        <GroupTitle id={`${uid}-brand`}>{copy.brandColors}</GroupTitle>
        {BRAND_ORDER.map((key) => {
          const inputId = `${uid}-color-${key}`;
          const errorId = `${inputId}-error`;
          const bad = contrast.has(key);
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex min-h-control items-center gap-4">
                <label htmlFor={inputId} className="min-w-24 flex-1 text-label text-ink">
                  {copy.colors[key]}
                </label>
                {/* A square swatch: the native colour input sits invisibly over it (the OS picker opens on click). */}
                <span
                  className={`relative block size-control shrink-0 border bg-surface p-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal ${bad ? "border-error" : "border-ink"}`}
                >
                  <span className="block size-full border border-line" style={{ backgroundColor: form.colors[key] }} aria-hidden="true" />
                  <input
                    id={inputId}
                    type="color"
                    value={form.colors[key]}
                    onChange={(event) => edit({ colors: { ...form.colors, [key]: event.target.value.toLowerCase() } })}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? errorId : undefined}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </span>
                <span className="min-w-18 text-label tabular-nums text-ink" dir="ltr">
                  {form.colors[key]}
                </span>
              </div>
              {bad ? <ErrorLine id={errorId}>{copy.contrast}</ErrorLine> : null}
              {key === "gold" ? <p className="m-0 text-caption text-muted">{copy.goldHint}</p> : null}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-type`}>
        <GroupTitle id={`${uid}-type`}>{copy.type}</GroupTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink" id={`${uid}-title-face`}>{copy.titleFace}</span>
            <Select value="Questa" options={[{ value: "Questa", label: "Questa" }]} onChange={() => undefined} label={`${copy.titleFace}: {name}`} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink" id={`${uid}-body-face`}>{copy.bodyFace}</span>
            <Select value="Lato" options={[{ value: "Lato", label: "Lato" }]} onChange={() => undefined} label={`${copy.bodyFace}: {name}`} />
          </div>
        </div>
        <p className="m-0 text-caption text-muted">{copy.arabicFaces}</p>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-money`}>
        <GroupTitle id={`${uid}-money`}>{copy.money}</GroupTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={`${uid}-vat`}
            label={copy.vat}
            name="vat-percent"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={form.vat}
            onChange={(event) => edit({ vat: event.target.value })}
            error={vatError ? copy[vatError] : undefined}
          />
          <Field
            id={`${uid}-deposit`}
            label={copy.deposit}
            name="deposit-percent"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={form.deposit}
            onChange={(event) => edit({ deposit: event.target.value })}
            error={depositError ? copy[depositError] : undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label text-ink">{copy.fx}</span>
          {fx ? (
            <p className="m-0 flex flex-wrap gap-x-4 text-body tabular-nums text-ink" dir="ltr">
              <span>USD/AED {fx.aed}</span>
              <span>USD/EUR {fx.eur}</span>
            </p>
          ) : (
            <p className="m-0 text-body text-ink">{copy.fxNone}</p>
          )}
          <span className="text-caption text-muted">{copy.fxHint}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-maintenance`}>
        <GroupTitle id={`${uid}-maintenance`}>{copy.maintenance}</GroupTitle>
        <Checkbox
          label={copy.maintenanceOn}
          checked={form.maintenance}
          onChange={(event) => edit({ maintenance: event.target.checked })}
        />
        <p className="m-0 text-caption text-muted">{copy.maintenanceHint}</p>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-logo`}>
        <GroupTitle id={`${uid}-logo`}>{copy.logo}</GroupTitle>
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-32 shrink-0 place-items-center border border-line bg-surface p-3">{logoWell}</div>
          <div className="flex flex-col items-start gap-2">
            <Button
              id={`${uid}-logo-upload`}
              variant="outline"
              aria-describedby={`${uid}-logo-hint${logoRefused ? ` ${uid}-logo-error` : ""}`}
              onClick={() => {
                setPicked(form.logo ? [form.logo.id] : []);
                setPickerOpen(true);
              }}
            >
              {copy.upload}
            </Button>
            <span id={`${uid}-logo-hint`} className="text-caption text-muted">
              {copy.logoHint}
            </span>
            {logoRefused ? <ErrorLine id={`${uid}-logo-error`}>{copy.logoRefused}</ErrorLine> : null}
            {saved.logo && form.logo ? (
              <Button variant="ghost" className="px-0" onClick={() => edit({ logo: null })}>
                {copy.removeLogo}
              </Button>
            ) : null}
          </div>
        </div>
        <MediaPicker
          {...library}
          open={pickerOpen}
          onOpenChange={(next) => {
            if (!next) library.onCancelUpload();
            setPickerOpen(next);
          }}
          locale={locale}
          multiple={false}
          selected={picked}
          onSelectedChange={setPicked}
          onChoose={(items) => {
            const item = items[0];
            if (item) {
              const chosen: FormLogo = { id: item.id, url: item.url, bytes: null, contentType: item.content_type };
              edit({ logo: chosen });
              setLogoRefused(false);
            }
            library.onCancelUpload();
            setPickerOpen(false);
            document.getElementById(`${uid}-logo-upload`)?.focus();
          }}
        />
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-prefs`}>
        <GroupTitle id={`${uid}-prefs`}>{copy.langCurrency}</GroupTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink">{copy.language}</span>
            <Select
              value={form.locale}
              options={LANGUAGES}
              onChange={(next) => (next === "en" || next === "ar" || next === "es" ? edit({ locale: next }) : undefined)}
              label={`${copy.language}: {name}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink">{copy.currency}</span>
            <Select
              value={form.currency}
              options={CURRENCIES}
              onChange={(next) => (next === "AED" || next === "USD" || next === "EUR" ? edit({ currency: next }) : undefined)}
              label={`${copy.currency}: {name}`}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <Button onClick={() => void onSave()} disabled={!enabled}>
          {dash.save}
        </Button>
        <p className="m-0 flex items-center gap-1 text-label" role="status" aria-live="polite">
          {status === "saved" && !dirty ? (
            <span className="flex items-center gap-1 text-success">
              <CheckIcon size={16} aria-hidden="true" />
              {copy.saved}
            </span>
          ) : status === "failed" ? (
            <span className="text-error">{copy.saveFailed}</span>
          ) : null}
        </p>
      </div>

      <ConfirmDialog
        open={leaveTo !== null}
        onOpenChange={(open) => (open ? undefined : setLeaveTo(null))}
        title={copy.leaveTitle}
        confirmLabel={copy.leave}
        cancelLabel={copy.stay}
        onConfirm={() => {
          const target = leaveTo;
          dirtyRef.current = false;
          setLeaveTo(null);
          if (target) window.location.assign(target);
        }}
      />
    </div>
  );
}
