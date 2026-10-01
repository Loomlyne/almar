import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { AlertCircleIcon, CheckIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

const card = cva(
  "relative flex w-full items-start gap-3 min-h-control p-4 text-start bg-surface border rounded-none cursor-pointer transition-colors duration-fast ease-standard hover:bg-ivory disabled:cursor-default disabled:text-muted disabled:hover:bg-surface",
  {
    variants: {
      on: {
        true: "shadow-selected border-teal",
        false: "border-muted",
      },
    },
    defaultVariants: { on: false },
  },
);

type ToggleCardProps = {
  pressed: boolean;
  onPress: () => void;
  title: ReactNode;
  detail?: ReactNode;
  amount?: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function ToggleCard({ pressed, onPress, title, detail, amount, disabled, className }: ToggleCardProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
      className={cn(card({ on: pressed }), className)}
    >
      <span className="grid flex-1 gap-1">
        <span className="font-display text-title text-teal">{title}</span>
        {detail ? <span className="text-label text-muted">{detail}</span> : null}
        {amount ? <span className="text-body text-ink tabular-nums">{amount}</span> : null}
      </span>
      {pressed ? <CheckIcon size={20} className="shrink-0 text-teal" /> : null}
    </button>
  );
}

export type ToggleCardOption = Omit<ToggleCardProps, "pressed" | "onPress"> & { value: string };

type ToggleCardGroupProps = {
  labelId: string;
  value: string | null;
  onChange: (value: string) => void;
  options?: ToggleCardOption[];
  error?: ReactNode;
  errorId?: string;
  className?: string;
  children?: ReactNode;
};

/** One card on at a time. Options render from props; children replace them for custom layouts. */
export function ToggleCardGroup({
  labelId,
  value,
  onChange,
  options = [],
  error,
  errorId,
  className,
  children,
}: ToggleCardGroupProps) {
  const messageId = error ? (errorId ?? `${labelId}-error`) : undefined;
  return (
    <div>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={messageId}
        className={cn("grid gap-3", className)}
      >
        {children ??
          options.map(({ value: optionValue, ...option }) => (
            <ToggleCard
              key={optionValue}
              {...option}
              pressed={value === optionValue}
              onPress={() => onChange(optionValue)}
            />
          ))}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="mt-2 flex items-center gap-2 text-label text-error">
          <AlertCircleIcon size={20} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
