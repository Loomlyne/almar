"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteNav } from "../../../components/ui/nav";
import { WhatsApp } from "../../../components/ui/whatsapp";
import { HOME_COPY } from "../../../lib/home-copy";
import { setDocumentLocale, type DocumentLocale } from "../../../lib/set-document-locale";

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"] as const;

const COPY = {
  en: {
    title: "Trip",
    empty: "No stays for these dates",
    change: "Change dates",
    needWhere: "Choose a destination to search.",
    where: "Destination",
    checkIn: "Check-in",
    checkOut: "Check-out",
    adults: "Adults",
    children: "Children",
    infants: "Infants",
  },
  ar: {
    title: "رحلة",
    empty: "لا إقامات في هذه التواريخ",
    change: "غيّر التواريخ",
    needWhere: "اختر وجهة للبحث.",
    where: "الوجهة",
    checkIn: "تسجيل الوصول",
    checkOut: "تسجيل المغادرة",
    adults: "البالغون",
    children: "الأطفال",
    infants: "الرضّع",
  },
  es: {
    title: "Viaje",
    empty: "No hay estancias para estas fechas",
    change: "Cambiar fechas",
    needWhere: "Elige un destino para buscar.",
    where: "Destino",
    checkIn: "Entrada",
    checkOut: "Salida",
    adults: "Adultos",
    children: "Niños",
    infants: "Bebés",
  },
} as const;

function allowedWhere(value: string) {
  return (DESTINATIONS as readonly string[]).includes(value);
}

export function TripScreen() {
  const params = useSearchParams();
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const copy = COPY[locale];
  const where = params.get("where") ?? "";
  const checkIn = params.get("check-in") ?? "";
  const checkOut = params.get("check-out") ?? "";
  const adults = params.get("adults") ?? "";
  const children = params.get("children") ?? "";
  const infants = params.get("infants") ?? "";
  const knownWhere = allowedWhere(where);
  const fields = [
    [copy.where, where],
    [copy.checkIn, checkIn],
    [copy.checkOut, checkOut],
    [copy.adults, adults],
    [copy.children, children],
    [copy.infants, infants],
  ] as const;

  useEffect(() => {
    setDocumentLocale(locale);
  }, [locale]);

  return (
    <>
      <style>{`
        .trip-change:active { background: var(--color-accent-press); }
        @media (hover: hover) {
          .trip-change:hover { background: var(--color-accent-hover); }
        }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) {
          .trip-change {
            transition-property: background-color;
            transition-duration: 150ms;
            transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .trip-change { transition: none; }
        }
        @media (forced-colors: active) {
          .trip-change {
            border: 1px solid ButtonText;
            background: ButtonFace;
            color: ButtonText;
          }
        }
      `}</style>
      <SiteNav
        locale={locale}
        onLocale={setLocale}
        labels={HOME_COPY[locale].nav}
        markCurrent={false}
        loginHref="/login"
      />
      <main
        id="content"
        style={{
          boxSizing: "border-box",
          maxInlineSize: "var(--width-column)",
          marginInline: "auto",
          paddingBlock: "var(--spacing-2xl)",
          paddingInline: "var(--spacing-lg)",
          display: "grid",
          gap: "var(--spacing-lg)",
          justifyItems: "start",
        }}
      >
        <h1>{copy.title}</h1>
        <dl
          style={{
            display: "grid",
            gap: "var(--spacing-sm)",
            margin: 0,
          }}
        >
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gap: "var(--spacing-xs)" }}>
              <dt
                style={{
                  fontSize: "var(--text-label)",
                  lineHeight: 1.4,
                  color: "var(--color-heading)",
                }}
              >
                {label}
              </dt>
              <dd style={{ margin: 0, overflowWrap: "break-word" }}>
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        {knownWhere ? (
          <p style={{ margin: 0, textWrap: "pretty" }}>{copy.empty}</p>
        ) : (
          <p className="hero-search-notice" role="status">
            {copy.needWhere}
          </p>
        )}
        <a
          className="ui-button trip-change"
          href="/framer"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-heading)",
            borderColor: "transparent",
            borderRadius: 0,
            textDecoration: "none",
          }}
        >
          {copy.change}
        </a>
      </main>
      <WhatsApp />
    </>
  );
}
