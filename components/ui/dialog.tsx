"use client";

import type { ReactNode, RefObject } from "react";
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
  media,
  kicker,
  returnFocusRef,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  closeLabel: string;
  dismiss?: Dismiss;
  /**
   * "detail" is the catalogue overlay: full screen below 768px, a 760px panel from md, with a picture slot, a
   * kicker over the title and a docked 88px footer. sm, wide and full are unchanged.
   */
  size?: "sm" | "wide" | "full" | "detail";
  children?: ReactNode;
  footer?: ReactNode;
  /** detail only: the picture above the body; the close square sits over its inline-end top corner. */
  media?: ReactNode;
  /** detail only: one 12px uppercase line above the title. */
  kicker?: ReactNode;
  /** Any size: where focus lands after close (Escape, close button, scrim). A controlled dialog has no trigger to return to. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const locked = dismiss === "confirm";
  const full = size === "full";
  const detail = size === "detail";
  const block = locked ? (event: Event) => event.preventDefault() : undefined;
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-70 bg-ink/40" />
        <RadixDialog.Content
          className={cn(
            detail
              ? "fixed inset-0 z-70 flex h-full w-full flex-col overflow-hidden rounded-none bg-surface text-ink animate-sheet-in motion-reduce:animate-fade-in md:inset-auto md:top-1/2 md:start-1/2 md:h-auto md:max-h-screen md:max-w-calendar md:-translate-y-1/2 md:shadow-lg md:ltr:-translate-x-1/2 md:rtl:translate-x-1/2"
              : full
              ? "fixed inset-0 z-70 flex h-full w-full flex-col overflow-hidden rounded-none bg-ivory text-ink animate-sheet-in motion-reduce:animate-fade-in"
              : "fixed top-1/2 start-1/2 z-70 max-h-screen w-full -translate-y-1/2 overflow-auto overscroll-contain rounded-none bg-surface p-6 text-ink shadow-lg ltr:-translate-x-1/2 rtl:translate-x-1/2",
            size === "wide" ? "max-w-column" : !full && !detail && "max-w-dialog",
          )}
          aria-describedby={undefined}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          onCloseAutoFocus={
            returnFocusRef
              ? (event) => {
                  event.preventDefault();
                  returnFocusRef.current?.focus();
                }
              : undefined
          }
        >
          <FocusScope trapped loop asChild>
            {detail ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {media ? (
                  <div className="relative shrink-0">
                    <div className="h-55 overflow-hidden md:h-70 *:block *:size-full *:object-cover">{media}</div>
                    <RadixDialog.Close
                      className="absolute top-2 end-2 inline-flex size-control cursor-pointer items-center justify-center rounded-none border-0 bg-surface text-teal"
                      aria-label={closeLabel}
                    >
                      <CloseIcon size={20} />
                    </RadixDialog.Close>
                  </div>
                ) : (
                  <div className="flex shrink-0 justify-end p-2">
                    <RadixDialog.Close
                      className="inline-flex size-control cursor-pointer items-center justify-center rounded-none border-0 bg-surface text-teal"
                      aria-label={closeLabel}
                    >
                      <CloseIcon size={20} />
                    </RadixDialog.Close>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      {kicker ? (
                        <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                          {kicker}
                        </p>
                      ) : null}
                      <RadixDialog.Title className="m-0 font-display text-heading font-normal text-teal">
                        {title}
                      </RadixDialog.Title>
                    </div>
                    {children}
                  </div>
                </div>
                {footer ? (
                  <div className="flex h-dock shrink-0 items-center justify-end gap-4 border-t border-line bg-ivory px-4 md:px-8">
                    {footer}
                  </div>
                ) : null}
              </div>
            ) : (
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
            )}
          </FocusScope>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
