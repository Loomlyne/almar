"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./catalog.module.css";

export type CatalogKind = "destinations" | "stays" | "experiences" | "packages";

const HTTPS_PREFIX = "https://";

type Config = {
  title: (copy: DashboardCopy) => string;
  emptyText: (copy: DashboardCopy) => string;
  newLabel: (copy: DashboardCopy) => string;
};

const CONFIG: Record<CatalogKind, Config> = {
  destinations: {
    title: (copy) => copy.rail.destinations,
    emptyText: (copy) => copy.noDestinationsYet,
    newLabel: (copy) => copy.newDestination,
  },
  stays: {
    title: (copy) => copy.rail.stays,
    emptyText: (copy) => copy.noStaysYet,
    newLabel: (copy) => copy.newStay,
  },
  experiences: {
    title: (copy) => copy.rail.experiences,
    emptyText: (copy) => copy.noExperiencesYet,
    newLabel: (copy) => copy.newExperience,
  },
  packages: {
    title: (copy) => copy.rail.packages,
    emptyText: (copy) => copy.noPackagesYet,
    newLabel: (copy) => copy.newPackage,
  },
};

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function CatalogScreen({ kind }: { kind: CatalogKind }) {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaInvalid, setMediaInvalid] = useState(false);
  const copy = DASHBOARD_COPY[locale];
  const config = CONFIG[kind];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value === "" || value.startsWith(HTTPS_PREFIX)) {
      setMediaUrl(value);
      setMediaInvalid(false);
      return;
    }
    // T-03-27: a value that is not https:// is rejected in the field and is
    // never written to component state, so it cannot be stored or uploaded.
    setMediaInvalid(true);
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{config.title(copy)}</h1>
      {kind === "experiences" ? (
        <div className={styles.controls} role="group" aria-label={copy.rail.experiences}>
          <label className={styles.controlLabel}>
            Type
            <select
              className={styles.controlSelect}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">All types</option>
              <option value="experience">Experience</option>
              <option value="service">Service</option>
            </select>
          </label>
          <label className={styles.controlLabel}>
            Price
            <select
              className={styles.controlSelect}
              value={priceSort}
              onChange={(event) => setPriceSort(event.target.value)}
            >
              <option value="">Price</option>
              <option value="low">Low to high</option>
              <option value="high">High to low</option>
            </select>
          </label>
          <label className={styles.controlLabel}>
            Destination
            <select
              className={styles.controlSelect}
              value={destinationFilter}
              onChange={(event) => setDestinationFilter(event.target.value)}
            >
              <option value="">All destinations</option>
            </select>
          </label>
        </div>
      ) : null}
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
        <Fields
          kind={kind}
          mediaUrl={mediaUrl}
          mediaInvalid={mediaInvalid}
          onMediaChange={handleMediaChange}
        />
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
  mediaUrl,
  mediaInvalid,
  onMediaChange,
}: {
  kind: CatalogKind;
  mediaUrl: string;
  mediaInvalid: boolean;
  onMediaChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactNode {
  const name = <Field key="name" id={`${kind}-name`} label="Name" name="name" />;
  const status = <Field key="status" id={`${kind}-status`} label="Status" name="status" />;

  if (kind === "destinations" || kind === "packages") {
    return (
      <>
        {name}
        {status}
      </>
    );
  }

  if (kind === "stays") {
    return (
      <>
        {name}
        {status}
        <Field id="stay-pets" label="Pets" name="pets" />
        <Field id="stay-min-nights" label="Min nights" name="minNights" type="number" inputMode="numeric" />
        <Field id="stay-infants" label="Infants count" name="infantsCount" type="number" inputMode="numeric" />
        <Field
          id="stay-media"
          label="Media URL"
          name="mediaUrl"
          type="text"
          inputMode="url"
          placeholder="https://example.com/photo.jpg"
          value={mediaUrl}
          onChange={onMediaChange}
          error={mediaInvalid ? "Enter a URL that starts with https://." : undefined}
        />
        <Field id="stay-rates" label="Rates" name="rates" value="" readOnly hint="Set after connecting the catalogue" />
      </>
    );
  }

  return (
    <>
      {name}
      {status}
      <Field id="experience-type" label="Type" name="type" />
      <Field id="experience-price" label="Price" name="price" type="number" inputMode="decimal" />
      <Field id="experience-destination" label="Destination" name="destination" />
    </>
  );
}
