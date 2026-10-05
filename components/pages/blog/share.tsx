"use client";

import { CopyLinkButton, type CopyLinkLabels } from "../../ui/copy-link";
import { ToastProvider } from "../../ui/toast";

// Share + Copy link. The `Share` label is drawn by CopyLinkButton inside its mounted, can-copy branch, so a label
// never stands without its control (JavaScript off, no clipboard, before hydration). Strings and an address only.

export function PostShare({ url, label, labels }: { url: string; label: string; labels: CopyLinkLabels }) {
  return (
    <ToastProvider>
      <CopyLinkButton url={url} label={label} labels={labels} />
    </ToastProvider>
  );
}
