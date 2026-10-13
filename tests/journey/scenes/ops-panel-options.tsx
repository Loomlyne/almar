"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screens (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { ConnectPicker } from "../../../components/ops/connect-picker";
import { MediaField } from "../../../components/ops/media-field";
import { StatusChip } from "../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../components/ops/use-dashboard-locale";
import type { Locale3 } from "../../../components/ops/api-types";
import { CheckIcon, ChevronIcon, CloseIcon } from "../../../components/icons/icons";
import { Checkbox } from "../../../components/ui/checkbox";
import { Chip } from "../../../components/ui/chip";
import { Field } from "../../../components/ui/field";
import { Select } from "../../../components/ui/select";
import { cn } from "../../../lib/cn";
import { OPS_CATALOG_COPY } from "../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../lib/copy/ops-kit";
import type { SceneContext, Scenes } from "../scene-types";
import { SCENE_PHOTO, numbered, words } from "./_ops-catalog-words";

/**
 * Three redesigns of the Experiences-and-services panel (owner, 2026-10-14), for his choice. MOCK-UPS, nothing is
 * wired and the shared kit is not touched: each option is composed here from the design system's own parts. What the
 * owner asked for: a wider panel or a page, fields in short sections (Text, Price, Photo, Settings, Connections), a new
 * look for buttons and the action bar, and automatic translation (English only, Arabic and Spanish added on Save, an
 * "Edit translations" link, a message when the AI failed). Bracket placeholders only, no price. Test-only.
 *
 * A: wide drawer from the inline end over the dimmed list, sections stacked in one wide column.
 * B: a full page that replaces the list, a top action bar and two columns of section cards.
 * C: a large centred dialog with a section menu on the side and the action bar as a footer.
 */
type Option = "a" | "b" | "c";
type Frame = "main" | "translations" | "failed";

/** The dashboard language comes from the cookie; the harness picks it from ?l=, so set it first. */
function Shell({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

// ---- buttons: the new look, one per option (square corners, teal fill with white text, gold never a fill) -------------

type ButtonKind = "primary" | "secondary" | "text" | "danger-text";

const LOOK: Record<Option, Record<ButtonKind, string>> = {
  a: {
    primary: "h-control px-6 border border-teal bg-teal text-ivory hover:bg-teal-hover disabled:border-line disabled:bg-line disabled:text-muted",
    secondary: "h-control px-6 border border-teal bg-surface text-teal hover:bg-teal-tint disabled:border-line disabled:text-muted",
    text: "h-control px-2 border-0 bg-transparent text-teal underline decoration-gold decoration-1 underline-offset-4",
    "danger-text": "h-control px-2 border-0 bg-transparent text-error underline underline-offset-4",
  },
  b: {
    primary: "h-control px-5 border border-teal bg-teal text-ivory hover:bg-teal-hover disabled:border-line disabled:bg-line disabled:text-muted",
    secondary: "h-control px-5 border border-line bg-surface text-ink hover:bg-ivory disabled:text-muted",
    text: "h-control px-2 border-0 bg-transparent text-teal underline decoration-gold decoration-1 underline-offset-4",
    "danger-text": "h-control px-2 border-0 bg-transparent text-error underline underline-offset-4",
  },
  c: {
    primary: "h-action px-10 border border-teal bg-teal text-ivory hover:bg-teal-hover disabled:border-line disabled:bg-line disabled:text-muted",
    secondary: "h-action px-10 border border-ink bg-transparent text-ink hover:bg-surface disabled:border-line disabled:text-muted",
    text: "h-control px-2 border-0 bg-transparent text-teal underline decoration-gold decoration-1 underline-offset-4",
    "danger-text": "h-control px-2 border-0 bg-transparent text-error underline underline-offset-4",
  },
};

function Btn({ option, kind, disabled, describedBy, children }: { option: Option; kind: ButtonKind; disabled?: boolean; describedBy?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={describedBy}
      className={cn(
        "inline-flex w-max max-w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-none font-body text-label transition-colors duration-fast ease-standard disabled:cursor-default",
        LOOK[option][kind],
      )}
    >
      {children}
    </button>
  );
}

// ---- the sections ---------------------------------------------------------------------------------------------------

/** One English field: the content is English whatever the dashboard language, so it reads left to right. */
function english(id: string, label: string, value: string, extra?: { multiline?: boolean; required?: boolean }) {
  const common = { id, label, value, readOnly: true, className: "max-w-none", lang: "en", dir: "ltr" as const, required: extra?.required };
  return extra?.multiline ? <Field {...common} multiline rows={4} /> : <Field {...common} />;
}

function TranslationBlock({ locale, language, idBase }: { locale: "ar" | "es"; language: string; idBase: string }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const w = words(locale);
  const rtl = locale === "ar";
  return (
    <div lang={locale} dir={rtl ? "rtl" : "ltr"} className="flex min-w-0 flex-col gap-4 border border-line bg-surface p-4">
      <h4 className="m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal" lang={loc} dir={loc === "ar" ? "rtl" : "ltr"}>
        {language}
      </h4>
      <Field id={`${idBase}-${locale}-name`} label={copy.fieldName} value={w.name} readOnly className="max-w-none" />
      <Field id={`${idBase}-${locale}-summary`} label={copy.fieldDescription} value={w.description} readOnly multiline rows={3} className="max-w-none" />
      <Field id={`${idBase}-${locale}-duration`} label={copy.fieldDuration} value={w.duration} readOnly className="max-w-none" />
    </div>
  );
}

function TextSection({ idBase, initiallyOpen, wide }: { idBase: string; initiallyOpen: boolean; wide: boolean }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const en = words("en");
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="m-0 text-label text-muted">{copy.panel.englishOnly}</p>
      {english(`${idBase}-name`, copy.items.fieldName, en.name, { required: true })}
      {english(`${idBase}-summary`, copy.items.fieldDescription, en.description, { multiline: true })}
      {english(`${idBase}-duration`, copy.items.fieldDuration, en.duration)}
      <div className="flex flex-col items-start gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex min-h-control cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
        >
          <ChevronIcon size={16} className={open ? "-rotate-90" : "rotate-90"} />
          {open ? copy.panel.hideTranslations : copy.panel.editTranslations}
        </button>
        {open ? (
          <div className="flex w-full min-w-0 flex-col gap-4">
            <p className="m-0 text-label text-muted">{copy.panel.translationsNote}</p>
            <div className={cn("grid min-w-0 gap-4", wide && "md:grid-cols-2")}>
              <TranslationBlock locale="ar" language={kit.languages.ar} idBase={idBase} />
              <TranslationBlock locale="es" language={kit.languages.es} idBase={idBase} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceSection({ idBase, columns }: { idBase: string; columns: boolean }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const dir = loc === "ar" ? "rtl" : "ltr";
  return (
    <div className={cn("grid min-w-0 gap-4", columns && "md:grid-cols-2")}>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idBase}-unit`} className="text-label text-ink">
          {copy.fieldUnit}
        </label>
        <Select id={`${idBase}-unit`} dir={dir} value="person" label="{name}" options={[{ value: "person", label: copy.unitPerson }, { value: "night", label: copy.unitNight }, { value: "trip", label: copy.unitTrip }]} />
      </div>
      <Field id={`${idBase}-price`} label={copy.fieldPrice} className="max-w-none" inputMode="decimal" dir="ltr" value={words("en").price} readOnly hint={copy.priceHint} />
    </div>
  );
}

function PhotoSection({ idBase }: { idBase: string }) {
  const loc = useDashboardLocale();
  return <MediaField id={`${idBase}-photo`} label={OPS_CATALOG_COPY[loc].items.fieldPhoto} required value={SCENE_PHOTO} onChange={() => undefined} locale={loc} />;
}

function SettingsSection({ idBase }: { idBase: string }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-label text-ink">{copy.fieldType}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={copy.fieldType}>
          <Chip on>{copy.kindExperience}</Chip>
          <Chip>{copy.kindService}</Chip>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Checkbox label={copy.isUae} checked={false} onChange={() => undefined} />
        <Checkbox label={copy.isHomePickup} checked onChange={() => undefined} aria-describedby={`${idBase}-pickup-note`} />
        <p id={`${idBase}-pickup-note`} className="m-0 text-label text-muted">
          {copy.homePickupHint}
        </p>
      </div>
      <Field id={`${idBase}-slug`} label={copy.fieldSlug} className="max-w-none" dir="ltr" value={words("en").webAddress} readOnly hint={copy.slugHint} />
    </div>
  );
}

function ConnectionsSection() {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const locale = loc as Locale3;
  const destinations = [1, 2, 3].map((n) => ({ id: `d${n}`, label: numbered(locale, "destination", n) }));
  const stays = [1, 2, 3, 4].map((n) => ({ id: `s${n}`, label: numbered(locale, "stay", n), meta: numbered(locale, "destination", n <= 2 ? 1 : 2) }));
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="m-0 text-label text-muted">{copy.connectionsIntro}</p>
      <ConnectPicker title={copy.destinationsHeading} searchLabel={copy.searchDestinations} options={destinations} connected={["d1"]} onChange={() => undefined} />
      <ConnectPicker title={copy.staysHeading} searchLabel={copy.searchStays} options={stays} connected={["s2"]} onChange={() => undefined} />
    </div>
  );
}

function SectionTitle({ id, children, card }: { id?: string; children: ReactNode; card?: boolean }) {
  return (
    <h2 id={id} className={cn("m-0 text-balance font-display font-normal text-teal", card ? "text-title" : "text-title")}>
      {children}
    </h2>
  );
}

// ---- the action bar: status or the failure sentence, and the buttons ---------------------------------------------------

function Status({ frame }: { frame: Frame }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].panel;
  if (frame === "failed") {
    return (
      <p id="translation-failed" role="alert" className="m-0 max-w-prose border-s-2 border-error ps-2 text-label text-ink">
        {copy.translationFailed}
      </p>
    );
  }
  return (
    <p role="status" className="m-0 inline-flex items-center gap-2 text-label text-ink">
      <CheckIcon size={16} className="text-teal" aria-hidden="true" />
      {copy.translationsUpdated}
    </p>
  );
}

// ---- the three options ------------------------------------------------------------------------------------------------

function ListStub({ locale }: { locale: Locale3 }) {
  const copy = OPS_CATALOG_COPY[locale].items;
  return (
    <div className="flex min-w-0 flex-col gap-6 p-0" aria-hidden="true">
      <h1 className="m-0 font-display text-heading font-normal text-teal">{copy.title}</h1>
      <ul className="m-0 flex list-none flex-col p-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <li key={n} className="flex h-row items-center justify-between border-b border-line px-2 text-label text-ink">
            <span>{numbered(locale, "item", n)}</span>
            <span className="text-muted">{n % 2 ? copy.kindExperience : copy.kindService}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OptionA({ frame, locale }: { frame: Frame; locale: Locale3 }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const id = "a";
  return (
    <div className="flex min-w-0 items-stretch">
      <div className="hidden min-w-0 flex-1 pe-6 opacity-40 md:block">
        <ListStub locale={locale} />
      </div>
      <div data-testid="panel-box" className="flex min-w-0 flex-1 flex-col border-line bg-surface md:w-190 md:flex-none md:border-s md:shadow-lg">
        <div className="flex min-h-sheet-head items-center justify-between gap-2 border-b border-line px-6">
          <h1 className="m-0 text-balance font-display text-title font-normal text-teal">{words("en").name}</h1>
          <span className="inline-flex items-center gap-2">
            <StatusChip published={false} locale={loc} />
            <button type="button" className="inline-flex min-h-control min-w-control cursor-pointer items-center justify-center border border-line bg-transparent px-2 font-body text-label text-ink">
              {kit.close}
            </button>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-8 p-6">
          <section aria-labelledby={`${id}-t`} className="flex flex-col gap-4">
            <SectionTitle id={`${id}-t`}>{copy.panel.sectionText}</SectionTitle>
            <TextSection idBase={id} initiallyOpen={frame === "translations"} wide />
          </section>
          <section aria-labelledby={`${id}-p`} className="flex flex-col gap-4 border-t border-line pt-6">
            <SectionTitle id={`${id}-p`}>{copy.panel.sectionPrice}</SectionTitle>
            <PriceSection idBase={id} columns />
          </section>
          <section aria-labelledby={`${id}-ph`} className="flex flex-col gap-4 border-t border-line pt-6">
            <SectionTitle id={`${id}-ph`}>{copy.panel.sectionPhoto}</SectionTitle>
            <PhotoSection idBase={id} />
          </section>
          <section aria-labelledby={`${id}-s`} className="flex flex-col gap-4 border-t border-line pt-6">
            <SectionTitle id={`${id}-s`}>{copy.panel.sectionSettings}</SectionTitle>
            <SettingsSection idBase={id} />
          </section>
          <section aria-labelledby={`${id}-c`} className="flex flex-col gap-4 border-t border-line pt-6">
            <SectionTitle id={`${id}-c`}>{copy.panel.sectionConnections}</SectionTitle>
            <ConnectionsSection />
          </section>
        </div>
        <div className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-4 border-t border-line bg-surface p-4">
          <div className="min-w-0 flex-1 basis-60">
            <Status frame={frame} />
          </div>
          <Btn option="a" kind="danger-text">
            {kit.delete}
          </Btn>
          <Btn option="a" kind="secondary">
            {kit.save}
          </Btn>
          <Btn option="a" kind="primary" disabled={frame === "failed"} describedBy={frame === "failed" ? "translation-failed" : undefined}>
            {kit.publish}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function OptionB({ frame, locale }: { frame: Frame; locale: Locale3 }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const id = "b";
  const card = "flex min-w-0 flex-col gap-4 border border-line bg-surface p-6";
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <a href="#back" className="inline-flex min-h-control items-center gap-1 text-label text-teal underline decoration-gold decoration-1 underline-offset-4">
          <ChevronIcon size={16} className="rotate-180 rtl:rotate-0" aria-hidden="true" />
          {copy.items.title}
        </a>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{words("en").name}</h1>
            <span className="inline-flex flex-wrap items-center gap-3">
              <StatusChip published={false} locale={loc} />
              {frame === "failed" ? null : <Status frame={frame} />}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Btn option="b" kind="secondary">
              {kit.save}
            </Btn>
            <Btn option="b" kind="primary" disabled={frame === "failed"} describedBy={frame === "failed" ? "translation-failed" : undefined}>
              {kit.publish}
            </Btn>
          </div>
        </div>
        {frame === "failed" ? (
          <div className="border border-line bg-surface p-4">
            <Status frame={frame} />
          </div>
        ) : null}
      </div>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby={`${id}-t`} className={card}>
            <SectionTitle id={`${id}-t`} card>
              {copy.panel.sectionText}
            </SectionTitle>
            <TextSection idBase={id} initiallyOpen={frame === "translations"} wide />
          </section>
          <section aria-labelledby={`${id}-ph`} className={card}>
            <SectionTitle id={`${id}-ph`} card>
              {copy.panel.sectionPhoto}
            </SectionTitle>
            <PhotoSection idBase={id} />
          </section>
          <section aria-labelledby={`${id}-c`} className={card}>
            <SectionTitle id={`${id}-c`} card>
              {copy.panel.sectionConnections}
            </SectionTitle>
            <ConnectionsSection />
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby={`${id}-p`} className={card}>
            <SectionTitle id={`${id}-p`} card>
              {copy.panel.sectionPrice}
            </SectionTitle>
            <PriceSection idBase={id} columns={false} />
          </section>
          <section aria-labelledby={`${id}-s`} className={card}>
            <SectionTitle id={`${id}-s`} card>
              {copy.panel.sectionSettings}
            </SectionTitle>
            <SettingsSection idBase={id} />
            <div className="border-t border-line pt-4">
              <Btn option="b" kind="danger-text">
                {kit.delete}
              </Btn>
            </div>
          </section>
        </div>
      </div>
      <span className="sr-only">{locale}</span>
    </div>
  );
}

function OptionC({ frame }: { frame: Frame; locale: Locale3 }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const id = "c";
  const menu = [
    { key: "t", label: copy.panel.sectionText },
    { key: "p", label: copy.panel.sectionPrice },
    { key: "ph", label: copy.panel.sectionPhoto },
    { key: "s", label: copy.panel.sectionSettings },
    { key: "c", label: copy.panel.sectionConnections },
  ];
  const block = "flex min-w-0 flex-col gap-4 border-t border-line pt-6 first:border-t-0 first:pt-0";
  return (
    <div className="-m-1 bg-ink/40 p-3 md:p-10">
      <div data-testid="panel-box" className="mx-auto flex w-full max-w-270 flex-col bg-surface">
        <div className="flex min-h-sheet-head items-center justify-between gap-2 border-b border-line px-6">
          <h1 className="m-0 text-balance font-display text-title font-normal text-teal">{words("en").name}</h1>
          <span className="inline-flex items-center gap-2">
            <StatusChip published={false} locale={loc} />
            <button type="button" aria-label={kit.close} className="inline-flex size-control cursor-pointer items-center justify-center border border-line bg-transparent text-ink">
              <CloseIcon size={16} aria-hidden="true" />
            </button>
          </span>
        </div>
        <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label={kit.sections} className="border-b border-line p-4 md:border-b-0 md:border-e">
            <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 md:flex-col md:gap-0">
              {menu.map((item, at) => (
                <li key={item.key}>
                  <a
                    href={`#${id}-${item.key}`}
                    aria-current={at === 0 ? "true" : undefined}
                    className={cn(
                      "flex min-h-control items-center whitespace-nowrap border-b-2 px-2 text-label no-underline md:border-b-0 md:border-s-2",
                      at === 0 ? "border-gold text-teal" : "border-transparent text-ink",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-6 p-6">
            <section id={`${id}-t`} className={block}>
              <SectionTitle>{copy.panel.sectionText}</SectionTitle>
              <TextSection idBase={id} initiallyOpen={frame === "translations"} wide />
            </section>
            <section id={`${id}-p`} className={block}>
              <SectionTitle>{copy.panel.sectionPrice}</SectionTitle>
              <PriceSection idBase={id} columns />
            </section>
            <section id={`${id}-ph`} className={block}>
              <SectionTitle>{copy.panel.sectionPhoto}</SectionTitle>
              <PhotoSection idBase={id} />
            </section>
            <section id={`${id}-s`} className={block}>
              <SectionTitle>{copy.panel.sectionSettings}</SectionTitle>
              <SettingsSection idBase={id} />
            </section>
            <section id={`${id}-c`} className={block}>
              <SectionTitle>{copy.panel.sectionConnections}</SectionTitle>
              <ConnectionsSection />
            </section>
          </div>
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-line bg-ivory px-6 py-4">
          <Btn option="c" kind="danger-text">
            {kit.delete}
          </Btn>
          <div className="min-w-0 flex-1 basis-60">
            <Status frame={frame} />
          </div>
          <Btn option="c" kind="secondary">
            {kit.save}
          </Btn>
          <Btn option="c" kind="primary" disabled={frame === "failed"} describedBy={frame === "failed" ? "translation-failed" : undefined}>
            {kit.publish}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Scene({ ctx, option, frame }: { ctx: SceneContext; option: Option; frame: Frame }) {
  const locale = ctx.locale as Locale3;
  return (
    <Shell locale={locale}>
      {option === "a" ? <OptionA frame={frame} locale={locale} /> : option === "b" ? <OptionB frame={frame} locale={locale} /> : <OptionC frame={frame} locale={locale} />}
    </Shell>
  );
}

export const scenes: Scenes = {
  "a-main": (ctx) => <Scene ctx={ctx} option="a" frame="main" />,
  "a-translations": (ctx) => <Scene ctx={ctx} option="a" frame="translations" />,
  "a-failed": (ctx) => <Scene ctx={ctx} option="a" frame="failed" />,
  "b-main": (ctx) => <Scene ctx={ctx} option="b" frame="main" />,
  "b-translations": (ctx) => <Scene ctx={ctx} option="b" frame="translations" />,
  "b-failed": (ctx) => <Scene ctx={ctx} option="b" frame="failed" />,
  "c-main": (ctx) => <Scene ctx={ctx} option="c" frame="main" />,
  "c-translations": (ctx) => <Scene ctx={ctx} option="c" frame="translations" />,
  "c-failed": (ctx) => <Scene ctx={ctx} option="c" frame="failed" />,
};
