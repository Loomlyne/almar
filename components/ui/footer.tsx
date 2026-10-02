"use client";

import { Fragment, useState, type FormEvent } from "react";
import { Button } from "./button";
import { useToast } from "./toast";

const LINK =
  "inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4";
const HEAD = "mb-2 block font-body text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal";

export type FooterLink = { label: string; href: string };

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
  /** Needed only when `newsletter` is true. */
  newsletter?: { title: string; email: string; subscribe: string; invalid: string; success: string };
};

export type FooterContact = { email: string; phone: string; instagram: string };

/** The owner's contact details, verbatim. Used when a page passes none. */
const OWNER_CONTACT: FooterContact = {
  email: "inquiries@almarprivatejourney.com",
  phone: "+971 56 388 3302",
  instagram: "https://www.instagram.com/almarprivatejourney/",
};

function Newsletter({
  copy,
  onSubscribe,
}: {
  copy: NonNullable<FooterCopy["newsletter"]>;
  onSubscribe: (email: string) => void | Promise<void>;
}) {
  const { push } = useToast();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("email");
    const email = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (!(input instanceof HTMLInputElement) || !email || !input.checkValidity()) {
      setError(copy.invalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setError("");
    await onSubscribe(email);
    push(copy.success);
  }

  return (
    <form
      className="grid max-w-md content-start gap-2"
      aria-labelledby="footer-newsletter-title"
      noValidate
      onSubmit={onSubmit}
    >
      <p className={HEAD} id="footer-newsletter-title">
        {copy.title}
      </p>
      <div className="grid w-full min-w-0 gap-2">
        <label className="block whitespace-nowrap font-body text-label text-ivory" htmlFor="footer-newsletter-email">
          {copy.email}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="footer-newsletter-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "footer-newsletter-error" : undefined}
            defaultValue=""
            className="block h-control min-w-0 flex-auto appearance-none rounded-none border border-ivory bg-surface px-4 font-body text-body text-ink placeholder:text-muted focus-visible:outline-ivory"
          />
          <Button variant="primary" type="submit" className="border-ivory">
            {copy.subscribe}
          </Button>
        </div>
        {error ? (
          <p id="footer-newsletter-error" className="m-0 font-body text-label text-ivory">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The public footer. Every string arrives through `copy`; the contact details default to the
 * owner's. There is no newsletter form unless `newsletter` is true AND an `onSubscribe` handler is
 * given: a form that does nothing is a fake control. The "List with us" slot renders nothing until
 * it has an href. The language row is plain links that work with JavaScript off.
 */
export function SiteFooter({
  copy,
  links,
  contact = OWNER_CONTACT,
  languageLinks,
  newsletter = false,
  onSubscribe,
  listWithUs,
}: {
  copy: FooterCopy;
  links: FooterLink[];
  contact?: FooterContact;
  languageLinks?: FooterLanguageLink[];
  newsletter?: boolean;
  onSubscribe?: (email: string) => void | Promise<void>;
  /** Held until the page exists: with no href nothing is rendered. */
  listWithUs?: { label: string; href?: string };
}) {
  const [emailName, emailHost] = contact.email.split("@");
  const showNewsletter = newsletter && Boolean(onSubscribe) && Boolean(copy.newsletter);
  const listHref = listWithUs?.href;

  return (
    <footer role="contentinfo" className="@container w-full min-w-0 border-t border-ivory bg-teal px-8 py-12 text-ivory">
      <div className="mb-8 border-b border-ivory pb-6">
        <p className="m-0 whitespace-nowrap font-display text-heading tracking-kicker text-ivory">ALMAR</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 @2xl:grid-cols-3">
        <nav className="grid content-start justify-items-start" aria-label={copy.pages}>
          <p className={HEAD}>{copy.pages}</p>
          {links.map((link) => (
            <a key={link.href} className={LINK} href={link.href}>
              {link.label}
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
          <a className={LINK} href={`mailto:${contact.email}`}>
            {emailName}@<wbr />
            {emailHost}
          </a>
          <a className={`${LINK} whitespace-nowrap tabular-nums`} href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
            {contact.phone}
          </a>
          <a className={LINK} href={contact.instagram} target="_blank" rel="noopener noreferrer">
            {copy.instagram}
            <span className="sr-only"> {copy.newTab}</span>
          </a>
        </address>
        {showNewsletter ? <Newsletter copy={copy.newsletter!} onSubscribe={onSubscribe!} /> : null}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ivory pt-6">
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
