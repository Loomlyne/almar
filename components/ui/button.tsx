import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  busy?: boolean;
  children: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "ui-button-primary bg-[var(--color-bg)] text-[var(--color-heading)] border-[var(--color-accent)] hover:bg-[var(--color-heading)] hover:text-[var(--color-bg)]",
  secondary:
    "bg-transparent text-[var(--color-link)] border-[var(--color-heading)]",
  ghost:
    "bg-transparent text-[var(--color-link)] border-transparent hover:text-[var(--color-link-hover)]",
  danger:
    "bg-transparent text-[var(--color-fg)] border-[var(--color-danger)]",
};

export function Button({
  variant = "primary",
  busy = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || busy);
  return (
    <button
      type={type}
      className={`ui-button ${VARIANT_CLASS[variant]} disabled:bg-[var(--color-bg)] disabled:text-[var(--color-muted-fg)] disabled:border-[var(--color-border)] disabled:cursor-default ${className}`}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="ui-spinner"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
