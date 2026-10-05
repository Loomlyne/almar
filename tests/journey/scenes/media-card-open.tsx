"use client";

import { useRef, useState, type ReactNode } from "react";
import { MediaCard } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

function Scene({ withAction }: { withAction?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [opens, setOpens] = useState(0);
  const [others, setOthers] = useState(0);
  const wrap = (node: ReactNode) => (
    <div data-testid="harness-card-open" className="mx-auto grid w-full max-w-menu gap-4 p-4">
      {node}
      <button type="button" onClick={() => ref.current?.focus()}>
        [focus card]
      </button>
      <output data-testid="open-calls">{opens}</output>
      <output data-testid="other-calls">{others}</output>
    </div>
  );
  return wrap(
    <MediaCard
      image={IMAGES[0]}
      title="[Title]"
      detail="[Detail line]"
      onOpen={() => setOpens((n) => n + 1)}
      openRef={ref}
      action={
        withAction ? (
          <Button variant="secondary" onClick={() => setOthers((n) => n + 1)}>
            [Other]
          </Button>
        ) : undefined
      }
    />,
  );
}

export const scenes: Scenes = {
  open: () => <Scene />,
  "open-action": () => <Scene withAction />,
};
