"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteNav } from "../../../components/ui/nav";
import { Link } from "../../../components/ui/link";
import { WhatsApp } from "../../../components/ui/whatsapp";
import { HOME_COPY } from "../../../lib/copy/home";
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
      <SiteNav
        locale={locale}
        onLocale={setLocale}
        labels={HOME_COPY[locale].nav}
        markCurrent={false}
        loginHref="/login"
      />
      <main
        id="content"
        className="mx-auto box-border grid w-full max-w-column justify-items-start gap-6 px-4 py-12 md:px-8 lg:px-16"
      >
        <h1 className="m-0 font-display text-display tracking-display text-teal">{copy.title}</h1>
        <dl className="m-0 grid gap-3">
          {fields.map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <dt className="text-label text-muted">
                {label}
              </dt>
              <dd className="m-0 wrap-break-word text-body text-ink">
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        {knownWhere ? (
          <p className="m-0 text-pretty text-body text-ink">{copy.empty}</p>
        ) : (
          <p className="m-0 text-pretty text-label text-muted" role="status">
            {copy.needWhere}
          </p>
        )}
        <Link href="/" className="h-control justify-center border border-teal px-6 uppercase tracking-kicker ar:normal-case ar:tracking-normal no-underline hover:bg-teal-tint hover:no-underline">{copy.change}</Link>
      </main>
      <WhatsApp />
    </>
  );
}
