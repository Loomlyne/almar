"use client";

import { Checkbox } from "../ui/checkbox";
import { LockIcon } from "../icons/icons";
import { formatAmount } from "../../lib/format";

export function AddOnRow() {
  return (
    <div className="addon-list">
      <article className="addon is-on">
        <img className="addon-photo" alt="" src="/assets/img/caedcb84dd0d35bb.webp" />
        <h3>Airport meet</h3>
        <p>Included</p>
        <LockIcon size={16} />
        <Checkbox label="Airport meet" defaultChecked disabled />
      </article>
      <article className="addon">
        <img className="addon-photo" alt="" src="/assets/img/caedcb84dd0d35bb.webp" />
        <h3>Home pickup</h3>
        <p className="amount">{formatAmount("AED", 180)}</p>
        <Checkbox label="Home pickup" />
      </article>
      <p>Add-on skeleton</p>
      <div className="skeleton-row" aria-hidden="true">
        <div className="card-pulse" />
      </div>
    </div>
  );
}
