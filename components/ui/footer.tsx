"use client";

import { Button } from "./button";
import { useToast } from "./toast";

export function SiteFooter() {
  const { push } = useToast();

  return (
    <footer className="site-footer" role="contentinfo">
      <p className="wordmark-text">ALMAR</p>
      <a href="mailto:inquiries@almarprivatejourney.com">inquiries@almarprivatejourney.com</a>
      <a href="tel:+971563883302">+971 56 388 3302</a>
      <a href="https://instagram.com/almarprivatejourney/">Instagram</a>
      <a href="#list-with-us">List with us</a>
      <div className="newsletter-error">
        <label>
          Newsletter
          <input aria-invalid="true" aria-describedby="newsletter-error" defaultValue="" />
        </label>
        <p id="newsletter-error" className="field-error">
          Enter an email as name@example.com.
        </p>
      </div>
      <div className="newsletter-row">
        <label>
          Email
          <input placeholder="name@example.com" defaultValue="" />
        </label>
        <Button
          variant="secondary"
          onClick={() => push("Subscribed. Check your inbox.")}
        >
          Subscribe
        </Button>
      </div>
    </footer>
  );
}
