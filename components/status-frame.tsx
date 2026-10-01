import type { ReactNode } from "react";
import monogram from "../brand/Logo Monogram/Curves_black.svg";

export function StatusFrame({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}`;
  return (
    <main id="content" className="mx-auto grid max-w-160 justify-items-start gap-6 px-4 py-16">
      <img className="block h-auto w-32" src={src} alt="" width={128} height={70} />
      <h1 className="m-0 font-display text-display tracking-display text-teal">{title}</h1>
      {children}
    </main>
  );
}
