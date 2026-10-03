"use client";

import { useState } from "react";
import { ChipGroup, type ChipGroupOption } from "../../../components/ui/chip-group";
import type { Scenes } from "../scene-types";

const THREE: ChipGroupOption[] = [
  { value: "all", label: "[All]" },
  { value: "one", label: "[One]" },
  { value: "two", label: "[Two]" },
];

const FIVE: ChipGroupOption[] = [
  { value: "any", label: "[Any]" },
  { value: "a", label: "[A longer option]" },
  { value: "b", label: "[Another long option]" },
  { value: "c", label: "[Third long option]" },
  { value: "d", label: "[Fourth long option]" },
];

function Scene({ options, size }: { options: ChipGroupOption[]; size?: "default" | "dense" }) {
  const [value, setValue] = useState(options[0].value);
  const [calls, setCalls] = useState(0);
  return (
    <div data-testid="harness-chip-group" className="grid gap-4 p-4">
      <button type="button">[before]</button>
      <ChipGroup
        label="[Filter]"
        options={options}
        value={value}
        size={size}
        onChange={(next) => {
          setValue(next);
          setCalls((n) => n + 1);
        }}
      />
      <button type="button">[after]</button>
      <output data-testid="chip-group-value">{value}</output>
      <output data-testid="chip-group-calls">{calls}</output>
    </div>
  );
}

export const scenes: Scenes = {
  default: () => <Scene options={THREE} />,
  dense: () => <Scene options={THREE} size="dense" />,
  long: () => <Scene options={FIVE} />,
};
