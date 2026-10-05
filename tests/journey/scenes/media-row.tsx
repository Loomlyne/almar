"use client";

import { MediaRow } from "../../../components/ui/media-row";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

export const scenes: Scenes = {
  row: () => (
    <div data-testid="harness-media-row" className="w-full p-4">
      <MediaRow
        title="[Value]"
        body="[Body paragraph of one value, two sentences. The second sentence wraps onto a further line at the phone width.]"
        image={{ src: IMAGES[2].src, alt: "" }}
      />
    </div>
  ),
};
