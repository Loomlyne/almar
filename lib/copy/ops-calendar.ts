// Copy for the dashboard Calendar and its Block dates form (phase 3.2 plan 13). New file; no other copy file is edited.
//
// Strings marked CANVAS are taken verbatim from the design canvas board DashCalendar (EN, AR, ES). Every other string
// is DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES
// (neutral Latin American, formal "usted": owner decision 2026-10-14, dashboard only) are DRAFTS written from the EN, in the same practice as
// lib/copy/ops-kit.ts. Never a price, a rate or legal text. `{name}` style tokens are filled with fillCopy.
// Imported directly by the Calendar; deliberately not registered in lib/copy/index.ts.

import type { Locale3 } from "../../components/ops/api-types";

export type OpsCalendarCopy = {
  /** CANVAS (k74). The page title; the rail says the same word. */
  title: string;
  /** CANVAS (k75). The header button and the title of the form. */
  blockDates: string;
  /** CANVAS (k59). The filter's "everything" row. */
  allTargets: string;
  /** CANVAS (k63). Heading of the month's list of blocks. */
  blockedDates: string;
  /** CANVAS (k190). Under the form title. */
  blockedNote: string;
  /** CANVAS (k191). Label of the three scope cards. */
  whatToBlock: string;
  /** CANVAS (k192, k193). */
  everything: string;
  everythingDetail: string;
  /** CANVAS (k194, k195). */
  oneDestination: string;
  oneDestinationDetail: string;
  /** CANVAS (k196). */
  oneStay: string;
  /** CANVAS (k50): label of the destination list. */
  destinations: string;
  /** CANVAS (k46): label of the stay list. */
  stays: string;
  /** CANVAS (k21): label of the one date range field. The canvas draws From and To (k197, k198); see the picture notes. */
  dates: string;
  from: string;
  to: string;
  /** CANVAS (k199). The hint under the dates. */
  sameDayHint: string;
  /** CANVAS (k200). */
  reasonOptional: string;
  /** CANVAS (k44). Target name of a block that covers everything. */
  all: string;
  /** CANVAS (k67..k73), Monday first. */
  weekdays: readonly [string, string, string, string, string, string, string];
  /** CANVAS (k386), by plural form of `{n}`. `other` is required; a missing form falls back to it. */
  overlap: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

  /** DRAFT. Placeholder of the destination list. */
  chooseDestination: string;
  /** DRAFT. Placeholder of the stay list. */
  chooseStay: string;
  /** DRAFT. Accessible name of the filter, `{name}` is the chosen row. */
  filterLabel: string;
  /** DRAFT. */
  previousMonth: string;
  nextMonth: string;
  /** DRAFT. Accessible name of the month grid. */
  monthGrid: string;
  /** DRAFT. Said on a blocked day, and next to the swatch of the key under the grid. */
  blockedDay: string;
  /** DRAFT. The list when the month has no block. */
  noBlocks: string;
  /** DRAFT. Under "Blocked dates": why there is no Edit. */
  changeHint: string;
  /** DRAFT. The question before a Delete. */
  deleteTitle: string;
  deleteBody: string;
  /** DRAFT. Accessible name of one Delete, `{name}` `{dates}`. */
  deleteNamed: string;
  /** DRAFT. A form that is not complete when Block is pressed. */
  needDestination: string;
  needStay: string;
  needDates: string;
};

export const OPS_CALENDAR_COPY: Record<Locale3, OpsCalendarCopy> = {
  en: {
    title: "Calendar",
    blockDates: "Block dates",
    allTargets: "All destinations and stays",
    blockedDates: "Blocked dates",
    blockedNote: "Blocked dates cannot be booked or picked in the booking bar.",
    whatToBlock: "What to block",
    everything: "Everything",
    everythingDetail: "Every destination and stay, the full day",
    oneDestination: "One destination",
    oneDestinationDetail: "All stays connected to it",
    oneStay: "One stay",
    destinations: "Destinations",
    stays: "Stays",
    dates: "Dates",
    from: "From",
    to: "To",
    sameDayHint: "Choose the same date twice to block one day. Blocks always cover the full day.",
    reasonOptional: "Reason (optional)",
    all: "All",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    overlap: {
      one: "{n} booking overlaps these dates. Blocking does not cancel it.",
      other: "{n} bookings overlap these dates. Blocking does not cancel them.",
    },

    chooseDestination: "Choose a destination",
    chooseStay: "Choose a stay",
    filterLabel: "Show: {name}",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    monthGrid: "Days of the month",
    blockedDay: "Blocked",
    noBlocks: "No blocked dates this month.",
    changeHint: "To change a block, delete it and block again.",
    deleteTitle: "Delete this block?",
    deleteBody: "The dates can be booked again unless another block covers them.",
    deleteNamed: "Delete block {name}, {dates}",
    needDestination: "Choose a destination.",
    needStay: "Choose a stay.",
    needDates: "Choose the dates.",
  },
  ar: {
    title: "التقويم",
    blockDates: "حجب التواريخ",
    allTargets: "كل الوجهات والإقامات",
    blockedDates: "التواريخ المحجوبة",
    blockedNote: "لا يمكن حجز التواريخ المحجوبة أو اختيارها في شريط الحجز.",
    whatToBlock: "ما الذي يُحجب",
    everything: "كل شيء",
    everythingDetail: "كل الوجهات والإقامات، اليوم كاملًا",
    oneDestination: "وجهة واحدة",
    oneDestinationDetail: "كل الإقامات المرتبطة بها",
    oneStay: "إقامة واحدة",
    destinations: "الوجهات",
    stays: "الإقامات",
    dates: "التواريخ",
    from: "من",
    to: "إلى",
    sameDayHint: "اختر التاريخ نفسه مرتين لحجب يوم واحد. الحجب يشمل اليوم كاملًا دائمًا.",
    reasonOptional: "السبب (اختياري)",
    all: "الكل",
    weekdays: ["إث", "ث", "أر", "خ", "ج", "س", "أح"],
    overlap: {
      one: "يتداخل حجز واحد مع هذه التواريخ. الحجب لا يلغيه.",
      two: "يتداخل حجزان مع هذه التواريخ. الحجب لا يلغيهما.",
      few: "تتداخل {n} حجوزات مع هذه التواريخ. الحجب لا يلغيها.",
      many: "يتداخل {n} حجزًا مع هذه التواريخ. الحجب لا يلغيها.",
      other: "يتداخل {n} حجز مع هذه التواريخ. الحجب لا يلغيها.",
    },

    chooseDestination: "اختر وجهة",
    chooseStay: "اختر إقامة",
    filterLabel: "عرض: {name}",
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    monthGrid: "أيام الشهر",
    blockedDay: "محجوب",
    noBlocks: "لا توجد تواريخ محجوبة هذا الشهر.",
    changeHint: "لتغيير حجب، احذفه ثم احجب من جديد.",
    deleteTitle: "حذف هذا الحجب؟",
    deleteBody: "ستُتاح التواريخ للحجز من جديد ما لم يشملها حجب آخر.",
    deleteNamed: "حذف الحجب {name}، {dates}",
    needDestination: "اختر وجهة.",
    needStay: "اختر إقامة.",
    needDates: "اختر التواريخ.",
  },
  es: {
    title: "Calendario",
    blockDates: "Bloquear fechas",
    allTargets: "Todos los destinos y estancias",
    blockedDates: "Fechas bloqueadas",
    blockedNote: "Las fechas bloqueadas no se pueden reservar ni elegir en la barra de reserva.",
    whatToBlock: "Qué bloquear",
    everything: "Todo",
    everythingDetail: "Todos los destinos y estancias, el día completo",
    oneDestination: "Un destino",
    oneDestinationDetail: "Todas las estancias conectadas",
    oneStay: "Una estancia",
    destinations: "Destinos",
    stays: "Estancias",
    dates: "Fechas",
    from: "Desde",
    to: "Hasta",
    sameDayHint: "Elija la misma fecha dos veces para bloquear un día. El bloqueo cubre siempre el día completo.",
    reasonOptional: "Motivo (opcional)",
    all: "Todo",
    weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
    overlap: {
      one: "{n} reserva coincide con estas fechas. Bloquear no la cancela.",
      other: "{n} reservas coinciden con estas fechas. Bloquear no las cancela.",
    },

    chooseDestination: "Elija un destino",
    chooseStay: "Elija una estancia",
    filterLabel: "Mostrar: {name}",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    monthGrid: "Días del mes",
    blockedDay: "Bloqueado",
    noBlocks: "No hay fechas bloqueadas este mes.",
    changeHint: "Para cambiar un bloqueo, elimínelo y vuelva a bloquear.",
    deleteTitle: "¿Eliminar este bloqueo?",
    deleteBody: "Las fechas podrán reservarse de nuevo, salvo que otro bloqueo las cubra.",
    deleteNamed: "Eliminar el bloqueo {name}, {dates}",
    needDestination: "Elija un destino.",
    needStay: "Elija una estancia.",
    needDates: "Elija las fechas.",
  },
};

/** The overlap sentence for `n` bookings, in the plural form of the language. Never called with 0 (nothing is shown then). */
export function overlapLine(locale: Locale3, n: number): string {
  const forms = OPS_CALENDAR_COPY[locale].overlap;
  const form = new Intl.PluralRules(locale).select(n);
  return (forms[form] ?? forms.other).replace("{n}", String(n));
}

/** The month and year as the canvas writes them: October 2026, أكتوبر 2026 (Latin digits), octubre de 2026. */
export function monthTitle(locale: Locale3, year: number, month: number): string {
  const tag = locale === "ar" ? "ar-AE-u-nu-latn" : locale === "es" ? "es" : "en-GB";
  return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
