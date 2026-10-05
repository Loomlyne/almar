"use client";

import { Chip } from "../ui/chip";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import type { Locale3 } from "./api-types";

/** Published or Draft, as a static label (no hover, no focus stop). The language is the caller's, not read here. */
export function StatusChip({ published, locale }: { published: boolean; locale: Locale3 }) {
  const copy = OPS_KIT_COPY[locale];
  return (
    <Chip interactive={false} size="dense" on={published}>
      {published ? copy.published : copy.draft}
    </Chip>
  );
}
