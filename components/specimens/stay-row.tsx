"use client";

import { Button } from "../ui/button";
import { formatAmount } from "../../lib/format";
import monogram from "../../brand/Logo Monogram/Curves_black.svg";

const ALT = "Sample stay in Cartagena";

function Mark() {
  return (
    <img
      className="card-monogram"
      alt=""
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}`}
    />
  );
}

export function StayRow() {
  return (
    <div className="stay-list">
      <article className="stay-row is-selected">
        <img className="stay-photo" alt={ALT} src="/assets/img/caedcb84dd0d35bb.webp" />
        <div>
          <h3 className="stay-name">Casa San Diego</h3>
          <p className="amount">{formatAmount("AED", 1050)}</p>
          <Button variant="secondary">Choose a stay</Button>
        </div>
      </article>
      <article className="stay-row is-booked">
        <img className="stay-photo" alt={ALT} src="/assets/img/caedcb84dd0d35bb.webp" />
        <div>
          <h3 className="stay-name">A long stay name that wraps onto a second line before it ends</h3>
          <p>These dates are booked.</p>
          <Button variant="ghost" disabled>
            Choose a stay
          </Button>
        </div>
      </article>
      <article className="stay-row">
        <div className="stay-missing">
          <Mark />
        </div>
        <div>
          <h3 className="stay-name">Missing photo</h3>
          <p className="amount">{formatAmount("AED", 0)}</p>
        </div>
      </article>
      <p>Stay card skeleton</p>
      <div className="skeleton-row" aria-hidden="true">
        <div className="card-pulse" />
      </div>
      <p>This stay does not count infants.</p>
    </div>
  );
}

export function EmptyStays() {
  return (
    <div>
      <h3>No stays for these dates</h3>
      <Button variant="secondary">Change dates</Button>
    </div>
  );
}
