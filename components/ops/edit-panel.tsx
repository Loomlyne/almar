"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Sidebar } from "../ui/sidebar";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import { TabList, panelId, tabId } from "./tab-list";
import { useDashboardLocale } from "./use-dashboard-locale";

/** Tailwind's md. Below it a panel is a full-screen sheet (D-82); from it the panel docks to the inline end (D-88). */
const DOCKED_QUERY = "(min-width: 768px)";

function subscribeDocked(onChange: () => void): () => void {
  const query = window.matchMedia(DOCKED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useDocked(): boolean {
  return useSyncExternalStore(
    subscribeDocked,
    () => window.matchMedia(DOCKED_QUERY).matches,
    () => false,
  );
}

/**
 * The one edit panel of the dashboard: a side panel with tabs from 768 up (the design system's Sidebar, docked at the
 * inline end, so it mirrors in Arabic), a full-screen sheet below. `children` is the body of the chosen tab and
 * `footer` is the publish bar. Closing with unsaved changes asks "Discard changes?" first.
 */
export function EditPanel({
  open,
  onOpenChange,
  title,
  tabs,
  tab,
  onTabChange,
  dirty,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tabs: { key: string; label: string }[];
  tab: string;
  onTabChange: (key: string) => void;
  dirty: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const docked = useDocked();
  const idBase = useId();
  const [asking, setAsking] = useState(false);

  function requestChange(next: boolean) {
    if (!next && dirty) {
      setAsking(true);
      return;
    }
    onOpenChange(next);
  }

  const tabList =
    tabs.length > 1 ? (
      <TabList idBase={idBase} label={copy.sections} items={tabs} value={tab} onChange={onTabChange} />
    ) : null;
  const body = (
    <div
      role={tabs.length > 1 ? "tabpanel" : undefined}
      id={panelId(idBase)}
      aria-labelledby={tabs.length > 1 ? tabId(idBase, tab) : undefined}
      className="flex min-w-0 flex-col gap-4"
    >
      {children}
    </div>
  );

  return (
    <>
      {docked ? (
        <Sidebar open={open} onOpenChange={requestChange} title={title} closeLabel={copy.close}>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {tabList}
            {body}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto border-t border-line bg-surface p-4">{footer}</div>
          </div>
        </Sidebar>
      ) : (
        <Dialog.Root open={open} onOpenChange={requestChange}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-70 bg-ink/40" />
            <Dialog.Content
              className="fixed inset-0 z-70 flex flex-col rounded-none bg-surface text-ink"
              aria-describedby={undefined}
            >
              <div className="flex min-h-sheet-head shrink-0 items-center justify-between gap-2 border-b border-line px-4">
                <Dialog.Title className="m-0 text-balance font-display text-title font-normal text-teal">{title}</Dialog.Title>
                <Dialog.Close className="ms-auto inline-flex min-h-control min-w-control cursor-pointer items-center justify-center rounded-none border border-line bg-transparent px-2 font-body text-label text-ink transition-colors duration-fast ease-standard hover:bg-ivory">
                  {copy.close}
                </Dialog.Close>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto overscroll-contain p-4">
                {tabList}
                {body}
              </div>
              <div className="shrink-0 border-t border-line bg-surface p-4">{footer}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.discardTitle}
        confirmLabel={copy.discard}
        cancelLabel={copy.keepEditing}
        onConfirm={() => {
          setAsking(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
