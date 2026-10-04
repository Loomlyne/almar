/**
 * A 20px count mark: teal ground, ivory 12px digits. Renders nothing for 0, a negative or a non-integer.
 * With `label` the number is hidden from assistive technology and `label` is the accessible text.
 * Digits are always Western (I18N-03): the number is written as a plain string, never localised.
 */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (!Number.isInteger(count) || count <= 0) return null;
  return (
    <span className="inline-flex">
      <span
        aria-hidden={label ? true : undefined}
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-none bg-teal px-1 font-body text-caption text-ivory tabular-nums"
      >
        <bdi>{String(count)}</bdi>
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
