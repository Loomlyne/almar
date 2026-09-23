"use client";

import { useState } from "react";

const ROWS = [
  { key: "adult", label: "Adults", hint: "13+", floor: 1, add: "Add adult", remove: "Remove adult", floorNote: "At least 1 adult" },
  { key: "child", label: "Children", hint: "3–12", floor: 0, add: "Add child", remove: "Remove child", floorNote: "Already 0" },
  { key: "infant", label: "Infants", hint: "0–2", floor: 0, add: "Add infant", remove: "Remove infant", floorNote: "Already 0" },
] as const;

export function GuestSteppers() {
  const [counts, setCounts] = useState({ adult: 1, child: 0, infant: 0 });

  function change(key: "adult" | "child" | "infant", floor: number, delta: number) {
    setCounts((current) => ({
      ...current,
      [key]: Math.max(floor, current[key] + delta),
    }));
  }

  return (
    <div className="steppers">
      {ROWS.map((row) => {
        const value = counts[row.key];
        const atFloor = value <= row.floor;
        return (
          <div key={row.key} className="stepper">
            <div>
              <p className="stepper-label">{row.label}</p>
              <p className="stepper-hint">{row.hint}</p>
            </div>
            <div className="stepper-controls">
              <button
                type="button"
                className="stepper-btn"
                aria-label={row.remove}
                disabled={atFloor}
                onClick={() => change(row.key, row.floor, -1)}
              >
                −
              </button>
              <span className="stepper-count">{value}</span>
              <button
                type="button"
                className="stepper-btn"
                aria-label={row.add}
                onClick={() => change(row.key, row.floor, 1)}
              >
                +
              </button>
            </div>
            {atFloor ? <p className="stepper-floor">{row.floorNote}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
