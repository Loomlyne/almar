"use client";

import type { ReactNode } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { CloseIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

// "picker" closes on Escape and scrim. "confirm" (confirm, pay, expired) does not.
type Dismiss = "picker" | "confirm";

/**
 * Generic dialog. Every string arrives through props so callers localise it.
 * Pass `trigger` (a single element) for an uncontrolled dialog, or
 * `open` and `onOpenChange` for a controlled one.
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  closeLabel,
  dismiss = "picker",
  size = "sm",
  children,
  footer,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  closeLabel: string;
  dismiss?: Dismiss;
  size?: "sm" | "wide" | "full";
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const locked = dismiss === "confirm";
  const full = size === "full";
  const block = locked ? (event: Event) => event.preventDefault() : undefined;
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-70 bg-ink/40" />
        <RadixDialog.Content
          className={cn(
            full
              ? "fixed inset-0 z-70 flex h-full w-full flex-col overflow-hidden rounded-none bg-ivory text-ink animate-sheet-in motion-reduce:animate-fade-in"
              : "fixed top-1/2 start-1/2 z-70 max-h-screen w-full -translate-y-1/2 overflow-auto overscroll-contain rounded-none bg-surface p-6 text-ink shadow-lg ltr:-translate-x-1/2 rtl:translate-x-1/2",
            size === "wide" ? "max-w-column" : !full && "max-w-dialog",
          )}
          aria-describedby={undefined}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
        >
          <FocusScope trapped loop asChild>
            <div className={cn("flex flex-col", full ? "min-h-0 flex-1" : "gap-4")}>
              <div
                className={cn(
                  "flex items-center justify-between gap-2",
                  full && "h-sheet-head shrink-0 border-b border-line bg-surface ps-4",
                )}
              >
                <RadixDialog.Title className="m-0 font-display text-title text-teal">
                  {title}
                </RadixDialog.Title>
                <RadixDialog.Close
                  className="inline-flex size-control shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-teal"
                  aria-label={closeLabel}
                >
                  <CloseIcon size={20} />
                </RadixDialog.Close>
              </div>
              {full ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div> : children}
              {footer ? (
                <div className={cn("flex flex-wrap items-center gap-2", full && "shrink-0")}>{footer}</div>
              ) : null}
            </div>
          </FocusScope>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
