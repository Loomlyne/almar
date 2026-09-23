"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { CloseIcon } from "../icons/icons";

type Dismiss = "picker" | "confirm";

export function KitDialog({
  trigger,
  title,
  dismiss = "picker",
  wide = false,
  children,
}: {
  trigger: string;
  title: string;
  dismiss?: Dismiss;
  wide?: boolean;
  children?: ReactNode;
}) {
  const locked = dismiss === "confirm";
  return (
    <Dialog.Root>
      <Dialog.Trigger className="ui-button ui-button-inline">{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-scrim" />
        <Dialog.Content
          className={wide ? "ui-dialog ui-dialog-wide" : "ui-dialog"}
          aria-describedby={undefined}
          onEscapeKeyDown={locked ? (event) => event.preventDefault() : undefined}
          onPointerDownOutside={locked ? (event) => event.preventDefault() : undefined}
          onInteractOutside={locked ? (event) => event.preventDefault() : undefined}
        >
          <FocusScope trapped loop asChild>
            <div className="ui-dialog-body">
              <div className="ui-dialog-bar">
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Close className="icon-button" aria-label="Close">
                  <CloseIcon size={20} />
                </Dialog.Close>
              </div>
              {children}
              <div className="ui-dialog-actions">
                <Dialog.Close className="ui-button ui-button-inline">Cancel</Dialog.Close>
                <button type="button" className="ui-button ui-button-primary ui-button-inline">
                  Continue
                </button>
              </div>
            </div>
          </FocusScope>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
