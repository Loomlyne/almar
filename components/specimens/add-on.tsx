"use client";

import { Checkbox } from "../ui/checkbox";
import { LockIcon } from "../icons/icons";
import { formatAmount } from "../../lib/format";

const PHOTO = "/assets/img/caedcb84dd0d35bb.webp";

function AddonPhoto() {
  return (
    <img
      className="addon-photo"
      alt=""
      width={72}
      height={72}
      src={PHOTO}
    />
  );
}

export function AddOnRow() {
  return (
    <div className="addon-list">
      <div className="addon-choices">
        <article className="addon is-on">
          <AddonPhoto />
          <div className="addon-main">
            <h3 className="addon-title">Airport meet</h3>
            <p className="addon-price">Included</p>
            <div className="addon-choice">
              <LockIcon className="addon-lock" size={16} />
              <Checkbox label="Airport meet" defaultChecked disabled />
            </div>
          </div>
        </article>
        <article className="addon">
          <AddonPhoto />
          <div className="addon-main">
            <h3 className="addon-title">Home pickup</h3>
            <p className="addon-price amount">{formatAmount("AED", 180)}</p>
            <div className="addon-choice">
              <Checkbox label="Home pickup" />
            </div>
          </div>
        </article>
      </div>
      <p className="addon-skeleton-label">Add-on skeleton</p>
      <div className="addon-skeleton skeleton-row" aria-hidden="true">
        <div className="card-pulse" />
      </div>
    </div>
  );
}
