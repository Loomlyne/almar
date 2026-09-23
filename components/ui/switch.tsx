import { useState, type ButtonHTMLAttributes } from "react";

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
  className = "",
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
      className={`switch ${className}`}
      onClick={() => {
        const next = !on;
        if (checked === undefined) setInternal(next);
        onCheckedChange?.(next);
      }}
      {...rest}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}
