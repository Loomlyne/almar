// Plan 04-06 (Task 1b): the signed-in guest's /bookings list (self-contained: not added to lib/copy/index.ts).
// Canvas lines, verbatim in EN, AR and ES from .planning/design/2026-10-01-canvas/boards/GuestBookings.dc.html:
//   upcoming (k51), past (k52), viewTrip (k62), paid (k25, used only by P6-07 option 1).
// Every other line is the plan's EN; AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American) are
// model-written DRAFTS for the owner's check at the 04-06 picture signature.
// The heading and the whole-list empty state stay in lib/copy/guest.ts (bookings, noBookingsYet, startATrip).
// No status words and no deadline line here (decision 6): chips and the deadline come from JOURNEY_COPY.

export type GuestBookingsLocale = "en" | "ar" | "es";

export type GuestBookingsCopy = {
  tabsLabel: string;
  upcoming: string;
  past: string;
  cancelled: string;
  reference: string;
  total: string;
  paid: string;
  stillDue: string;
  nothingDue: string;
  emptyUpcoming: string;
  emptyPast: string;
  emptyCancelled: string;
  loadFailed: string;
  tryAgain: string;
  viewTrip: string;
};

export const GUEST_BOOKINGS_COPY: Record<GuestBookingsLocale, GuestBookingsCopy> = {
  en: {
    tabsLabel: "Your bookings",
    upcoming: "Upcoming",
    past: "Past",
    cancelled: "Cancelled",
    reference: "Reference",
    total: "Total",
    paid: "Paid",
    stillDue: "Still due",
    nothingDue: "Nothing left to pay",
    emptyUpcoming: "No upcoming trips.",
    emptyPast: "No past trips.",
    emptyCancelled: "Nothing cancelled.",
    loadFailed: "We could not load your bookings. Try again in a moment.",
    tryAgain: "Try again",
    viewTrip: "View trip",
  },
  ar: {
    tabsLabel: "حجوزاتك",
    upcoming: "القادمة",
    past: "السابقة",
    cancelled: "الملغاة",
    reference: "المرجع",
    total: "الإجمالي",
    paid: "المدفوع",
    stillDue: "المتبقي للدفع",
    nothingDue: "لا يوجد مبلغ متبقٍ للدفع",
    emptyUpcoming: "لا توجد رحلات قادمة.",
    emptyPast: "لا توجد رحلات سابقة.",
    emptyCancelled: "لا توجد حجوزات ملغاة.",
    loadFailed: "تعذّر علينا تحميل حجوزاتك. حاول مرة أخرى بعد قليل.",
    tryAgain: "حاول مرة أخرى",
    viewTrip: "عرض الرحلة",
  },
  es: {
    tabsLabel: "Tus reservas",
    upcoming: "Próximos",
    past: "Pasados",
    cancelled: "Cancelados",
    reference: "Referencia",
    total: "Total",
    paid: "Pagado",
    stillDue: "Por pagar",
    nothingDue: "No queda nada por pagar",
    emptyUpcoming: "No hay viajes próximos.",
    emptyPast: "No hay viajes pasados.",
    emptyCancelled: "No hay nada cancelado.",
    loadFailed: "No pudimos cargar tus reservas. Inténtalo de nuevo en un momento.",
    tryAgain: "Intentar de nuevo",
    viewTrip: "Ver viaje",
  },
};
