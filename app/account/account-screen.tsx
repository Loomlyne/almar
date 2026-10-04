"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { pageLinks } from "../../components/site/page-links";
import { SiteNav } from "../../components/ui/nav";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { LocaleSelect } from "../../components/ui/locale-select";
import type { NavAccount } from "../../components/ui/account-menu";
import { GUEST_COPY } from "../../lib/copy/guest";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";
import type { SessionProfile } from "../../lib/supabase/clients";
import { savePreferences, saveProfile, type SaveState } from "./actions";

type Currency = SessionProfile["currency"];

const CARD = "grid gap-4 border border-line bg-surface p-6";
const CARD_TITLE = "m-0 font-display text-title text-teal";

/** Canvas page 6, board 6b, Phase 2 parts only: Profile, Preferences, Sign-in and security. */
export function AccountScreen({ profile, account }: { profile: SessionProfile; account: NavAccount }) {
  const [locale, setLocale] = useState<DocumentLocale>(profile.locale);
  const [currency, setCurrency] = useState<Currency>(profile.currency);
  const [names, setNames] = useState({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone });
  const [profileState, setProfileState] = useState<SaveState>({ status: "idle" });
  const [prefState, setPrefState] = useState<SaveState>({ status: "idle" });
  const [savingProfile, startProfile] = useTransition();
  const [, startPrefs] = useTransition();
  const copy = GUEST_COPY[locale];
  const hub = copy.hub;
  const localeCopy = JOURNEY_COPY[locale].locale;
  const nav = HOME_COPY[locale].nav;

  useEffect(() => setDocumentLocale(locale), [locale]);

  function storePreferences(nextLocale: DocumentLocale, nextCurrency: Currency) {
    setLocale(nextLocale);
    setCurrency(nextCurrency);
    const form = new FormData();
    form.set("locale", nextLocale);
    form.set("currency", nextCurrency);
    startPrefs(async () => setPrefState(await savePreferences(form)));
  }

  function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startProfile(async () => {
      const next = await saveProfile(form);
      setProfileState(next);
      if (next.status === "invalid") {
        const first = (["firstName", "lastName", "phone"] as const).find((key) => next.errors[key]);
        if (first) document.getElementById(`account-${first}`)?.focus();
      }
    });
  }

  const errors = profileState.status === "invalid" ? profileState.errors : {};
  const errorLine = (key: keyof typeof errors) => (errors[key] ? hub[errors[key]!] : undefined);

  return (
    <>
      <SiteNav
        locale={locale}
        onLocale={(next) => storePreferences(next, currency)}
        currency={currency}
        onCurrency={(next) => storePreferences(locale, next)}
        labels={{ ...nav, bookings: copy.bookings, account: copy.account, signOut: copy.signOut, profile: hub.profile, preferences: hub.preferences, accountMenu: hub.menuLabel }}
        links={pageLinks(locale, nav)}
        loginHref="/login"
        markCurrent={false}
        account={account}
      />
      <main id="content" className="mx-auto box-border grid w-full max-w-column gap-6 px-4 py-8 md:px-8 lg:px-16">
        <h1 className="m-0 font-display text-display tracking-display text-teal">{copy.account}</h1>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="grid gap-6 lg:w-70 lg:shrink-0">
            <nav aria-label={hub.menuLabel} className="grid border border-line bg-surface py-2">
              <span className="px-4 pb-1 pt-3 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{hub.personal}</span>
              <a className="flex min-h-control items-center px-4 text-label text-ink no-underline hover:bg-ivory" href="#profile">{hub.profile}</a>
              <span className="px-4 pb-1 pt-3 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{hub.settings}</span>
              <a className="flex min-h-control items-center px-4 text-label text-ink no-underline hover:bg-ivory" href="#preferences">{hub.preferences}</a>
              <a className="flex min-h-control items-center px-4 text-label text-ink no-underline hover:bg-ivory" href="#security">{hub.signInSecurity}</a>
            </nav>
            <section className={CARD} aria-labelledby="help-title">
              <h2 id="help-title" className={CARD_TITLE}>{hub.needHelp}</h2>
              <p className="m-0 text-label text-ink">{hub.needHelpLine}</p>
              <a href="https://wa.me/971563883302" aria-label="WhatsApp" className="inline-flex min-h-control w-max items-center gap-3 bg-whatsapp px-4 text-label text-ink no-underline" target="_blank" rel="noopener noreferrer">
                <bdi>WhatsApp</bdi>
                <bdi className="text-caption">wa.me/971563883302</bdi>
              </a>
              <bdi className="text-label text-ink">inquiries@almarprivatejourney.com</bdi>
            </section>
          </div>

          <div className="grid min-w-0 flex-1 gap-6">
            <h2 className="m-0 border-t-2 border-gold pt-6 font-display text-heading text-teal">{hub.personal}</h2>
            <form id="profile" className={CARD} onSubmit={onSaveProfile} noValidate aria-labelledby="profile-title">
              <h3 id="profile-title" className={CARD_TITLE}>{hub.profile}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="account-firstName" name="firstName" label={hub.firstName} required autoComplete="given-name" value={names.firstName} onChange={(event) => setNames({ ...names, firstName: event.target.value })} error={errorLine("firstName")} />
                <Field id="account-lastName" name="lastName" label={hub.lastName} required autoComplete="family-name" value={names.lastName} onChange={(event) => setNames({ ...names, lastName: event.target.value })} error={errorLine("lastName")} />
                <Field id="account-phone" name="phone" label={hub.phoneOptional} type="tel" dir="ltr" autoComplete="tel" value={names.phone} onChange={(event) => setNames({ ...names, phone: event.target.value })} error={errorLine("phone")} />
                <div className="grid content-start gap-2">
                  <span className="text-label text-ink">{copy.email}</span>
                  <bdi className="flex min-h-control items-center text-body text-ink">{profile.email}</bdi>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" busy={savingProfile}>{hub.save}</Button>
                <span className="text-label text-ink" role="status">
                  {profileState.status === "saved" ? hub.saved : profileState.status === "failed" ? hub.saveFailed : ""}
                </span>
              </div>
            </form>

            <h2 className="m-0 border-t-2 border-gold pt-6 font-display text-heading text-teal">{hub.settings}</h2>
            <div className="grid items-start gap-6 md:grid-cols-2">
              <section id="preferences" className={CARD} aria-labelledby="preferences-title">
                <h3 id="preferences-title" className={CARD_TITLE}>{hub.preferences}</h3>
                <div className="grid gap-2">
                  <label className="text-label text-ink" htmlFor="account-language">{copy.language}</label>
                  <LocaleSelect id="account-language" kind="language" value={locale} copy={localeCopy} onChange={(next) => storePreferences(next as DocumentLocale, currency)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-label text-ink" htmlFor="account-currency">{hub.currency}</label>
                  <LocaleSelect id="account-currency" kind="currency" value={currency} dir={locale === "ar" ? "rtl" : "ltr"} copy={localeCopy} onChange={(next) => storePreferences(locale, next as Currency)} />
                </div>
                <span className="text-label text-ink" role="status">
                  {prefState.status === "saved" ? hub.saved : prefState.status === "failed" ? hub.saveFailed : ""}
                </span>
              </section>
              <section id="security" className={CARD} aria-labelledby="security-title">
                <h3 id="security-title" className={CARD_TITLE}>{hub.signInSecurity}</h3>
                <p className="m-0 grid text-label text-ink">
                  <span className="text-muted">{hub.signedInAs}</span>
                  <bdi>{profile.email}</bdi>
                </p>
                <p className="m-0 text-label text-muted">{hub.oneTimeLink}</p>
                <form method="post" action="/auth/sign-out">
                  <Button type="submit" variant="secondary">{copy.signOut}</Button>
                </form>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
