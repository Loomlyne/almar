"use client";

import { useEffect, useState } from "react";
import type { StayShareCopy } from "../../../lib/copy/saved-stays";
import { cn } from "../../../lib/cn";
import { whatsappShareHref } from "../../../lib/saved-stays/rules";
import { WhatsAppIcon } from "../../icons/icons";
import { buttonClass, LinkButton } from "../../ui/button";
import { CopyLinkButton } from "../../ui/copy-link";

/** As signed: ivory with a gold line and, like every button on the page, capitals in the Latin scripts at 14px. */
const IVORY = "uppercase tracking-kicker ar:normal-case ar:tracking-normal md:text-label";

/**
 * CopyLinkButton draws a secondary button, teal on transparent, which cannot be read on the hero's photo. Its look follows the
 * signed page from here, so the component itself is reused as it is.
 */
const IVORY_COPY_LINK = "inline-flex [&_button]:border-gold [&_button]:bg-ivory [&_button]:hover:bg-surface [&_button]:active:border-gold [&_button]:active:bg-surface";

type Mode = "pending" | "native" | "fallback";

/**
 * Share on the stay page (F-13). Nothing on the server and on the first client render, so no visitor sees a control that cannot
 * work. A share sheet where the browser has one; else Copy link and WhatsApp. `url` is the canonical address, never
 * window.location. Copy link needs a ToastProvider above it: the page's (SaveStayNotices).
 */
export function StayShare({ url, title, copy }: { url: string; title: string; copy: StayShareCopy }) {
  const [mode, setMode] = useState<Mode>("pending");

  useEffect(() => {
    const canShare = typeof navigator.share === "function" && navigator.canShare?.({ title, url }) !== false;
    setMode(canShare ? "native" : "fallback");
  }, [title, url]);

  if (mode === "pending") return null;

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      // She closed the sheet: nothing to say. Any other failure: the two other ways, for this page view.
      if (!(error instanceof DOMException && error.name === "AbortError")) setMode("fallback");
    }
  }

  if (mode === "native") {
    return (
      <button type="button" onClick={share} className={cn(buttonClass({ variant: "ivory" }), IVORY)}>
        {copy.share}
      </button>
    );
  }

  return (
    <>
      <span className={IVORY_COPY_LINK}>
        <CopyLinkButton url={url} labels={{ copy: copy.copy, copied: copy.copied, failed: copy.failed }} />
      </span>
      <LinkButton variant="ivory" href={whatsappShareHref(title, url, copy.whatsappText)} target="_blank" rel="noopener noreferrer" className={IVORY}>
        <WhatsAppIcon size={20} aria-hidden="true" />
        {copy.shareOn}
      </LinkButton>
    </>
  );
}
