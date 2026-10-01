"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY, type DashboardCopy } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import { canBecomeHttpsUrl } from "../../../../lib/https-url";

export type CatalogKind = "destinations" | "stays" | "experiences" | "packages";


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
    // Every keystroke is kept so the URL can be typed. The error shows once the value can no
    // longer become https://. T-03-27: whatever saves this later must accept only isHttpsUrl().
    const value = event.target.value;
    setMediaUrl(value);
    setMediaInvalid(!canBecomeHttpsUrl(value));
  }


  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{config.title(copy)}</h1>
      {kind === "experiences" ? (
        <div className="flex flex-wrap gap-4" role="group" aria-label={copy.rail.experiences}>
          <label className="flex flex-col gap-1 text-label text-ink">
            Type
            <select
              className="h-control min-w-40 rounded-none border border-ink bg-surface px-2 font-body text-label text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">All types</option>
              <option value="experience">Experience</option>
              <option value="service">Service</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label text-ink">
            Price
            <select
              className="h-control min-w-40 rounded-none border border-ink bg-surface px-2 font-body text-label text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              value={priceSort}
              onChange={(event) => setPriceSort(event.target.value)}
            >
              <option value="">Price</option>
              <option value="low">Low to high</option>
              <option value="high">High to low</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label text-ink">
            Destination
            <select
              className="h-control min-w-40 rounded-none border border-ink bg-surface px-2 font-body text-label text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              value={destinationFilter}
              onChange={(event) => setDestinationFilter(event.target.value)}
            >
              <option value="">All destinations</option>
            </select>
          </label>
        </div>
      ) : null}
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
        <Fields
          kind={kind}
          mediaUrl={mediaUrl}
          mediaInvalid={mediaInvalid}
          onMediaChange={handleMediaChange}
        />
        <div className="flex justify-start pt-2">
          <Button onClick={() => undefined}>{copy.publish}</Button>
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
