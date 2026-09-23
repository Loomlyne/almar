import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  busy?: boolean;
  children: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "ui-button-primary bg-[var(--color-accent)] text-[var(--color-heading)] border-transparent hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-press)]",
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
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <path
        d="M10 3a7 7 0 0 1 7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
