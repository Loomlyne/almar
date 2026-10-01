import type { InputHTMLAttributes, ReactNode } from "react";
import { CheckIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

// "choice" stays on the label as a layout hook for legacy rules (.addon .choice).
export function Checkbox({ label, className, ...rest }: ChoiceProps) {
  return (
    <label
      className={cn(
        "choice relative inline-flex min-h-control min-w-control cursor-pointer items-center gap-2 text-ink has-disabled:cursor-default has-disabled:text-muted",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer m-0 size-5 shrink-0 appearance-none rounded-none border border-ink bg-surface checked:border-teal checked:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:border-line"
        {...rest}
      />
      <span
        className="choice-mark pointer-events-none absolute inset-s-0 top-1/2 hidden size-5 -translate-y-1/2 place-items-center text-ivory peer-checked:grid"
        aria-hidden="true"
      >
        <CheckIcon size={16} />
      </span>
      <span>{label}</span>
    </label>
  );
}
