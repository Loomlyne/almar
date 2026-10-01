import { useState, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "onChange"> & {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  disabled,
  ...rest
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={cn(
        "switch group inline-flex min-h-control cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-body text-ink disabled:cursor-default disabled:text-muted",
        className,
      )}
      onClick={() => {
        const next = !on;
        if (checked === undefined) setInternal(next);
        onCheckedChange?.(next);
      }}
      {...rest}
    >
      <span
        className="relative h-6 w-11 shrink-0 rounded-none border border-muted bg-ivory transition-colors duration-fast ease-standard group-aria-checked:border-teal group-aria-checked:bg-teal"
        aria-hidden="true"
      >
        <span className="absolute inset-s-0.5 top-0.5 size-4.5 rounded-none bg-muted transition-all duration-fast ease-standard group-aria-checked:bg-surface group-aria-checked:translate-x-5 group-aria-checked:rtl:-translate-x-5" />
      </span>
      <span>{label}</span>
    </button>
  );
}
