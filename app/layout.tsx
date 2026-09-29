import type { ReactNode } from "react";
import "./globals.css";
import { lato, questa } from "../lib/fonts";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${questa.variable} ${lato.variable} antialiased`}
    >
      <body>
        <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-70 focus:bg-teal focus:px-4 focus:py-3 focus:text-ivory" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
