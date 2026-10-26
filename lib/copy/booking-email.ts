// Plan 04-05 (Task 1): the words of the six booking emails. Self-contained (a granted copy slot, deliberately not
// registered in lib/copy/index.ts). EN is new copy drafted for the owner's signature at the picture gate (Task 3).
// AR (Gulf-friendly Modern Standard Arabic, right to left) and ES (neutral Latin American, "tú" as lib/copy/guest.ts)
// are MODEL-TRANSLATED DRAFTS of the EN, flagged for the owner's check; the owner notices are English only (E-11
// recommended: the dashboard is English only, owner rule 2026-10-14).
//
// Never a price, a rate, a fee amount, a deadline value, a bank value, a person or legal wording: amounts, dates,
// times, names and the reference are `{slot}`s filled with fill() (lib/journey-format.ts) by the renderers; a terms
// reference, if one is ever needed, stays `[Booking terms]`. The B-29 line says who pays the transfer fees and nothing
// about amounts. Contact facts are the ones already published (inquiries@almarprivatejourney.com, +971 56 388 3302).
//
// No status word and no "Pay by" sentence here: the guest emails read both from JOURNEY_COPY[locale].bookingStatus
// (04-03, cross-plan decision 6). The owner notices keep English dashboard words of their own (OWNER_EMAIL_COPY).
import type { PluralForms } from "../journey-format";

export type BookingEmailLocale = "en" | "ar" | "es";

/** The subject prefix of every TEST email, the same in every language (E-04). */
export const TEST_SUBJECT_PREFIX = "[TEST] ";

/** Contact facts already in the live HTML (CLAUDE.local): never invented, never changed here. */
export const BOOKING_CONTACT = Object.freeze({
  email: "inquiries@almarprivatejourney.com",
  phone: "+971 56 388 3302",
  whatsappUrl: "https://wa.me/971563883302",
});

/** The guest emails: request received, payment receipt, request lapsed. */
export type BookingEmailCopy = {
  /** E-04: the banner at the top of every TEST email (html and text). */
  testBanner: string;
  /** "{name}" = the guest's name, escaped by the shell. */
  greeting: string;
  /** "{phone}" = BOOKING_CONTACT.phone (in AR the renderer wraps it left to right). */
  help: string;
  signOff: string;
  rows: {
    reference: string;
    stay: string;
    dates: string;
    nights: string;
    guests: string;
    addons: string;
    airport: string;
    plan: string;
    total: string;
  };
  /** "{title}" and "{destination}" of the stay. */
  stayLine: string;
  /** "{name}", "{quantity}", "{amount}" of one add-on line. */
  addonLine: string;
  nightsCount: PluralForms;
  plans: { deposit: string; full: string };
  airports: { DXB: string; AUH: string; SHJ: string };
  /** "{amount}" and "{date}" (DD/MM/YYYY) of the balance on a deposit booking. */
  balanceLine: string;
  transfer: {
    heading: string;
    amount: string;
    reference: string;
    accountName: string;
    bankName: string;
    iban: string;
    swift: string;
    bankAddress: string;
    currency: string;
    note: string;
    /** "{ref}" = the booking reference. */
    referenceLine: string;
    /** B-29: who pays the transfer fees. */
    fees: string;
    /** B-28: reply with the bank receipt. */
    reply: string;
    /** R1: only an unpaid request lapses; a part payment keeps the nights. */
    lapseRule: string;
    /** E-18: the same details are on the booking page (the source of truth). */
    alsoOnPage: string;
  };
  buttons: { viewBooking: string; startAgain: string };
  requestReceived: {
    /** "{ref}" only: no guest-typed text in a subject. */
    subject: string;
    heading: string;
    /** "{ref}". */
    intro: string;
    confirmNote: string;
  };
  paymentReceipt: {
    /** "{ref}" only. */
    subject: string;
    heading: string;
    /** "{ref}". */
    intro: string;
    amountReceived: string;
    receivedOn: string;
    totalPaid: string;
    stillDue: string;
    /** Followed by the "Pay by" sentence of JOURNEY_COPY and the transfer block again. */
    partReceived: string;
    nothingMoreDue: string;
    /** E-08 (B-33): never the written-off amount or its reason. */
    acceptedAsPaid: string;
    /** E-08. */
    overpaid: string;
    /** E-08 / E-10 (B-34): money recorded after a lapse or a cancel. "{amount}". */
    moneyOnClosed: string;
    /** The job has no booking link (bookingUrl null). */
    noLink: string;
  };
  requestLapsed: {
    /** "{ref}" only. */
    subject: string;
    heading: string;
    /** "{date}", "{time}" (the deadline in UAE time), "{ref}". */
    body: string;
    startAgainLine: string;
  };
};

const EN: BookingEmailCopy = {
  testBanner: "TEST booking from the preview site. Do not send money.",
  greeting: "Hello {name},",
  help: "Questions? Reply to this email, or message us on WhatsApp at {phone}.",
  signOff: "ALMAR Private Journey",
  rows: {
    reference: "Reference",
    stay: "Stay",
    dates: "Dates",
    nights: "Nights",
    guests: "Guests",
    addons: "Add-ons",
    airport: "UAE airport",
    plan: "Payment",
    total: "Total",
  },
  stayLine: "{title}, {destination}",
  addonLine: "{name} × {quantity}: {amount}",
  nightsCount: { one: "# night", other: "# nights" },
  plans: { deposit: "Deposit", full: "Full payment" },
  airports: { DXB: "Dubai · DXB", AUH: "Abu Dhabi · AUH", SHJ: "Sharjah · SHJ" },
  balanceLine: "Balance {amount} due by {date}",
  transfer: {
    heading: "Bank transfer details",
    amount: "Amount to transfer",
    reference: "Transfer reference",
    accountName: "Account name",
    bankName: "Bank",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    bankAddress: "Bank address",
    currency: "Currency",
    note: "Note",
    referenceLine: "Put {ref} as the transfer reference.",
    fees: "All transfer fees are paid by you, the sender.",
    reply: "Reply to this email with your bank receipt.",
    lapseRule:
      "If no payment at all is recorded by then, the request lapses and its dates are released. Once part of the amount is recorded, your nights stay held.",
    alsoOnPage: "These details are also on your booking page.",
  },
  buttons: { viewBooking: "View your booking", startAgain: "Start again" },
  requestReceived: {
    subject: "Your request {ref}: how to pay by bank transfer",
    heading: "We have your request",
    intro: "Thank you. Your request {ref} is sent, and your dates are held while we wait for your bank transfer.",
    confirmNote: "We confirm your booking when the money arrives.",
  },
  paymentReceipt: {
    subject: "Payment received for {ref}",
    heading: "We have received your payment",
    intro: "Thank you. The payment below is recorded on your booking {ref}.",
    amountReceived: "Amount received",
    receivedOn: "Received on",
    totalPaid: "Total paid",
    stillDue: "Still to transfer",
    partReceived: "Part of the amount has been received. Please transfer the rest by the time below.",
    nothingMoreDue: "Nothing more is due.",
    acceptedAsPaid: "The amount received was accepted as paid.",
    overpaid: "We received more than the total. We will contact you about the difference.",
    moneyOnClosed: "We have received {amount}. We will contact you about it.",
    noLink: "The link to your booking page is in the email we sent with your request.",
  },
  requestLapsed: {
    subject: "Your request {ref} has lapsed",
    heading: "Your request has lapsed",
    body: "No payment was recorded by {date}, {time} UAE time, so your request {ref} has lapsed and its dates are free again.",
    startAgainLine: "You are welcome to send a new request from the stay page.",
  },
};

const AR: BookingEmailCopy = {
  testBanner: "حجز تجريبي (TEST) من موقع المعاينة. لا ترسل أي مبلغ.",
  greeting: "مرحبًا {name}،",
  help: "لأي سؤال، ردّ على هذا البريد أو راسلنا عبر واتساب على {phone}.",
  signOff: "ALMAR Private Journey",
  rows: {
    reference: "المرجع",
    stay: "الإقامة",
    dates: "التواريخ",
    nights: "الليالي",
    guests: "الضيوف",
    addons: "الإضافات",
    airport: "مطار الإمارات",
    plan: "الدفع",
    total: "الإجمالي",
  },
  stayLine: "{title}، {destination}",
  addonLine: "{name} × {quantity}: {amount}",
  nightsCount: {
    zero: "# ليلة",
    one: "ليلة واحدة",
    two: "ليلتان",
    few: "# ليالٍ",
    many: "# ليلة",
    other: "# ليلة",
  },
  plans: { deposit: "عربون", full: "الدفع الكامل" },
  airports: { DXB: "دبي · DXB", AUH: "أبوظبي · AUH", SHJ: "الشارقة · SHJ" },
  balanceLine: "الرصيد {amount} مستحق في موعد أقصاه {date}",
  transfer: {
    heading: "بيانات التحويل البنكي",
    amount: "المبلغ المطلوب تحويله",
    reference: "مرجع الحوالة",
    accountName: "اسم الحساب",
    bankName: "البنك",
    iban: "رقم الآيبان (IBAN)",
    swift: "رمز السويفت (SWIFT / BIC)",
    bankAddress: "عنوان البنك",
    currency: "العملة",
    note: "ملاحظة",
    referenceLine: "اكتب {ref} مرجعًا للحوالة.",
    fees: "يتحمّل المرسل، أي أنت، جميع رسوم التحويل.",
    reply: "ردّ على هذا البريد وأرفق إيصال التحويل البنكي.",
    lapseRule:
      "إذا لم يُسجَّل أي دفع حتى ذلك الموعد، تنتهي مهلة الطلب وتُتاح تواريخه من جديد. وبمجرد تسجيل جزء من المبلغ، تبقى لياليك محجوزة.",
    alsoOnPage: "تجد هذه البيانات أيضًا في صفحة حجزك.",
  },
  buttons: { viewBooking: "عرض حجزك", startAgain: "ابدأ من جديد" },
  requestReceived: {
    subject: "طلبك {ref}: طريقة الدفع بالتحويل البنكي",
    heading: "وصلنا طلبك",
    intro: "شكرًا لك. أُرسل طلبك {ref}، وتواريخك محجوزة بانتظار تحويلك البنكي.",
    confirmNote: "نؤكد حجزك عند وصول المبلغ.",
  },
  paymentReceipt: {
    subject: "استلمنا دفعة للحجز {ref}",
    heading: "استلمنا دفعتك",
    intro: "شكرًا لك. سُجّلت الدفعة أدناه على حجزك {ref}.",
    amountReceived: "المبلغ المستلَم",
    receivedOn: "تاريخ الاستلام",
    totalPaid: "إجمالي المدفوع",
    stillDue: "المتبقي للتحويل",
    partReceived: "استلمنا جزءًا من المبلغ. يُرجى تحويل الباقي قبل الموعد أدناه.",
    nothingMoreDue: "لا يوجد أي مبلغ مستحق آخر.",
    acceptedAsPaid: "قُبل المبلغ المستلَم بوصفه مدفوعًا.",
    overpaid: "استلمنا أكثر من الإجمالي، وسنتواصل معك بشأن الفرق.",
    moneyOnClosed: "استلمنا {amount}، وسنتواصل معك بشأنه.",
    noLink: "تجد رابط صفحة حجزك في البريد الذي أرسلناه إليك مع طلبك.",
  },
  requestLapsed: {
    subject: "انتهت مهلة طلبك {ref}",
    heading: "انتهت مهلة طلبك",
    body: "لم يُسجَّل أي دفع حتى {date}، {time} بتوقيت الإمارات، لذا انتهت مهلة طلبك {ref} وأصبحت تواريخه متاحة من جديد.",
    startAgainLine: "يسعدنا أن ترسل طلبًا جديدًا من صفحة الإقامة.",
  },
};

const ES: BookingEmailCopy = {
  testBanner: "Reserva de prueba (TEST) del sitio de vista previa. No envíes dinero.",
  greeting: "Hola, {name}:",
  help: "¿Tienes preguntas? Responde a este correo o escríbenos por WhatsApp al {phone}.",
  signOff: "ALMAR Private Journey",
  rows: {
    reference: "Referencia",
    stay: "Estancia",
    dates: "Fechas",
    nights: "Noches",
    guests: "Huéspedes",
    addons: "Extras",
    airport: "Aeropuerto de los EAU",
    plan: "Pago",
    total: "Total",
  },
  stayLine: "{title}, {destination}",
  addonLine: "{name} × {quantity}: {amount}",
  nightsCount: { one: "# noche", other: "# noches" },
  plans: { deposit: "Depósito", full: "Pago total" },
  airports: { DXB: "Dubái · DXB", AUH: "Abu Dabi · AUH", SHJ: "Sharjah · SHJ" },
  balanceLine: "Saldo de {amount}, a pagar a más tardar el {date}",
  transfer: {
    heading: "Datos para la transferencia bancaria",
    amount: "Monto a transferir",
    reference: "Referencia de la transferencia",
    accountName: "Nombre de la cuenta",
    bankName: "Banco",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    bankAddress: "Dirección del banco",
    currency: "Moneda",
    note: "Nota",
    referenceLine: "Pon {ref} como referencia de la transferencia.",
    fees: "Todas las comisiones de la transferencia las paga quien envía, es decir, tú.",
    reply: "Responde a este correo con tu comprobante bancario.",
    lapseRule:
      "Si para entonces no se registra ningún pago, la solicitud vence y sus fechas se liberan. En cuanto se registre una parte del monto, tus noches siguen reservadas.",
    alsoOnPage: "Estos datos también están en la página de tu reserva.",
  },
  buttons: { viewBooking: "Ver tu reserva", startAgain: "Empezar de nuevo" },
  requestReceived: {
    subject: "Tu solicitud {ref}: cómo pagar por transferencia bancaria",
    heading: "Recibimos tu solicitud",
    intro: "Gracias. Tu solicitud {ref} está enviada y tus fechas quedan reservadas mientras esperamos tu transferencia.",
    confirmNote: "Confirmamos tu reserva cuando llegue el dinero.",
  },
  paymentReceipt: {
    subject: "Pago recibido para {ref}",
    heading: "Recibimos tu pago",
    intro: "Gracias. El pago de abajo quedó registrado en tu reserva {ref}.",
    amountReceived: "Monto recibido",
    receivedOn: "Recibido el",
    totalPaid: "Total pagado",
    stillDue: "Falta transferir",
    partReceived: "Recibimos una parte del monto. Transfiere el resto antes de la hora indicada abajo.",
    nothingMoreDue: "No queda nada pendiente de pago.",
    acceptedAsPaid: "El monto recibido se aceptó como pagado.",
    overpaid: "Recibimos más que el total. Te contactaremos por la diferencia.",
    moneyOnClosed: "Recibimos {amount}. Te contactaremos al respecto.",
    noLink: "El enlace a la página de tu reserva está en el correo que te enviamos con tu solicitud.",
  },
  requestLapsed: {
    subject: "Tu solicitud {ref} venció",
    heading: "Tu solicitud venció",
    body: "No se registró ningún pago antes del {date}, {time}, hora de los EAU, así que tu solicitud {ref} venció y sus fechas vuelven a estar libres.",
    startAgainLine: "Puedes enviar una nueva solicitud desde la página de la estancia.",
  },
};

export const BOOKING_EMAIL_COPY: Record<BookingEmailLocale, BookingEmailCopy> = { en: EN, ar: AR, es: ES };

// ---------------------------------------------------------------- owner notices to inquiries@ (English, E-11)

type OwnerStatusWords = {
  held: string;
  awaiting_payment: string;
  deposit_paid: string;
  paid_in_full: string;
  confirmed: string;
  completed: string;
  cancelled: string;
  expired: string;
};

/** The owner's request, payment and withdrawn notices. No bank value and no guest booking link ever goes in one. */
export type OwnerEmailCopy = {
  /** E-04, the same banner the guest emails carry. */
  testBanner: string;
  request: { subject: string; heading: string; intro: string };
  payment: { subject: string; heading: string; intro: string };
  /** R2 (E-30): the guest withdrew an unpaid request on the booking page. */
  withdrawn: { subject: string; heading: string; line: string };
  rows: {
    reference: string;
    guest: string;
    email: string;
    language: string;
    stay: string;
    dates: string;
    nights: string;
    guests: string;
    plan: string;
    total: string;
    dueNow: string;
    deadline: string;
    amount: string;
    receivedOn: string;
    recordedBy: string;
    statusChange: string;
    paidTotal: string;
    stillDue: string;
    attention: string;
  };
  /** "{title}" and "{slug}": the stay as the guest saw it, plus its slug. */
  stayValue: string;
  /** "{before}" and "{after}" in the status words below. */
  statusChangeValue: string;
  /** "{date}" and "{time}" of the deadline in UAE time. */
  deadlineValue: string;
  /** The recorder's email is not known. */
  notRecorded: string;
  none: string;
  languageNames: { en: string; ar: string; es: string };
  plans: { deposit: string; full: string };
  /** The dashboard's English status words (lib/copy/ops-bookings.ts), kept here so the notices import no dashboard file. */
  statusWords: OwnerStatusWords;
  /** R1's check list (04-09); nothing writes expired_with_payment any more, so it has no word. */
  attentionWords: {
    paid_after_expiry: string;
    paid_after_cancel: string;
    overpaid: string;
    deadline_passed_part_paid: string;
  };
  /** The button to https://dashboard.almarprivatejourney.com/bookings/detail?ref=<ref>. */
  dashboardButton: string;
  /** The guest is the reply-to of the request and payment notices. */
  replyNote: string;
};

export const OWNER_EMAIL_COPY: OwnerEmailCopy = {
  testBanner: "TEST booking from the preview site. Do not send money.",
  request: {
    subject: "New request: {ref}",
    heading: "New booking request",
    intro: "A guest sent a booking request on the site. The bank details went to the guest only.",
  },
  payment: {
    subject: "Payment recorded: {ref}",
    heading: "A payment was recorded",
    intro: "A payment was recorded on this booking in the dashboard.",
  },
  withdrawn: {
    subject: "Request withdrawn: {ref}",
    heading: "The guest withdrew this request",
    line: "The nights are free again.",
  },
  rows: {
    reference: "Reference",
    guest: "Guest",
    email: "Email",
    language: "Language",
    stay: "Stay",
    dates: "Dates",
    nights: "Nights",
    guests: "Guests",
    plan: "Plan",
    total: "Total",
    dueNow: "Due now",
    deadline: "Pay-by time",
    amount: "Amount",
    receivedOn: "Received on",
    recordedBy: "Recorded by",
    statusChange: "Status",
    paidTotal: "Paid in total",
    stillDue: "Still due",
    attention: "Needs attention",
  },
  stayValue: "{title} ({slug})",
  statusChangeValue: "{before} → {after}",
  deadlineValue: "{date}, {time} UAE time",
  notRecorded: "Not recorded",
  none: "None",
  languageNames: { en: "English", ar: "Arabic", es: "Spanish" },
  plans: { deposit: "Deposit", full: "Full payment" },
  statusWords: {
    held: "Held",
    awaiting_payment: "Awaiting payment",
    deposit_paid: "Deposit paid",
    paid_in_full: "Paid in full",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Expired",
  },
  attentionWords: {
    paid_after_expiry: "Paid after the request expired",
    paid_after_cancel: "Paid after the booking was cancelled",
    overpaid: "Overpaid",
    deadline_passed_part_paid: "Pay-by date passed, part paid",
  },
  dashboardButton: "Open in the dashboard",
  replyNote: "Reply to this email to write to the guest.",
};
