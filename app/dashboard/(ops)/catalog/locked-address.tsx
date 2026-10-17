/**
 * A published item's web address: it cannot change, so it is drawn as text, not as a box that looks editable (owner's
 * no-fake-controls rule). The line under it says why.
 */
export function LockedAddress({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <dl className="m-0 grid gap-2">
      <dt className="text-label text-ink">{label}</dt>
      <dd lang="en" dir="ltr" className="m-0 break-all text-start font-body text-body text-ink md:text-label">
        {value}
      </dd>
      <dd className="m-0 text-label text-muted">{note}</dd>
    </dl>
  );
}
