"use client";

import { useEffect, useState } from "react";
import { opsFetch } from "../../../../components/ops/ops-client";
import { readError } from "../../../../components/ops/read-error";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { Field } from "../../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_HOME_COPY, type OpsHomeCopy } from "../../../../lib/copy/ops-home";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import monogram from "../../../../brand/Logo Monogram/Curves_White.svg";

// Plan 05-04 (P5-10): the owner's Profile. The session's name and email, read-only; the sign-out buttons live in the rail
// only. ProfileView draws from props (no fetch) so a picture scene can render it; ProfileScreen reads /api/ops/profile once.

export function ProfileView({ name, email, copy, title }: { name: string | null; email: string; copy: OpsHomeCopy["profile"]; title: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>

      <div className="flex size-24 items-center justify-center rounded-none border border-line bg-teal" aria-hidden="true">
        <img className="size-10" src={monogram.src} alt="" />
      </div>

      <Field id="profile-name" label={copy.name} name="name" value={name ?? ""} placeholder={name === null ? copy.noName : undefined} readOnly />
      <Field id="profile-email" label={copy.email} name="email" type="email" dir="ltr" value={email} readOnly />
    </div>
  );
}

export function ProfileScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_HOME_COPY[locale].profile;
  const kit = OPS_KIT_COPY[locale];
  const title = DASHBOARD_COPY[locale].rail.profile;
  const [profile, setProfile] = useState<{ name: string | null; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read once. A language change after mount does not fetch again: the words are read at render.
  useEffect(() => {
    let live = true;
    void opsFetch<{ name: string | null; email: string }>("/api/ops/profile").then((reply) => {
      if (!live) return;
      if (!reply.ok) {
        setProfile(null);
        setError(readError(kit, reply.error, copy.failed));
        return;
      }
      setError(null);
      setProfile({ name: reply.name, email: reply.email });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (profile) return <ProfileView name={profile.name} email={profile.email} copy={copy} title={title} />;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>
      {error ? (
        <p className="m-0 text-label text-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="m-0 text-body text-muted" role="status">
          {copy.loading}
        </p>
      )}
    </div>
  );
}
