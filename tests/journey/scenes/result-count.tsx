"use client";

import { useState } from "react";
import { ResultCount } from "../../../components/ui/result-count";
import type { Scenes } from "../scene-types";

function Live({ start, withClear }: { start: number; withClear: boolean }) {
  const [n, setN] = useState(start);
  return (
    <div data-testid="harness-count" className="p-4">
      <ResultCount
        text={`[${n} results]`}
        clearLabel="[Clear filters]"
        onClear={withClear ? () => setN(12) : undefined}
      />
      <button type="button" onClick={() => setN((v) => v + 1)}>
        [more]
      </button>
    </div>
  );
}

export const scenes: Scenes = {
  zero: () => <Live start={0} withClear />,
  one: () => <Live start={1} withClear={false} />,
  twelve: () => <Live start={12} withClear />,
};
