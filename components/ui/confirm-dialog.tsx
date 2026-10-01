"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { Button } from "./button";

/**
 * A destructive confirm, standalone from the picker-style dialog in this
 * folder. Escape, an outside pointer down, and any other outside interaction
 * are all prevented, so the only way out is one of the two named buttons
 * below. Never imports that other dialog component or its chrome.
 */
function preventDismiss(event: Event) {
  event.preventDefault();
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Stay signed in",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-ink/40" />
        <Dialog.Content
          className="fixed inset-0 z-70 flex items-center justify-center p-4"
          onEscapeKeyDown={preventDismiss}
          onPointerDownOutside={preventDismiss}
          onInteractOutside={preventDismiss}
        >
          <FocusScope trapped loop asChild>
            <div className="flex w-full max-w-dialog flex-col gap-4 rounded-none bg-surface p-6 text-ink shadow-lg">
              <Dialog.Title className="m-0 font-display text-heading font-normal text-balance text-teal">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="m-0 text-body text-pretty text-ink">
                  {description}
                </Dialog.Description>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" onClick={onConfirm}>
                  {confirmLabel}
                </Button>
                <Dialog.Close asChild>
                  <Button variant="secondary">{cancelLabel}</Button>
                </Dialog.Close>
              </div>
            </div>
          </FocusScope>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
