"use client";

// Part B pictures only (2026-10-14). NOT application code and not a test: shoot_states.mjs copies this file and
// partb-states.json into tests/journey/scenes for the shoot, then removes both. It draws every state of the Contact
// form box and the footer newsletter with the REAL components on main, laid out as plans 26 and 27 place them
// (the box is the end column of [data-contact-columns]: two equal columns from lg). Captions sit OUTSIDE the
// frames, in a dashed grey tag, so they never read as site text.
import type { ReactNode } from "react";

import { Button, LinkButton } from "../../../components/ui/button";
import { Field } from "../../../components/ui/field";
import { Link } from "../../../components/ui/link";
import { Select } from "../../../components/ui/select";
import { CloseIcon, ShieldIcon } from "../../../components/icons/icons";
import type { Scenes } from "../scene-types";
import strings from "./partb-states.json";

type Locale = "en" | "ar" | "es";
type T = (typeof strings)["en"];

const LIGHT_HEAD = "mb-2 block font-body text-caption uppercase tracking-kicker text-ink ar:normal-case ar:tracking-normal";
const ERR = "m-0 text-label field-error text-error";
const WA = "https://wa.me/971563883302";

function assertStrings(t: T): void {
  for (const [key, value] of Object.entries(t)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (typeof item !== "string" || !item.trim()) throw new Error(`label ${key} is not a string`);
    }
  }
}

function Caption({ children }: { children: string }) {
  return (
    <p className="m-0 mb-3 inline-block border border-dashed border-muted px-2 py-0.5 font-mono text-caption text-muted" data-caption>
      {children}
    </p>
  );
}

type Vals = { name?: string; phone?: string; mail?: string; type?: number; msg?: string };
type Errs = { name?: string; phone?: string; mail?: string; type?: string; msg?: string };

function FormBox({ t, l, k, vals = {}, errs = {}, busy = false, failed = false }: {
  t: T; l: Locale; k: string; vals?: Vals; errs?: Errs; busy?: boolean; failed?: boolean;
}) {
  const options = t.f_types.map((label, i) => ({ value: String(i), label }));
  const [a, mail, b, wa, c] = t.failed;
  return (
    <div id={`inquiry-${k}`} className="grid content-start gap-6 border border-teal p-6 md:p-12">
      <div className="grid gap-6 md:grid-cols-2">
        <Field id={`${k}-name`} label={t.f_name} required className="max-w-none" defaultValue={vals.name ?? ""} error={errs.name} readOnly />
        <Field id={`${k}-phone`} label={t.f_phone} type="tel" className="max-w-none" defaultValue={vals.phone ?? ""} error={errs.phone} readOnly />
      </div>
      <Field id={`${k}-mail`} label={t.f_mail} type="email" required className="max-w-none" defaultValue={vals.mail ?? ""} error={errs.mail} readOnly />
      <div className="grid gap-2">
        <label className="field-label text-label text-ink" htmlFor={`${k}-type`}>
          {t.f_type}
          <span className="text-ink" aria-hidden="true">{" "}*</span>
        </label>
        <Select
          id={`${k}-type`}
          value={vals.type === undefined ? null : String(vals.type)}
          options={options}
          label={`${t.f_type}: {name}`}
          placeholder={t.f_placeholder}
          dir={l === "ar" ? "rtl" : "ltr"}
          className={errs.type ? "w-full border-error" : "w-full"}
        />
        {errs.type ? <p className={ERR}>{errs.type}</p> : null}
      </div>
      <Field id={`${k}-msg`} label={t.f_msg} multiline required className="max-w-none" defaultValue={vals.msg ?? ""} error={errs.msg} readOnly />
      {failed ? (
        <p role="alert" className="m-0 border-s-2 border-error ps-3 text-label text-error">
          {a}
          <Link inline href={`mailto:${mail}`}><bdi>{mail}</bdi></Link>
          {b}
          <Link inline href={WA}>{wa}</Link>
          {c}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy}>{busy ? t.sending : t.f_send}</Button>
        <LinkButton href={WA} variant="outline">{t.wa_btn}</LinkButton>
      </div>
    </div>
  );
}

function SentBox({ t }: { t: T }) {
  return (
    <div className="grid min-h-80 content-center border border-teal p-6 md:p-12">
      <p role="status" tabIndex={-1} className="m-0 font-display text-title text-teal">{t.sent}</p>
    </div>
  );
}

function News({ t, k, val = "", error, busy = false, failed = false }: {
  t: T; k: string; val?: string; error?: string; busy?: boolean; failed?: boolean;
}) {
  const line = error ?? (failed ? t.n_failed : undefined);
  return (
    <div className="grid max-w-md content-start gap-2 border-t border-line pt-8">
      <p className={LIGHT_HEAD}>{t.n_title}</p>
      <p className="m-0 font-body text-label text-ink">{t.n_line}</p>
      <label className="block font-body text-label text-ink" htmlFor={`${k}-news`}>{t.n_email}</label>
      <input
        id={`${k}-news`}
        type="email"
        readOnly
        defaultValue={val}
        aria-invalid={line ? true : undefined}
        className="block h-control w-full rounded-none border border-ink bg-surface px-4 font-body text-body text-ink aria-invalid:border-error"
      />
      {line ? <p role="alert" className={ERR}>{line}</p> : null}
      <div className="pt-2">
        <Button variant="outline" busy={busy}>{busy ? t.sending : t.n_join}</Button>
      </div>
    </div>
  );
}

function Toasted({ t, k }: { t: T; k: string }) {
  // The toast card with toast.tsx's own classes, drawn in place (the real one is fixed to the viewport).
  return (
    <div className="grid gap-8">
      <News t={t} k={k} />
      <div className="flex justify-center">
        <div role="status" className="flex items-center gap-2 rounded-none bg-surface px-4 py-2 text-ink shadow-lg">
          <ShieldIcon size={16} className="text-success" />
          <p className="m-0">{t.n_success}</p>
          <span className="inline-flex size-control shrink-0 items-center justify-center text-teal" aria-hidden="true">
            <CloseIcon size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Sheet({ l }: { l: Locale }) {
  const t = (strings as Record<Locale, T>)[l];
  assertStrings(t);
  const full: Vals = { name: t.v_name, mail: t.v_mail, type: 2, msg: t.v_msg };
  const cells: [string, ReactNode][] = [
    [t.st[0], <FormBox key="1" t={t} l={l} k="s1" />],
    [t.st[1], <FormBox key="2" t={t} l={l} k="s2" errs={{ name: t.e_name, mail: t.e_mail_req, type: t.e_type, msg: t.e_msg }} />],
    [t.st[2], <FormBox key="3" t={t} l={l} k="s3" vals={{ name: t.v_name, phone: t.v_phone_bad, mail: t.v_mail_bad, type: 0, msg: t.v_long }} errs={{ phone: t.e_phone, mail: t.e_mail_bad, msg: t.e_long }} />],
    [t.st[3], <FormBox key="4" t={t} l={l} k="s4" vals={full} busy />],
    [t.st[4], <SentBox key="5" t={t} />],
    [t.st[5], <FormBox key="6" t={t} l={l} k="s6" vals={full} failed />],
    [t.st[6], <News key="7" t={t} k="s7" />],
    [t.st[7], <News key="8" t={t} k="s8" val={t.v_mail_bad} error={t.n_invalid} />],
    [t.st[8], <News key="9" t={t} k="s9" val={t.v_mail} busy />],
    [t.st[9], <News key="10" t={t} k="s10" val={t.v_mail} failed />],
    [t.st[10], <Toasted key="11" t={t} k="s11" />],
  ];
  return (
    <div className="bg-ivory">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-12 md:px-8">
        <p className="m-0 mb-1 font-mono text-caption text-muted" data-caption>{t.sheet}</p>
        <p className="m-0 mb-10 font-mono text-caption text-muted" data-caption>{t.note}</p>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {cells.map(([cap, node]) => (
            <section key={cap}>
              <Caption>{cap}</Caption>
              {node}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export const scenes: Scenes = {
  sheet: ({ locale }) => <Sheet l={locale as Locale} />,
};
