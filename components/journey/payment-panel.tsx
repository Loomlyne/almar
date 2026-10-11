"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider, CurrencySelectorElement, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import tokens from "../../tokens.json";
import { fill } from "../../lib/journey-format";
import { paymentCopy } from "../../lib/copy/payment";
import { paymentAppearance } from "../../lib/stripe/appearance";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";

// The branded payment form (plan 04-04, PAY-06, PAY-07, B-03, B-07, B-20). Stripe's Payment Element runs inside Stripe's
// own frame on this page (never a Stripe-hosted page); card data never touches our code. Card only, Apple Pay as its
// wallet; Google Pay and Link off; no saved cards. When Stripe offers the guest's own currency a Currency Selector
// appears with a line saying the conversion is Stripe's; the Pay button always reads its amount from Stripe's checkout
// object (Stripe's confirm() refuses a page that does not show that total). The panel is mounted by the Pay step
// (04-06) and the booking page (04-05); the publishable key arrives from an API answer, never from the build (B-19).

export type PaymentPanelProps = {
  clientSecret: string;
  publishableKey: string;
  locale: "en" | "ar" | "es";
  /** Called once Stripe confirmed the payment. The webhook, not this callback, is what marks the booking paid. */
  onPaid: () => void;
  /** Called with Stripe's message when the payment fails or the form cannot load. */
  onError?: (message: string) => void;
  className?: string;
};

// Stripe.js is loaded once per key and language, and only when a panel mounts (the `pure` entry has no side effect on import).
const loaders = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string, locale: PaymentPanelProps["locale"]): Promise<Stripe | null> {
  const id = `${locale}:${publishableKey}`;
  let loading = loaders.get(id);
  if (!loading) {
    loading = loadStripe(publishableKey, { locale });
    loaders.set(id, loading);
  }
  return loading;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-control border border-line bg-ivory motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-control border border-line bg-ivory motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-action w-48 max-w-full border border-line bg-ivory motion-safe:animate-pulse" />
    </div>
  );
}

function PayForm({ locale, onPaid, onError }: Pick<PaymentPanelProps, "locale" | "onPaid" | "onError">) {
  const copy = paymentCopy(locale);
  const state = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (state.type === "loading") return <Skeleton label={copy.loading} />;
  if (state.type === "error") {
    return (
      <p role="alert" className="m-0 border-s-2 border-error ps-3 text-label text-ink">
        {copy.loadError}
      </p>
    );
  }

  const { checkout } = state;
  const total = checkout.total.total.amount;
  const options = checkout.currencyOptions;
  const offersCurrency = Array.isArray(options) && options.length > 0;

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await checkout.confirm({ redirect: "if_required" });
      if (result.type === "error") {
        const text = result.error.message || copy.error.generic;
        setMessage(text);
        onError?.(text);
        return;
      }
      onPaid();
    } catch {
      setMessage(copy.error.generic);
      onError?.(copy.error.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {offersCurrency ? (
        <div className="flex flex-col gap-2">
          <span className="text-label text-muted">{copy.currency.label}</span>
          <CurrencySelectorElement />
          <p className="m-0 text-caption text-muted">{copy.currency.note}</p>
        </div>
      ) : null}
      <PaymentElement options={{ wallets: { applePay: "auto", googlePay: "never", link: "never" } }} />
      <Button size="lg" onClick={pay} busy={busy} className="self-start">
        {busy ? copy.pay.busy : fill(copy.pay.label, { total })}
      </Button>
      {message ? (
        <p role="alert" className="m-0 border-s-2 border-error ps-3 text-label text-ink">
          {message}
        </p>
      ) : null}
      <p className="m-0 text-caption text-muted">{copy.secure}</p>
    </div>
  );
}

export function PaymentPanel({ clientSecret, publishableKey, locale, onPaid, onError, className }: PaymentPanelProps) {
  const copy = paymentCopy(locale);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setStripe(null);
    setFailed(false);
    stripeFor(publishableKey, locale).then(
      (loaded) => {
        if (!live) return;
        if (loaded) setStripe(loaded);
        else setFailed(true);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [publishableKey, locale]);

  useEffect(() => {
    if (failed) onError?.(copy.loadError);
    // onError and copy are deliberately left out: the message is sent once per failure.
  }, [failed]);

  const options = useMemo(
    () => ({ clientSecret, adaptivePricing: { allowed: true }, elementsOptions: { appearance: paymentAppearance(tokens) } }),
    [clientSecret],
  );

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className={cn("flex flex-col gap-4", className)} data-payment-panel>
      {failed ? (
        <p role="alert" className="m-0 border-s-2 border-error ps-3 text-label text-ink">
          {copy.loadError}
        </p>
      ) : stripe ? (
        <CheckoutElementsProvider stripe={stripe} options={options}>
          <PayForm locale={locale} onPaid={onPaid} onError={onError} />
        </CheckoutElementsProvider>
      ) : (
        <Skeleton label={copy.loading} />
      )}
    </div>
  );
}
