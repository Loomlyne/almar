"use client";

import { useState } from "react";
import { CheckboxGroup, type CheckboxGroupOption } from "../../../components/ui/checkbox-group";
import type { Scenes } from "../scene-types";

const OPTIONS: CheckboxGroupOption[] = ["a", "b", "c", "d", "e"].map((v) => ({
  value: v,
  label: `[Option ${v.toUpperCase()}]`,
}));

function Scene({ options = OPTIONS, initial = [] }: { options?: CheckboxGroupOption[]; initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  const [calls, setCalls] = useState(0);
  return (
    <div data-testid="harness-checkbox-group" className="grid gap-4 p-4">
      <button type="button">[before]</button>
      <CheckboxGroup
        legend="[Destination]"
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          setCalls((n) => n + 1);
        }}
      />
      <button type="button">[after]</button>
      <output data-testid="cbg-value">{value.join(",")}</output>
      <output data-testid="cbg-calls">{calls}</output>
    </div>
  );
}

export const scenes: Scenes = {
  default: () => <Scene />,
  empty: () => <Scene options={[]} />,
  stale: () => <Scene initial={["x", "b"]} />,
};
