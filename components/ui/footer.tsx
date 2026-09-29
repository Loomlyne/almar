"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./button";
import { useToast } from "./toast";

const EMAIL_ERROR = "Enter an email as name@example.com.";

export function SiteFooter() {
  const { push } = useToast();
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("email");
    const email = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (!(input instanceof HTMLInputElement) || !email || !input.checkValidity()) {
      setError(EMAIL_ERROR);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setError("");
    push("Subscribed. Check your inbox.");
  }

  return (
    <footer role="contentinfo" className="@container w-full min-w-0 border-t border-ivory bg-teal px-8 py-12 text-ivory">
      <div className="mb-8 border-b border-ivory pb-6">
        <p className="m-0 whitespace-nowrap font-display text-heading tracking-kicker text-ivory">ALMAR</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 @2xl:grid-cols-3">
        <nav className="grid content-start justify-items-start" aria-label="Pages">
          <p className="mb-2 block font-body text-caption uppercase tracking-kicker text-ivory">Pages</p>
          <a className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4" href="#destinations">Destinations</a>
          <a className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4" href="#experiences">Experiences</a>
          <a className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4" href="#list-with-us">List with us</a>
        </nav>
        <address className="grid content-start justify-items-start not-italic">
          <p className="mb-2 block font-body text-caption uppercase tracking-kicker text-ivory">Contact</p>
          <a className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4" href="mailto:inquiries@almarprivatejourney.com">
            inquiries@<wbr />almarprivatejourney.com
          </a>
          <a className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4 whitespace-nowrap tabular-nums" href="tel:+971563883302">+971 56 388 3302</a>
          <a
            className="inline-flex min-h-control max-w-full items-center break-words font-body text-body text-ivory underline decoration-1 underline-offset-4"
            href="https://www.instagram.com/almarprivatejourney/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </address>
        <form
          className="grid max-w-md content-start gap-2"
          aria-labelledby="footer-newsletter-title"
          noValidate
          onSubmit={onSubmit}
        >
          <p className="mb-2 block font-body text-caption uppercase tracking-kicker text-ivory" id="footer-newsletter-title">
            Newsletter
          </p>
          <div className="grid w-full min-w-0 gap-2">
            <label className="block whitespace-nowrap font-body text-label text-ivory" htmlFor="footer-newsletter-email">
              Email
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="footer-newsletter-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "footer-newsletter-error" : undefined}
                defaultValue=""
                className="block h-control min-w-0 flex-auto appearance-none rounded-none border border-ivory bg-surface px-4 font-body text-body text-ink placeholder:text-muted focus-visible:outline-ivory"
              />
              <Button variant="primary" type="submit" className="border-ivory">
                Subscribe
              </Button>
            </div>
            {error ? (
              <p id="footer-newsletter-error" className="m-0 font-body text-label text-ivory">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </footer>
  );
}
