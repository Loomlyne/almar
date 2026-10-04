import { cva, type VariantProps } from "class-variance-authority";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

// "ui-button" and "ui-button-primary" stay as layout hooks for legacy rules
// (plan 27 removes them). Every visual value comes from the utilities below.
const button = cva(
  "ui-button inline-flex items-center justify-center gap-2 w-max max-w-full shrink-0 border font-body text-label cursor-pointer rounded-none transition-colors duration-fast ease-standard disabled:cursor-default",
  {
    variants: {
      variant: {
        primary:
          "ui-button-primary uppercase tracking-kicker ar:normal-case ar:tracking-normal bg-teal text-ivory border-teal hover:bg-teal-hover active:bg-teal-press",
        secondary:
          "uppercase tracking-kicker ar:normal-case ar:tracking-normal bg-transparent text-teal border-teal hover:bg-teal-tint active:bg-teal-tint active:border-teal-press",
        ghost:
          "bg-transparent text-teal border-transparent hover:underline decoration-gold decoration-1 underline-offset-4",
        danger: "bg-transparent text-ink border-error hover:bg-line active:bg-line",
        // The Framer pages' buttons: gold is the 1px border only. 14px on a phone, 16px from md.
        outline: "bg-transparent text-teal border-gold hover:bg-teal-tint md:text-body",
        ivory: "bg-ivory text-teal border-gold hover:bg-surface md:text-body",
      },
      size: {
        md: "h-control px-6",
        lg: "h-action px-8",
        bar: "h-bar w-search",
        "bar-auto": "h-bar px-8",
        docked: "h-bar-docked w-40",
      },
      journey: {
        true: "",
        false:
          "disabled:bg-ivory disabled:border-line disabled:text-muted disabled:no-underline",
      },
    },
    defaultVariants: { variant: "primary", size: "md", journey: false },
  },
);

type Variant = NonNullable<VariantProps<typeof button>["variant"]>;

/** The Button class string, for a control that must be an element other than <button>. */
export function buttonClass(options: { variant?: Variant; size?: VariantProps<typeof button>["size"]; journey?: boolean | null } = {}) {
  return button({ variant: options.variant ?? "primary", size: options.size, journey: options.journey });
}

type LinkButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: Variant;
  size?: VariantProps<typeof button>["size"];
  children: ReactNode;
};

/** A link with the Button look: always live, no disabled state. Use it for navigation and wa.me links. */
export function LinkButton({ href, variant = "primary", size, className, children, ...rest }: LinkButtonProps) {
  return (
    <a href={href} className={cn(buttonClass({ variant, size }), "no-underline", className)} {...rest}>
      {children}
    </a>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    variant?: Variant;
    busy?: boolean;
    children: ReactNode;
  };

export function Button({
  variant = "primary",
  size,
  journey,
  busy = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || busy);
  return (
    <button
      type={type}
      className={cn(buttonClass({ variant, size, journey }), className)}
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
      className="size-5 shrink-0 motion-safe:animate-spin"
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
