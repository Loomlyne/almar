"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import styles from "../../app/dashboard/dashboard.module.css";

type SidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel?: string;
  children?: ReactNode;
};

function dockEnd(node: HTMLDivElement | null) {
  node?.style.setProperty("inset-inline-end", "0");
}

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
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          ref={dockEnd}
          className={styles.panel}
          aria-describedby={undefined}
        >
          <div className={styles.bar}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close}>{closeLabel}</Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
