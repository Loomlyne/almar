"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { CountBadge } from "../../../components/ui/count-badge";
import type { Scenes } from "../scene-types";

function InButton() {
  const [count, setCount] = useState(2);
  return (
    <div data-testid="harness-count-badge" className="flex flex-wrap items-center gap-4 p-4">
      <Button variant="secondary">
        [Filters]
        <CountBadge count={count} label={`[${count} filters on]`} />
      </Button>
      <button type="button" onClick={() => setCount((n) => n + 1)}>
        [+1]
      </button>
    </div>
  );
}

const alone = (count: number) => (
  <div data-testid="harness-count-badge" className="flex flex-wrap items-center gap-4 p-4">
    <Button variant="secondary">
      [Filters]
      <CountBadge count={count} />
    </Button>
  </div>
);

export const scenes: Scenes = {
  "in-button": () => <InButton />,
  zero: () => alone(0),
  large: () => alone(17),
};
