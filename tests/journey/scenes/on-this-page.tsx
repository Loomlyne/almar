"use client";

import { OnThisPage } from "../../../components/ui/on-this-page";
import type { Scenes } from "../scene-types";

const ITEMS = [
  { id: "section-1", text: "[Section title one]" },
  { id: "section-2", text: "[Section title two]" },
  { id: "section-3", text: "[Section title three]" },
  { id: "section-4", text: "[Section title four]" },
];

export const scenes: Scenes = {
  four: () => (
    <div data-testid="harness-otp" className="mx-auto w-full max-w-column p-4">
      <OnThisPage label="[On this page]" items={ITEMS} />
      {ITEMS.map((item) => (
        <h2 key={item.id} id={item.id} className="m-0 mt-8 scroll-mt-rail-offset font-display text-heading text-teal" style={{ marginBottom: "70vh" }}>
          {item.text}
        </h2>
      ))}
    </div>
  ),
  one: () => (
    <div data-testid="harness-otp" className="p-4">
      <OnThisPage label="[On this page]" items={ITEMS.slice(0, 1)} />
    </div>
  ),
  none: () => (
    <div data-testid="harness-otp" className="p-4">
      <OnThisPage label="[On this page]" items={[]} />
    </div>
  ),
};
