"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";

export type ContentKind = "pages" | "blog" | "team" | "legal";

const HTTPS_PREFIX = "https://";

type Config = {
  title: (copy: DashboardCopy) => string;
  emptyText: (copy: DashboardCopy) => string;
  newLabel: (copy: DashboardCopy) => string;
};

const CONFIG: Record<ContentKind, Config> = {
  pages: {
    title: (copy) => copy.rail.pages,
    emptyText: (copy) => copy.noPagesYet,
    newLabel: (copy) => copy.newPage,
  },
  blog: {
    title: (copy) => copy.rail.blog,
    emptyText: (copy) => copy.noPostsYet,
    newLabel: (copy) => copy.newPost,
  },
  team: {
    title: (copy) => copy.rail.team,
    emptyText: (copy) => copy.noTeamMembersYet,
    newLabel: (copy) => copy.newMember,
  },
  legal: {
    title: (copy) => copy.rail.legal,
    emptyText: (copy) => copy.noLegalPagesYet,
    newLabel: (copy) => copy.newLegalPage,
  },
};

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function ContentScreen({ kind }: { kind: ContentKind }) {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoInvalid, setPhotoInvalid] = useState(false);
  const copy = DASHBOARD_COPY[locale];
  const config = CONFIG[kind];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value === "" || value.startsWith(HTTPS_PREFIX)) {
      setPhotoUrl(value);
      setPhotoInvalid(false);
      return;
    }
    // T-03-29: a value that is not https:// is rejected in the field and is
    // never written to component state, so it cannot be stored or uploaded.
    setPhotoInvalid(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{config.title(copy)}</h1>
      <div className="flex flex-col items-start gap-2">
        <p className="m-0 text-pretty text-body text-ink">{config.emptyText(copy)}</p>
        <Button onClick={() => setOpen(true)}>{config.newLabel(copy)}</Button>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse font-body">
          <thead>
            <tr className="h-row dense:h-row-dense border-b border-line">
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">Name</th>
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">Status</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <Sidebar open={open} onOpenChange={setOpen} title={config.newLabel(copy)} closeLabel={copy.close}>
        <Fields kind={kind} photoUrl={photoUrl} photoInvalid={photoInvalid} onPhotoChange={handlePhotoChange} />
        <div className="flex justify-start pt-2">
          <Button onClick={() => undefined}>{copy.publish}</Button>
        </div>
      </Sidebar>
    </div>
  );
}

function Fields({
  kind,
  photoUrl,
  photoInvalid,
  onPhotoChange,
}: {
  kind: ContentKind;
  photoUrl: string;
  photoInvalid: boolean;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactNode {
  const name = <Field key="name" id={`${kind}-name`} label="Name" name="name" />;
  const status = <Field key="status" id={`${kind}-status`} label="Status" name="status" />;

  if (kind === "team") {
    return (
      <>
        {name}
        {status}
        <Field
          id="team-photo"
          label="Photo"
          name="photo"
          type="text"
          inputMode="url"
          placeholder="https://example.com/photo.jpg"
          value={photoUrl}
          onChange={onPhotoChange}
          error={photoInvalid ? "Enter a URL that starts with https://." : undefined}
        />
      </>
    );
  }

  return (
    <>
      {name}
      {status}
    </>
  );
}
