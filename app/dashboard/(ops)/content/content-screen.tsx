"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../../lib/dashboard-copy";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./content.module.css";

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
    <div className={styles.screen}>
      <h1 className={styles.title}>{config.title(copy)}</h1>
      <div className={styles.empty}>
        <p className={styles.emptyText}>{config.emptyText(copy)}</p>
        <button type="button" className="hero-search-submit" onClick={() => setOpen(true)}>
          {config.newLabel(copy)}
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className="ops-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <Sidebar open={open} onOpenChange={setOpen} title={config.newLabel(copy)} closeLabel={copy.close}>
        <Fields kind={kind} photoUrl={photoUrl} photoInvalid={photoInvalid} onPhotoChange={handlePhotoChange} />
        <div className={styles.actions}>
          <button type="button" className="hero-search-submit" onClick={() => undefined}>
            {copy.publish}
          </button>
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
