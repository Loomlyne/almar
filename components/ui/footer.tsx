"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import polyBlack from "../../brand/Logo Typography/Poly_Black.svg";
import { Button } from "./button";
import { Divider } from "./divider";
import { ToastProvider, useToast } from "./toast";
import { postPreferences } from "../site/account-sync";
import { isPlainEmail } from "../../lib/email-address";
import { isDocumentLocale } from "../../lib/set-document-locale";

const LINK =
  "inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4";
const HEAD = "mb-2 block font-body text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal";
// The light footer: ink on ivory, the gold underline on hover as the nav's links have it.
const LIGHT_LINK =
  "inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ink no-underline decoration-gold decoration-1 underline-offset-4 hover:underline";
const LIGHT_HEAD = "mb-2 block font-body text-caption uppercase tracking-kicker text-ink ar:normal-case ar:tracking-normal";

/** `external`: a link the owner set to another site (06-02 Navigation): a new tab, with the screen-reader suffix. */
export type FooterLink = { label: string; href: string; external?: true };

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

export type FooterLanguageLink = {
  label: string;
  href: string;
  /** Language code of the target page and of the label, for example "ar". */
  lang: string;
  current: boolean;
};

export type FooterCopy = {
  /** Heading of the pages column. */
  pages: string;
  /** Heading of the contact column. */
  contact: string;
  /** Label of the Instagram link. */
  instagram: string;
  /** Screen-reader suffix for a link that opens in a new tab, for example "(opens in a new tab)". */
  newTab: string;
  /** Accessible name of the language row. */
  language: string;
  /** The copyright line. */
  copyright: string;
  /** The wordmark's alt text (light footer). Defaults to "ALMAR". */
  brand?: string;
  /** The label before the studio's name (light footer), for example "Made by". */
  madeBy?: string;
  /** Needed only when `newsletter` is true. */
  newsletter?: FooterNewsletterCopy;
  /** Accessible name of the legal row. Needed only with `legalLinks` or `cookieSettings`. */
  legal?: string;
  /** The label of the Cookie settings link (the frame hands it to `cookieSettings`). */
  cookieSettings?: string;
};

/** The newsletter column's strings (lib/copy/site-footer.ts SiteFooterNewsletterCopy is one). */
export type FooterNewsletterCopy = {
  title: string;
  /** The line under the title. */
  description?: string;
  /** The email box's label. */
  email: string;
  /** The submit button. */
  subscribe: string;
  /** The submit button while the handler runs. */
  sending: string;
  /** The line for an address that is not one; the handler is not called. */
  invalid: string;
  /** The toast once the handler resolved. */
  success: string;
  /** The line when the handler rejected. */
  failed: string;
  /** The toast's close button. */
  dismiss: string;
};

/** The newsletter handler: the trimmed address and the honeypot values read from the form by name. */
export type FooterSubscribe = (email: string, honeypots: Record<string, string>) => void | Promise<void>;

/** The studio credit of the light footer: the label, then a link named by the studio. */
export type FooterMadeBy = { label: string; name: string; href: string };

export type FooterContact = { email: string; phone: string; instagram: string };

/** The owner's contact details, verbatim. Used when a page passes none. */
const OWNER_CONTACT: FooterContact = {
  email: "inquiries@almarprivatejourney.com",
  phone: "+971 56 388 3302",
  instagram: "https://www.instagram.com/almarprivatejourney/",
};

// Beyond the browser's own type="email" check: the handler's own rule (lib/email-address.ts isPlainEmail), so an
// address the server would refuse is the invalid line here, not the failed one.

function Newsletter({
  copy,
  onSubscribe,
  honeypotFields,
  light,
}: {
  copy: FooterNewsletterCopy;
  onSubscribe: FooterSubscribe;
  honeypotFields: readonly string[];
  light: boolean;
}) {
  const { push } = useToast();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem("email");
    const email = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (!(input instanceof HTMLInputElement) || !email || !input.checkValidity() || !isPlainEmail(email)) {
      setError(copy.invalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setError("");
    const honeypots: Record<string, string> = {};
    for (const name of honeypotFields) {
      const field = form.elements.namedItem(name);
      honeypots[name] = field instanceof HTMLInputElement ? field.value : "";
    }
    sending.current = true;
    setBusy(true);
    let added = false;
    try {
      await onSubscribe(email, honeypots);
      added = true;
    } catch {
      // Fixed copy only: whatever the handler threw never reaches the page.
      setError(copy.failed);
    } finally {
      sending.current = false;
      setBusy(false);
    }
    if (added) {
      form.reset();
      push(copy.success, "success");
    }
    // The busy button was disabled, which drops focus to the page: give it back to the button.
    if (!document.activeElement || document.activeElement === document.body) {
      window.setTimeout(() => form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus(), 0);
    }
  }

  const head = light ? LIGHT_HEAD : HEAD;
  const text = light ? "text-ink" : "text-ivory";
  return (
    <form
      className="grid max-w-md min-w-0 content-start gap-2"
      aria-labelledby="footer-newsletter-title"
      noValidate
      onSubmit={onSubmit}
      data-footer-newsletter=""
    >
      <p className={head} id="footer-newsletter-title">
        {copy.title}
      </p>
      {copy.description ? <p className={`m-0 font-body text-label ${text}`}>{copy.description}</p> : null}
      <label className={`block font-body text-label ${text}`} htmlFor="footer-newsletter-email">
        {copy.email}
      </label>
      <input
        id="footer-newsletter-email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "footer-newsletter-error" : undefined}
        defaultValue=""
        className={
          light
            ? "block h-control w-full min-w-0 appearance-none rounded-none border border-ink bg-surface px-4 font-body text-body text-ink aria-invalid:border-error"
            : "block h-control w-full min-w-0 appearance-none rounded-none border border-ivory bg-surface px-4 font-body text-body text-ink placeholder:text-muted focus-visible:outline-ivory"
        }
      />
      {error ? (
        <p id="footer-newsletter-error" role="alert" className={light ? "m-0 text-label field-error text-error" : "m-0 font-body text-label text-ivory"}>
          {error}
        </p>
      ) : null}
      {honeypotFields.length > 0 ? (
        // The spam traps (SITE-12): real inputs a bot fills, out of sight, out of the accessibility tree and the Tab order.
        // The same attributes as the contact form's traps (components/pages/contact/inquiry-form.tsx): browsers ignore
        // an "off" autocomplete, so "one-time-code" plus the password managers' own opt-outs keep autofill out of them.
        <div aria-hidden="true" className="sr-only">
          {honeypotFields.map((name) => (
            <input
              key={name}
              type="text"
              name={name}
              tabIndex={-1}
              autoComplete="one-time-code"
              defaultValue=""
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
            />
          ))}
        </div>
      ) : null}
      <div className="pt-2">
        {light ? (
          <Button variant="outline" type="submit" busy={busy}>
            {busy ? copy.sending : copy.subscribe}
          </Button>
        ) : (
          <Button variant="primary" type="submit" className="border-ivory" busy={busy}>
            {busy ? copy.sending : copy.subscribe}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * The newsletter column, rendered only once the footer has mounted in the browser: the served HTML and a page with
 * JavaScript off carry no form, no email box and no trap (a form that cannot send is not shown). It brings its own
 * ToastProvider, so no page needs one and the success toast's close button speaks the page's language.
 */
function NewsletterColumn(props: { copy: FooterNewsletterCopy; onSubscribe: FooterSubscribe; honeypotFields: readonly string[]; light: boolean; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const { className, ...rest } = props;
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <ToastProvider dismissLabel={props.copy.dismiss}>
        <Newsletter {...rest} />
      </ToastProvider>
    </div>
  );
}

/**
 * A footer language link, like the header picker (02-05b), offers the pick to her account before the browser follows the
 * link (fire-and-forget; the server saves it only when she is signed in). The current language is no change, so it
 * sends nothing. The link itself stays a plain link: with JavaScript off it still works, it just saves nothing.
 */
function offerLanguage(item: FooterLanguageLink) {
  if (item.current || !isDocumentLocale(item.lang)) return;
  postPreferences({ locale: item.lang });
}

/** The legal row (plan 06-04, pictures signed 2026-10-30): under Pages and Contact, the published titles then Cookie settings. */
function LegalRow({
  name,
  links,
  cookieSettings,
  rowClass,
  linkClass,
}: {
  name?: string;
  links: FooterLink[];
  cookieSettings?: { label: string; onOpen: () => void };
  rowClass: string;
  linkClass: string;
}) {
  return (
    <nav aria-label={name} className={`mt-8 flex flex-wrap items-center gap-x-6 border-t pt-2 ${rowClass}`}>
      {links.map((link) => (
        <a key={link.href} className={linkClass} href={link.href}>
          {link.label}
        </a>
      ))}
      {cookieSettings ? (
        <button type="button" className={`${linkClass} cursor-pointer border-0 bg-transparent p-0`} onClick={cookieSettings.onOpen}>
          {cookieSettings.label}
        </button>
      ) : null}
    </nav>
  );
}

/**
 * The public footer. Every string arrives through `copy`; the contact details default to the
 * owner's. There is no newsletter form unless `newsletter` is true AND an `onSubscribe` handler is
 * given: a form that does nothing is a fake control. The form mounts only in the browser (none with
 * JavaScript off), sends the honeypots named in `honeypotFields`, and tells the visitor what the
 * handler did: the success toast when it resolves, the failed line when it rejects. The "List with us"
 * slot renders nothing until it has an href. The language row is plain links that work with JavaScript off. `legalLinks` and
 * `cookieSettings` add the legal row; without them the footer is what it always was.
 */
export function SiteFooter({
  copy,
  links,
  contact = OWNER_CONTACT,
  languageLinks,
  newsletter = false,
  onSubscribe,
  honeypotFields = [],
  listWithUs,
  tone = "teal",
  madeBy,
  legalLinks = [],
  cookieSettings,
}: {
  copy: FooterCopy;
  links: FooterLink[];
  contact?: FooterContact;
  languageLinks?: FooterLanguageLink[];
  newsletter?: boolean;
  onSubscribe?: FooterSubscribe;
  /** The honeypot input names the handler checks (lib/newsletter.ts NEWSLETTER_HONEYPOT_FIELDS); none by default. */
  honeypotFields?: readonly string[];
  /** Held until the page exists: with no href nothing is rendered. */
  listWithUs?: { label: string; href?: string };
  /**
   * "teal" (the default) is the footer as it always was. "light" is the public site's footer (job 11): ivory ground, the
   * divider, the wordmark, pages and contact (and, plan 27, the newsletter as the end column), then the language links,
   * the copyright and the studio credit. It has no "List with us" slot.
   */
  tone?: "teal" | "light";
  /** The studio credit, light tone only. */
  madeBy?: FooterMadeBy;
  /** The legal pages published in all three languages (plan 06-04). */
  legalLinks?: FooterLink[];
  /** Cookie settings, a button that opens the settings sheet (plan 06-04): only with published banner words and a token. */
  cookieSettings?: { label: string; onOpen: () => void };
}) {
  const [emailName, emailHost] = contact.email.split("@");
  const showNewsletter = newsletter && Boolean(onSubscribe) && Boolean(copy.newsletter);
  const listHref = listWithUs?.href;
  const hasLegal = legalLinks.length > 0 || Boolean(cookieSettings);

  if (tone === "light") {
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(polyBlack)}`;
    return (
      <footer role="contentinfo" className="@container w-full min-w-0 bg-ivory px-8 pb-12 text-ink">
        <Divider className="mb-12" />
        <img className="mx-auto block h-12 w-auto" src={src} alt={copy.brand ?? "ALMAR"} width={200} height={48} />
        <div
          className={`mt-8 grid min-w-0 grid-cols-1 items-start gap-8 ${showNewsletter ? "@2xl:grid-cols-3 @6xl:grid-cols-4" : "@2xl:grid-cols-2"}`}
        >
          <nav className="grid content-start justify-items-start" aria-label={copy.pages}>
            <p className={LIGHT_HEAD}>{copy.pages}</p>
            {links.map((link, index) => (
              <a key={`${index}-${link.href}`} className={LIGHT_LINK} href={link.href} {...(link.external ? NEW_TAB : {})}>
                {link.label}
                {link.external ? <span className="sr-only"> {copy.newTab}</span> : null}
              </a>
            ))}
          </nav>
          <address className="grid content-start justify-items-start not-italic">
            <p className={LIGHT_HEAD}>{copy.contact}</p>
            <a className={LIGHT_LINK} dir="ltr" href={`mailto:${contact.email}`}>
              {emailName}@<wbr />
              {emailHost}
            </a>
            <a
              className={`${LIGHT_LINK} whitespace-nowrap tabular-nums`}
              dir="ltr"
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
            >
              {contact.phone}
            </a>
            <a className={LIGHT_LINK} href={contact.instagram} target="_blank" rel="noopener noreferrer">
              {copy.instagram}
              <span className="sr-only"> {copy.newTab}</span>
            </a>
          </address>
          {showNewsletter ? (
            // The end column (design 12.1 row 8): Pages, Contact, Newsletter from @2xl; an empty third column from @6xl.
            <NewsletterColumn
              copy={copy.newsletter!}
              onSubscribe={onSubscribe!}
              honeypotFields={honeypotFields}
              light
              className="@6xl:col-start-4"
            />
          ) : null}
        </div>
        {hasLegal ? <LegalRow name={copy.legal} links={legalLinks} cookieSettings={cookieSettings} rowClass="border-teal-tint" linkClass={LIGHT_LINK} /> : null}
        <div className={hasLegal ? "mt-2 grid items-center gap-4 border-t border-teal-tint pt-4 @2xl:grid-cols-3" : "mt-8 grid items-center gap-4 border-t border-teal-tint pt-6 @2xl:grid-cols-3"}>
          {languageLinks && languageLinks.length > 0 ? (
            <nav aria-label={copy.language} className="flex flex-wrap items-center gap-x-2">
              {languageLinks.map((item, index) => (
                <Fragment key={item.lang}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-ink">
                      ·
                    </span>
                  ) : null}
                  <a
                    className={`${LIGHT_LINK} ${item.current ? "underline decoration-2" : ""}`}
                    href={item.href}
                    hrefLang={item.lang}
                    lang={item.lang}
                    aria-current={item.current ? "true" : undefined}
                    onClick={() => offerLanguage(item)}
                  >
                    {item.label}
                  </a>
                </Fragment>
              ))}
            </nav>
          ) : (
            <span />
          )}
          <p className="m-0 font-body text-label text-ink @2xl:justify-self-center @2xl:text-center">{copy.copyright}</p>
          {madeBy ? (
            <p className="m-0 flex flex-wrap items-center gap-x-2 font-body text-label text-ink @2xl:justify-self-end">
              <span>{madeBy.label}</span>
              <a className={LIGHT_LINK} href={madeBy.href} target="_blank" rel="noopener noreferrer">
                {madeBy.name}
                <span className="sr-only"> {copy.newTab}</span>
              </a>
            </p>
          ) : (
            <span />
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer role="contentinfo" className="@container w-full min-w-0 border-t border-ivory bg-teal px-8 py-12 text-ivory">
      <div className="mb-8 border-b border-ivory pb-6">
        <p className="m-0 whitespace-nowrap font-display text-heading tracking-kicker text-ivory">ALMAR</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 @2xl:grid-cols-3">
        <nav className="grid content-start justify-items-start" aria-label={copy.pages}>
          <p className={HEAD}>{copy.pages}</p>
          {links.map((link, index) => (
            <a key={`${index}-${link.href}`} className={LINK} href={link.href} {...(link.external ? NEW_TAB : {})}>
              {link.label}
              {link.external ? <span className="sr-only"> {copy.newTab}</span> : null}
            </a>
          ))}
          {listWithUs && listHref ? (
            <a className={LINK} href={listHref}>
              {listWithUs.label}
            </a>
          ) : null}
        </nav>
        <address className="grid content-start justify-items-start not-italic">
          <p className={HEAD}>{copy.contact}</p>
          <a className={LINK} dir="ltr" href={`mailto:${contact.email}`}>
            {emailName}@<wbr />
            {emailHost}
          </a>
          <a className={`${LINK} whitespace-nowrap tabular-nums`} dir="ltr" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
            {contact.phone}
          </a>
          <a className={LINK} href={contact.instagram} target="_blank" rel="noopener noreferrer">
            {copy.instagram}
            <span className="sr-only"> {copy.newTab}</span>
          </a>
        </address>
        {showNewsletter ? (
          <NewsletterColumn copy={copy.newsletter!} onSubscribe={onSubscribe!} honeypotFields={honeypotFields} light={false} />
        ) : null}
      </div>
      {hasLegal ? <LegalRow name={copy.legal} links={legalLinks} cookieSettings={cookieSettings} rowClass="border-ivory" linkClass={LINK} /> : null}
      <div className={hasLegal ? "flex flex-wrap items-center justify-between gap-4 pt-2" : "mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ivory pt-6"}>
        {languageLinks && languageLinks.length > 0 ? (
          <nav aria-label={copy.language} className="flex flex-wrap items-center gap-x-2">
            {languageLinks.map((item, index) => (
              <Fragment key={item.lang}>
                {index > 0 ? (
                  <span aria-hidden="true" className="text-ivory">
                    ·
                  </span>
                ) : null}
                <a
                  className={`${LINK} ${item.current ? "decoration-2" : ""}`}
                  href={item.href}
                  hrefLang={item.lang}
                  lang={item.lang}
                  aria-current={item.current ? "true" : undefined}
                  onClick={() => offerLanguage(item)}
                >
                  {item.label}
                </a>
              </Fragment>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <p className="m-0 font-body text-label text-ivory">{copy.copyright}</p>
      </div>
    </footer>
  );
}
