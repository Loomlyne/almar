import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

export function Link({ className = "", children, href, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      className={`ui-link text-[var(--color-link)] no-underline hover:text-[var(--color-link-hover)] ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}
