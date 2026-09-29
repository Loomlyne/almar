"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";

type SidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel?: string;
  children?: ReactNode;
};

/** Docks to the inline end (end-0) so it flips with dir="rtl" without JS. */
export function Sidebar({
  open,
  onOpenChange,
  title,
  closeLabel = "Close",
  children,
}: SidebarProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-ink/40" />
        <Dialog.Content
          className="fixed inset-y-0 end-0 z-70 flex w-full max-w-dialog flex-col gap-4 overflow-auto overscroll-contain rounded-none bg-surface p-4 text-ink shadow-lg"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-2">
            <Dialog.Title className="m-0 text-balance font-display text-title font-normal text-teal">{title}</Dialog.Title>
            <Dialog.Close className="ms-auto inline-flex min-h-control min-w-control cursor-pointer items-center justify-center rounded-none border border-line bg-transparent px-2 font-body text-label text-ink transition-colors duration-fast ease-standard hover:bg-ivory">
              {closeLabel}
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
