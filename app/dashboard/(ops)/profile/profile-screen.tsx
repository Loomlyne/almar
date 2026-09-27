"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Field } from "../../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../../lib/dashboard-copy";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";

/** Same URL string as the unexported constant in components/ui/nav.tsx. */
const MONOGRAM_SRC = "https://framerusercontent.com/images/prMcX1bT4P2ZzVsjpoFmR4T5nA.svg";

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function ProfileScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)] min-w-0">
      <h1 className="m-0 font-[var(--font-display)] text-[length:var(--text-heading)] font-normal leading-[1.1] text-balance text-[var(--color-heading)]">
        {copy.rail.profile}
      </h1>

      <div
        className="flex h-24 w-24 items-center justify-center rounded-none border border-[color-mix(in_srgb,var(--color-charcoal)_10%,transparent)] bg-[var(--color-ivory)]"
        aria-hidden="true"
      >
        <img className="h-10 w-10" src={MONOGRAM_SRC} alt="" />
      </div>

      <Field id="profile-name" label="Name" name="name" value="" readOnly />
      <Field id="profile-email" label="Email" name="email" type="email" value="" readOnly />

      <div className="flex flex-wrap gap-[var(--spacing-sm)]">
        <Button variant="danger" onClick={() => setSignOutOpen(true)}>
          {copy.signOut}
        </Button>
        <Button variant="danger" onClick={() => setLogoutAllOpen(true)}>
          {copy.logoutAll}
        </Button>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={copy.signOut}
        confirmLabel={copy.signOutOfThisSite}
        cancelLabel={copy.staySignedIn}
        onConfirm={() => setSignOutOpen(false)}
      />
      <ConfirmDialog
        open={logoutAllOpen}
        onOpenChange={setLogoutAllOpen}
        title={copy.logoutAll}
        confirmLabel={copy.signOutEverywhere}
        cancelLabel={copy.staySignedIn}
        onConfirm={() => setLogoutAllOpen(false)}
      />
    </div>
  );
}
