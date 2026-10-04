"use client";

import { StickyDock } from "../../../components/ui/sticky-dock";
import { Button } from "../../../components/ui/button";
import type { Scenes } from "../scene-types";

const LONG = Array.from({ length: 90 }, (_, i) => <p key={i}>[Line {i + 1}]</p>);

export const scenes: Scenes = {
  "with-action": () => (
    <div data-testid="harness-dock-page" className="p-4">
      {LONG}
      <p data-testid="harness-last-line">[Last line]</p>
      <StickyDock
        summary={
          <>
            <span className="text-label text-ink">[Stay name]</span>
            <span className="text-caption text-muted">[Dates · guests]</span>
          </>
        }
        action={<Button>[Continue]</Button>}
      />
    </div>
  ),
  "no-action": () => (
    <div data-testid="harness-dock-page" className="p-4">
      {LONG}
      <p data-testid="harness-last-line">[Last line]</p>
      <StickyDock summary={<span className="text-label text-ink">[Summary only]</span>} />
    </div>
  ),
};
