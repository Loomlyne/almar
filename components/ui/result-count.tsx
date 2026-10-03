import { Button } from "./button";

/**
 * One polite live line with the result count, so a keyboard or screen-reader user hears that a
 * filter worked. The Clear control exists only when `onClear` is given, and sits outside the live
 * region so it is not read out with every change.
 */
export function ResultCount({
  text,
  clearLabel,
  onClear,
}: {
  text: string;
  clearLabel?: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p aria-live="polite" className="m-0 text-label text-ink">
        {text}
      </p>
      {onClear && clearLabel ? (
        <Button variant="ghost" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
