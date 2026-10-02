"use client";

import { useState } from "react";
import { Select } from "../../../components/ui/select";
import type { Scenes } from "../scene-types";

const OPTIONS = [
  { value: "a", label: "[Option A]", code: "A" },
  { value: "b", label: "[Option B]", code: "B" },
  { value: "c", label: "[Option C]", code: "C" },
];

function Live({ start, locale }: { start: string | null; locale: string }) {
  const [value, setValue] = useState<string | null>(start);
  const [calls, setCalls] = useState(0);
  return (
    <div data-testid="harness-select" className="p-4">
      <Select
        value={value}
        options={OPTIONS}
        label="[Filter]: {name}"
        placeholder="[None]"
        dir={locale === "ar" ? "rtl" : "ltr"}
        onChange={(next) => {
          setValue(next);
          setCalls((n) => n + 1);
        }}
      />
      <output data-testid="select-value">{value ?? "none"}</output>
      <output data-testid="select-calls">{calls}</output>
    </div>
  );
}

export const scenes: Scenes = {
  chosen: ({ locale }) => <Live start="a" locale={locale} />,
  none: ({ locale }) => <Live start={null} locale={locale} />,
};
