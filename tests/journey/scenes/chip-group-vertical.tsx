"use client";

import { useState } from "react";
import { ChipGroup, type ChipGroupOption } from "../../../components/ui/chip-group";
import type { Scenes } from "../scene-types";

const OPTIONS: ChipGroupOption[] = [
  { value: "all", label: "[All]" },
  { value: "experience", label: "[Experiences]" },
  { value: "service", label: "[Services]" },
];

function Scene({ both }: { both?: boolean }) {
  const [value, setValue] = useState("all");
  const [calls, setCalls] = useState(0);
  const change = (next: string) => {
    setValue(next);
    setCalls((n) => n + 1);
  };
  return (
    <div data-testid="harness-chip-group-vertical" className="grid gap-4 p-4">
      <button type="button">[before]</button>
      <ChipGroup
        orientation="vertical"
        label={both ? "[Type rail]" : "[Type]"}
        options={OPTIONS}
        value={value}
        onChange={change}
      />
      {both ? <ChipGroup label="[Type row]" options={OPTIONS} value={value} onChange={change} /> : null}
      <button type="button">[after]</button>
      <output data-testid="cgv-value">{value}</output>
      <output data-testid="cgv-calls">{calls}</output>
    </div>
  );
}

export const scenes: Scenes = {
  default: () => <Scene />,
  both: () => <Scene both />,
};
