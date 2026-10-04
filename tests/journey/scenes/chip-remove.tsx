"use client";

import { useState } from "react";
import { Chip } from "../../../components/ui/chip";
import type { Scenes } from "../scene-types";

const ALL = ["[Cartagena]", "[Medellín]", "[A much longer private stay name that wraps]"];

function Scene() {
  const [left, setLeft] = useState(ALL);
  return (
    <div data-testid="harness-chip-remove" className="flex flex-wrap items-center gap-4 p-4">
      <button type="button">[before]</button>
      {left.map((text) => (
        <Chip
          key={text}
          onRemove={() => setLeft((list) => list.filter((t) => t !== text))}
          removeLabel={`[Remove filter]: ${text}`}
        >
          {text}
        </Chip>
      ))}
      <button type="button">[after]</button>
      <output data-testid="chips-left">{left.join(",")}</output>
    </div>
  );
}

export const scenes: Scenes = {
  filters: () => <Scene />,
};
