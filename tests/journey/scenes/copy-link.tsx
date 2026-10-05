"use client";

import { useState, type ReactNode } from "react";
import { CopyLinkButton } from "../../../components/ui/copy-link";
import { ToastProvider } from "../../../components/ui/toast";
import type { Scenes } from "../scene-types";

const LABELS = { copy: "[Copy link]", copied: "[Link copied]", failed: "[Could not copy {url}]" };
const URL_TEXT = "https://almarprivatejourney.com/blog/[post]";

const wrap = (node: ReactNode) => (
  <ToastProvider>
    <div data-testid="harness-copy" className="p-4">
      {node}
    </div>
  </ToastProvider>
);

/** Removes the clipboard before the button's mount effect runs (a plain delete does nothing: it is a prototype getter). */
function NoClipboard({ children }: { children: ReactNode }) {
  useState(() => {
    if (typeof navigator !== "undefined") Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    return null;
  });
  return <>{children}</>;
}

export const scenes: Scenes = {
  default: () => wrap(<CopyLinkButton url={URL_TEXT} labels={LABELS} />),
  "no-clipboard": () =>
    wrap(
      <NoClipboard>
        <CopyLinkButton url={URL_TEXT} labels={LABELS} />
      </NoClipboard>,
    ),
};
