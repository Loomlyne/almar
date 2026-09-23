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
    <main id="content" className="status-page">
      <img className="status-mark" src={src} alt="" width={128} height={70} />
      <h1>{title}</h1>
      {children}
    </main>
  );
}
