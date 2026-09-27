"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { formatAmount } from "../../lib/format";

const LINES = [
  ["Nights", 1000],
  ["Add-ons", 0],
  ["Coupon", 0],
  ["Subtotal", 1000],
  ["VAT", 50],
] as const;

export function PriceBlock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="price-block">
      <button type="button" className="breakdown-toggle" onClick={() => setOpen((value) => !value)}>
        Show breakdown
      </button>
      {open ? (
        <dl className="price-lines">
          {LINES.map(([label, amount]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="amount">{formatAmount("AED", amount)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="price-total">
        <span>Total</span>
        <span className="amount">{formatAmount("AED", 1050)}</span>
      </p>
      <p>
        Temporarily held <span className="amount">{formatAmount("AED", 500)}</span>
      </p>
      <p className="hold-clock">29:59</p>
      <div className="pay-cards">
        <Checkbox name="pay-mode" label={`Deposit ${formatAmount("AED", 315)}`} defaultChecked />
        <Checkbox name="pay-mode" label={`Pay in full ${formatAmount("AED", 1050)}`} />
      </div>
      <p>Price skeleton lines</p>
      <div className="skeleton-row" aria-hidden="true">
        <div className="card-pulse" />
      </div>
      <div className="phone-bar">
        <span className="amount">{formatAmount("AED", 1050)}</span>
        <Button variant="primary">Continue</Button>
      </div>
    </div>
  );
}

export function ReviewFrame() {
  return (
    <div className="review-frame">
      <h3>Stay</h3>
      <Button variant="ghost">Edit</Button>
      <Button variant="primary">Pay</Button>
    </div>
  );
}

export function PaymentFailed() {
  return (
    <div className="review-frame">
      <p>The payment did not go through.</p>
      <p>Visa · 4242</p>
      <Button variant="primary">Try again</Button>
    </div>
  );
}
