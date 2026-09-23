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
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
