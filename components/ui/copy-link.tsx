"use client";

import { useEffect, useState } from "react";
import { fill } from "../../lib/journey-format";
import { Button } from "./button";
import { useToast } from "./toast";

export type CopyLinkLabels = { copy: string; copied: string; failed: string };

/**
 * Copies `url` (never window.location). Renders nothing on the server and on the first client render, then only
 * where navigator.clipboard.writeText exists, so no visitor sees a button that cannot work. Needs a ToastProvider.
 */
export function CopyLinkButton({ url, label, labels }: { url: string; label?: string; labels: CopyLinkLabels }) {
  const { push } = useToast();
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    setCanCopy(typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function");
  }, []);

  if (!canCopy) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      push(labels.copied);
    } catch {
      push(fill(labels.failed, { url }), "warning");
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      {label ? <span className="text-label text-muted">{label}</span> : null}
      <Button variant="secondary" onClick={copy}>
        {labels.copy}
      </Button>
    </span>
  );
}
