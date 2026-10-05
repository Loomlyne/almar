"use client";

import { useRef } from "react";
import { DropdownMenu } from "radix-ui";
import { cn } from "../../lib/cn";
import { ChevronIcon } from "../icons/icons";
import { opsHandoffOpen } from "../../lib/host";

export type NavAccount = {
  /** Her name, or her email while the name is empty (board 6e). */
  name: string;
  email: string;
  /** Owner only (plan 02-04): the one-time link to the ops host. */
  opsHref?: string;
};

export type AccountMenuLabels = {
  menuLabel: string;
  bookings: string;
  profile: string;
  preferences: string;
  signOut: string;
};

const ITEM =
  "flex min-h-control cursor-pointer items-center px-4 font-body text-label text-ink no-underline outline-none data-highlighted:bg-ivory";

/** Canvas page 6, board 6e: the signed-in trigger shows her name; the menu lists what works. */
export function AccountMenu({
  account,
  labels,
  tone = "default",
  onNavigate,
}: {
  account: NavAccount;
  labels: AccountMenuLabels;
  tone?: "default" | "on-image";
  onNavigate?: () => void;
}) {
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`${labels.menuLabel}: ${account.name}`}
        className={cn(
          "inline-flex h-control max-w-60 cursor-pointer items-center gap-2 rounded-none border pe-3 ps-4 font-body text-label",
          tone === "on-image" ? "border-ivory/70 bg-transparent text-ivory" : "border-muted bg-surface text-ink",
        )}
      >
        <bdi className="truncate">{account.name}</bdi>
        <ChevronIcon size={16} className="size-3 rotate-90" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-70 flex w-72 flex-col rounded-none bg-surface shadow-lg"
        >
          <div className="grid border-b border-line p-4">
            <bdi className="text-label text-ink">{account.name}</bdi>
            <bdi className="text-caption text-muted">{account.email}</bdi>
          </div>
          <DropdownMenu.Item asChild className={ITEM}>
            <a href="/bookings" onClick={onNavigate}>
              {labels.bookings}
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM}>
            <a href="/account#profile" onClick={onNavigate}>
              {labels.profile}
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM}>
            <a href="/account#preferences" onClick={onNavigate}>
              {labels.preferences}
            </a>
          </DropdownMenu.Item>
          {account.opsHref && opsHandoffOpen(process.env.NODE_ENV) ? (
            <DropdownMenu.Item asChild className={cn(ITEM, "uppercase tracking-kicker")}>
              <a href={account.opsHref} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
                TOUCHWORD
              </a>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item
            className={cn(ITEM, "border-t border-line")}
            onSelect={() => signOutForm.current?.requestSubmit()}
          >
            {labels.signOut}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      <form ref={signOutForm} method="post" action="/auth/sign-out" hidden />
    </DropdownMenu.Root>
  );
}
