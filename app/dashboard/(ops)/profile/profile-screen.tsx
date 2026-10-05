"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Field } from "../../../../components/ui/field";
import { signOutEverywhere } from "../../actions";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import monogram from "../../../../brand/Logo Monogram/Curves_White.svg";


function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function ProfileScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const signOutForm = useRef<HTMLFormElement>(null);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">
        {copy.rail.profile}
      </h1>

      <div className="flex size-24 items-center justify-center rounded-none border border-line bg-teal" aria-hidden="true">
        <img className="size-10" src={monogram.src} alt="" />
      </div>

      <Field id="profile-name" label="Name" name="name" value="" readOnly />
      <Field id="profile-email" label="Email" name="email" type="email" value="" readOnly />

      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={() => setSignOutOpen(true)}>
          {copy.signOut}
        </Button>
        <Button variant="danger" onClick={() => setLogoutAllOpen(true)}>
          {copy.logoutAll}
        </Button>
      </div>

      <form ref={signOutForm} action="/auth/sign-out" method="post" hidden />
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={copy.signOut}
        confirmLabel={copy.signOutOfThisSite}
        cancelLabel={copy.staySignedIn}
        onConfirm={() => signOutForm.current?.submit()}
      />
      <ConfirmDialog
        open={logoutAllOpen}
        onOpenChange={setLogoutAllOpen}
        title={copy.logoutAll}
        confirmLabel={copy.signOutEverywhere}
        cancelLabel={copy.staySignedIn}
        onConfirm={() => void signOutEverywhere()}
      />
    </div>
  );
}
