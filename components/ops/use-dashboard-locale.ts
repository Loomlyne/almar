"use client";

import { useEffect, useState } from "react";
import type { Locale3 } from "./api-types";

function readLocaleCookie(): Locale3 {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return value === "ar" || value === "es" ? value : "en";
}

/**
 * The dashboard language, from the almar-locale cookie: "en" on the server and on first paint, then the cookie value.
 * One reader for every ops screen (they used to repeat it).
 */
export function useDashboardLocale(): Locale3 {
  const [locale, setLocale] = useState<Locale3>("en");
  useEffect(() => {
    setLocale(readLocaleCookie());
  }, []);
  return locale;
}
