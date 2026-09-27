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
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[color-mix(in_srgb,var(--color-charcoal)_40%,transparent)]" />
        <Dialog.Content
          className="fixed inset-0 z-[80] flex items-center justify-center p-[var(--spacing-md)]"
          onEscapeKeyDown={preventDismiss}
          onPointerDownOutside={preventDismiss}
          onInteractOutside={preventDismiss}
        >
          <FocusScope trapped loop asChild>
            <div className="flex w-full max-w-[24rem] flex-col gap-[var(--spacing-md)] rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--spacing-md)] text-[var(--color-fg)] shadow-[var(--shadow-overlay)]">
              <Dialog.Title className="m-0 font-[var(--font-display)] text-[length:var(--text-heading)] font-normal leading-[1.1] text-balance text-[var(--color-heading)]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="m-0 text-[length:var(--text-body)] leading-[1.5] text-pretty text-[var(--color-fg)]">
                  {description}
                </Dialog.Description>
              ) : null}
              <div className="flex flex-wrap gap-[var(--spacing-sm)]">
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
