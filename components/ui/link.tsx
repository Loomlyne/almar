import { cva } from "class-variance-authority";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

const link = cva(
  "ui-link inline-flex items-center min-h-control text-teal hover:underline decoration-gold decoration-1 underline-offset-4",
  {
    variants: {
      inline: {
        // In a sentence: teal underline at rest, gold on hover (D-14).
        true: "underline decoration-teal hover:decoration-gold",
        false: "no-underline",
      },
    },
    defaultVariants: { inline: false },
  },
);

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  inline?: boolean;
  children: ReactNode;
};

export function Link({ className, children, href, inline = false, ...rest }: LinkProps) {
  return (
    <a href={href} className={cn(link({ inline }), className)} {...rest}>
      {children}
    </a>
  );
}
