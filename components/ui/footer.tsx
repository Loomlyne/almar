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
    <footer className="site-footer" role="contentinfo">
      <div className="footer-mast">
        <p className="wordmark-text">ALMAR</p>
      </div>
      <div className="footer-grid">
        <nav className="footer-nav" aria-label="Pages">
          <p className="footer-kicker">Pages</p>
          <a href="#destinations">Destinations</a>
          <a href="#experiences">Experiences</a>
          <a href="#list-with-us">List with us</a>
        </nav>
        <address className="footer-contact">
          <p className="footer-kicker">Contact</p>
          <a href="mailto:inquiries@almarprivatejourney.com">
            inquiries@<wbr />almarprivatejourney.com
          </a>
          <a href="tel:+971563883302">+971 56 388 3302</a>
          <a
            href="https://www.instagram.com/almarprivatejourney/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
            <span className="footer-new-tab"> (opens in a new tab)</span>
          </a>
        </address>
        <form className="footer-newsletter" aria-labelledby="footer-newsletter-title" noValidate onSubmit={onSubmit}>
          <p className="footer-kicker" id="footer-newsletter-title">
            Newsletter
          </p>
          <div className="footer-email">
            <label className="footer-email-label" htmlFor="footer-newsletter-email">
              Email
            </label>
            <div className="footer-email-controls">
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
              />
              <Button variant="primary" type="submit">
                Subscribe
              </Button>
            </div>
            {error ? (
              <p id="footer-newsletter-error" className="footer-email-error">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </footer>
  );
}
