// Plan 04-05 (Task 2): the words of the guest booking page /bookings/trip (and /ar, /es), every state. Self-contained
// (a granted copy slot, deliberately not registered in lib/copy/index.ts). EN is new copy drafted for the owner's
// signature at the picture gate (Task 3); the R2 and R1 keys (withdraw*, contact*, partPaidLate) are the plan's EN
// verbatim. AR (Gulf-friendly Modern Standard Arabic, right to left) and ES (neutral Latin American, "tú" as
// lib/copy/guest.ts) are MODEL-TRANSLATED DRAFTS of the EN, flagged for the owner's check.
// Exception: the strings marked CANVAS are the GuestTrip board's (k58, k65, k67, k89, k90, k92-k97), verbatim in all
// three languages; `[RATE]` in k93 is filled with the booking's VAT rate (formatBp) on the page.
//
// Never a price, a rate, a fee amount, a deadline value, a bank value, a person or legal wording: amounts, dates, times,
// names and the reference are `{slot}`s filled with fill() (lib/journey-format.ts). No status word and no "Pay by"
// sentence here: the page reads both from JOURNEY_COPY[locale].bookingStatus (04-03, cross-plan decision 6).
import type { PluralForms } from "../journey-format";

export type BookingPageLocale = "en" | "ar" | "es";

export type BookingPageCopy = {
  /** The document title (bookingPageMetadata). */
  pageTitle: string;
  heading: string;
  /** CANVAS k58: the back link to /bookings, shown only to a signed-in guest without a link token. */
  backToBookings: string;
  reference: string;
  /** E-04: the banner on a TEST booking page (the preview host). */
  testBanner: string;
  loading: string;
  noscript: string;
  notFound: string;
  /** E-15: only when the URL has no link token. */
  notFoundSignIn: string;
  logIn: string;
  unavailable: string;
  tryAgain: string;
  toastDismiss: string;
  dates: string;
  nightsCount: PluralForms;
  guests: string;
  /** CANVAS k65. */
  stay: string;
  /** CANVAS k67: before Confirmed (BOOK-08, OPS-10). */
  addressPending: string;
  /** Shown only for Confirmed and Completed bookings, never in an email. */
  arrival: {
    heading: string;
    address: string;
    wifiName: string;
    wifiPassword: string;
    doorCode: string;
    notes: string;
  };
  travellers: {
    heading: string;
    adult: string;
    /** "{age}". */
    child: string;
    /** "{age}". */
    infant: string;
    booker: string;
    notStaying: string;
  };
  addons: {
    heading: string;
    /** "{name}" and "{quantity}". */
    line: string;
  };
  airport: {
    heading: string;
    names: { DXB: string; AUH: string; SHJ: string };
    pickup: string;
  };
  money: {
    heading: string;
    nights: string;
    addons: string;
    /** CANVAS k92. */
    subtotal: string;
    /** CANVAS k93: `[RATE]` is replaced with the booking's VAT rate. */
    vat: string;
    /** CANVAS k94. */
    total: string;
    plan: string;
    planDeposit: string;
    planFull: string;
    depositAmount: string;
    /** CANVAS k95. */
    paid: string;
    stillDue: string;
    nothingMoreDue: string;
    /** CANVAS k89. */
    balanceDue: string;
    /** CANVAS k90. */
    balanceDueBy: string;
    /** "{amount}" and "{date}" (DD/MM/YYYY). */
    balanceLine: string;
  };
  payments: {
    heading: string;
    receivedOn: string;
    method: string;
    amount: string;
    /** E-12. */
    bankTransfer: string;
    /** E-12: any other method (no card wording in Phase 4, PAY-07). */
    other: string;
    dateNotRecorded: string;
  };
  transfer: {
    heading: string;
    amount: string;
    /** "{date}" (DD/MM/YYYY): the balance due date, fixed text (E-14). */
    dueBy: string;
    reference: string;
    accountName: string;
    bankName: string;
    iban: string;
    swift: string;
    bankAddress: string;
    currency: string;
    note: string;
    /** "{ref}". */
    referenceLine: string;
    /** B-29. */
    fees: string;
    /** B-28. */
    reply: string;
    /** E-18, the page side. */
    alsoInEmail: string;
  };
  /** E-07: the copy buttons beside the reference and the IBAN (hidden in print). */
  copyValue: {
    copyReference: string;
    copyIban: string;
    copied: string;
    failed: string;
  };
  flags: {
    partReceived: string;
    /** E-08 (B-33). */
    acceptedAsPaid: string;
    /** E-08. */
    overpaid: string;
    /** E-08 (B-34): "{amount}". */
    moneyOnClosed: string;
  };
  /** E-09: a held booking (not requested yet). */
  notSent: {
    line: string;
    /** "{date}" and "{time}" of holdExpiresAt in UAE time. */
    heldUntil: string;
    finish: string;
  };
  expired: {
    line: string;
    startAgain: string;
  };
  concierge: {
    /** CANVAS k96. */
    heading: string;
    /** CANVAS k97. */
    line: string;
    whatsapp: string;
    email: string;
  };
  // R2 (P-19 changed, owner 2026-10-20) and R1 (P-09 changed): EN exactly as the plan types them.
  withdrawHint: string;
  withdrawAction: string;
  withdrawConfirmTitle: string;
  withdrawConfirmBody: string;
  withdrawConfirmAction: string;
  withdrawKeep: string;
  withdrawFailed: string;
  withdrawRetry: string;
  withdrawDone: string;
  withdrawStartAgain: string;
  withdrawRefusedPartPaid: string;
  withdrawRefusedNotWithdrawable: string;
  contactToChange: string;
  contactWhatsapp: string;
  /** "{date}" and "{time}" of the passed deadline, filled as fill(copy.partPaidLate, uaeDateTime(deadline)). */
  partPaidLate: string;
};

const EN: BookingPageCopy = {
  pageTitle: "Your booking",
  heading: "Your booking",
  backToBookings: "Bookings", // CANVAS k58
  reference: "Reference",
  testBanner: "TEST booking from the preview site. Do not send money.",
  loading: "Loading your booking…",
  noscript: "Turn on JavaScript in your browser to see your booking.",
  notFound: "We could not find this booking.",
  notFoundSignIn: "If this is your booking, open the link in your email or sign in with the email you booked with.",
  logIn: "Log in",
  unavailable: "We could not load your booking right now.",
  tryAgain: "Try again",
  toastDismiss: "Dismiss",
  dates: "Dates",
  nightsCount: { one: "# night", other: "# nights" },
  guests: "Guests",
  stay: "Your stay", // CANVAS k65
  addressPending: "Exact address after confirmation.", // CANVAS k67
  arrival: {
    heading: "Arrival details",
    address: "Address",
    wifiName: "Wi-Fi name",
    wifiPassword: "Wi-Fi password",
    doorCode: "Door code",
    notes: "Arrival notes",
  },
  travellers: {
    heading: "Travellers",
    adult: "Adult",
    child: "Child, age {age}",
    infant: "Infant, age {age}",
    booker: "Booking",
    notStaying: "Not staying",
  },
  addons: { heading: "Add-ons", line: "{name} × {quantity}" },
  airport: {
    heading: "UAE airport",
    names: { DXB: "Dubai · DXB", AUH: "Abu Dhabi · AUH", SHJ: "Sharjah · SHJ" },
    pickup: "Pickup address",
  },
  money: {
    heading: "Payment summary",
    nights: "Nights",
    addons: "Add-ons",
    subtotal: "Subtotal", // CANVAS k92
    vat: "VAT [RATE]%", // CANVAS k93
    total: "Total", // CANVAS k94
    plan: "Payment plan",
    planDeposit: "Deposit",
    planFull: "Full payment",
    depositAmount: "Deposit amount",
    paid: "Paid", // CANVAS k95
    stillDue: "Still due",
    nothingMoreDue: "Nothing more is due.",
    balanceDue: "Balance due", // CANVAS k89
    balanceDueBy: "Balance due by", // CANVAS k90
    balanceLine: "Balance {amount} due by {date}",
  },
  payments: {
    heading: "Payments received",
    receivedOn: "Received on",
    method: "Method",
    amount: "Amount",
    bankTransfer: "Bank transfer",
    other: "Payment",
    dateNotRecorded: "Date not recorded",
  },
  transfer: {
    heading: "How to pay by bank transfer",
    amount: "Amount to transfer",
    dueBy: "Transfer by {date}",
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
    reply: "Reply to the email we sent you with your bank receipt.",
    alsoInEmail: "These details are also in the email we sent you.",
  },
  copyValue: {
    copyReference: "Copy reference",
    copyIban: "Copy IBAN",
    copied: "Copied",
    failed: "Could not copy. Select the text and copy it yourself.",
  },
  flags: {
    partReceived: "Part of the amount has been received. The rest is shown below.",
    acceptedAsPaid: "The amount received was accepted as paid.",
    overpaid: "We received more than the total. We will contact you about the difference.",
    moneyOnClosed: "We have received {amount}. We will contact you about it.",
  },
  notSent: {
    line: "This request has not been sent yet.",
    heldUntil: "Your dates are held until {date}, {time} UAE time.",
    finish: "Finish your request",
  },
  expired: {
    line: "No payment was recorded by the pay-by time, so this request lapsed and its dates are free again.",
    startAgain: "Start again from the stay page",
  },
  concierge: {
    heading: "Your concierge", // CANVAS k96
    line: "Message us about anything on this trip.", // CANVAS k97
    whatsapp: "WhatsApp",
    email: "Email",
  },
  withdrawHint: "You can withdraw this request until a payment is recorded. If you withdraw, its nights are released at once.",
  withdrawAction: "Withdraw request",
  withdrawConfirmTitle: "Withdraw this request?",
  withdrawConfirmBody:
    "The nights are released at once and this request cannot be restored. To book later, send a new request.",
  withdrawConfirmAction: "Withdraw request",
  withdrawKeep: "Keep my request",
  withdrawFailed: "We could not confirm the withdrawal. Please try again: trying again is safe.",
  withdrawRetry: "Try again",
  withdrawDone: "Your request is withdrawn. The nights are free again.",
  withdrawStartAgain: "Start again from the stay page",
  withdrawRefusedPartPaid:
    "A payment was recorded on this request in the meantime, so it can no longer be withdrawn here.",
  withdrawRefusedNotWithdrawable: "This request can no longer be withdrawn here.",
  contactToChange: "To change or cancel this request, contact us:",
  contactWhatsapp: "WhatsApp",
  partPaidLate:
    "The pay-by date, {date} at {time} UAE time, has passed. Your nights are still held, and we will contact you.",
};

const AR: BookingPageCopy = {
  pageTitle: "حجزك",
  heading: "حجزك",
  backToBookings: "الحجوزات", // CANVAS k58
  reference: "المرجع",
  testBanner: "حجز تجريبي (TEST) من موقع المعاينة. لا ترسل أي مبلغ.",
  loading: "جارٍ تحميل حجزك…",
  noscript: "فعّل JavaScript في متصفحك لعرض حجزك.",
  notFound: "لم نعثر على هذا الحجز.",
  notFoundSignIn: "إذا كان هذا حجزك، فافتح الرابط الموجود في بريدك أو سجّل الدخول بالبريد الذي حجزت به.",
  logIn: "تسجيل الدخول",
  unavailable: "تعذّر تحميل حجزك الآن.",
  tryAgain: "حاول مرة أخرى",
  toastDismiss: "إغلاق",
  dates: "التواريخ",
  nightsCount: {
    zero: "# ليلة",
    one: "ليلة واحدة",
    two: "ليلتان",
    few: "# ليالٍ",
    many: "# ليلة",
    other: "# ليلة",
  },
  guests: "الضيوف",
  stay: "إقامتك", // CANVAS k65
  addressPending: "العنوان الدقيق بعد التأكيد.", // CANVAS k67
  arrival: {
    heading: "تفاصيل الوصول",
    address: "العنوان",
    wifiName: "اسم شبكة الواي فاي",
    wifiPassword: "كلمة مرور الواي فاي",
    doorCode: "رمز الباب",
    notes: "ملاحظات الوصول",
  },
  travellers: {
    heading: "المسافرون",
    adult: "بالغ",
    child: "طفل، العمر {age}",
    infant: "رضيع، العمر {age}",
    booker: "صاحب الحجز",
    notStaying: "لا يقيم",
  },
  addons: { heading: "الإضافات", line: "{name} × {quantity}" },
  airport: {
    heading: "مطار الإمارات",
    names: { DXB: "دبي · DXB", AUH: "أبوظبي · AUH", SHJ: "الشارقة · SHJ" },
    pickup: "عنوان الاستقبال",
  },
  money: {
    heading: "ملخص الدفع",
    nights: "الليالي",
    addons: "الإضافات",
    subtotal: "المجموع الفرعي", // CANVAS k92
    vat: "ضريبة القيمة المضافة [RATE]٪", // CANVAS k93
    total: "الإجمالي", // CANVAS k94
    plan: "خطة الدفع",
    planDeposit: "عربون",
    planFull: "الدفع الكامل",
    depositAmount: "قيمة العربون",
    paid: "المدفوع", // CANVAS k95
    stillDue: "المتبقي",
    nothingMoreDue: "لا يوجد أي مبلغ مستحق آخر.",
    balanceDue: "الرصيد المستحق", // CANVAS k89
    balanceDueBy: "الرصيد مستحق قبل", // CANVAS k90
    balanceLine: "الرصيد {amount} مستحق في موعد أقصاه {date}",
  },
  payments: {
    heading: "الدفعات المستلَمة",
    receivedOn: "تاريخ الاستلام",
    method: "الطريقة",
    amount: "المبلغ",
    bankTransfer: "تحويل بنكي",
    other: "دفعة",
    dateNotRecorded: "التاريخ غير مسجَّل",
  },
  transfer: {
    heading: "طريقة الدفع بالتحويل البنكي",
    amount: "المبلغ المطلوب تحويله",
    dueBy: "حوّل المبلغ في موعد أقصاه {date}",
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
    reply: "ردّ على البريد الذي أرسلناه إليك وأرفق إيصال التحويل البنكي.",
    alsoInEmail: "تجد هذه البيانات أيضًا في البريد الذي أرسلناه إليك.",
  },
  copyValue: {
    copyReference: "نسخ المرجع",
    copyIban: "نسخ الآيبان",
    copied: "تم النسخ",
    failed: "تعذّر النسخ. حدّد النص وانسخه بنفسك.",
  },
  flags: {
    partReceived: "استلمنا جزءًا من المبلغ. تجد الباقي أدناه.",
    acceptedAsPaid: "قُبل المبلغ المستلَم بوصفه مدفوعًا.",
    overpaid: "استلمنا أكثر من الإجمالي، وسنتواصل معك بشأن الفرق.",
    moneyOnClosed: "استلمنا {amount}، وسنتواصل معك بشأنه.",
  },
  notSent: {
    line: "لم يُرسَل هذا الطلب بعد.",
    heldUntil: "تواريخك محجوزة حتى {date}، {time} بتوقيت الإمارات.",
    finish: "أكمل طلبك",
  },
  expired: {
    line: "لم يُسجَّل أي دفع حتى موعد الدفع، لذا انتهت مهلة هذا الطلب وأصبحت تواريخه متاحة من جديد.",
    startAgain: "ابدأ من جديد من صفحة الإقامة",
  },
  concierge: {
    heading: "الكونسيرج الخاص بك", // CANVAS k96
    line: "راسلنا بشأن أي شيء يخص هذه الرحلة.", // CANVAS k97
    whatsapp: "واتساب",
    email: "البريد الإلكتروني",
  },
  withdrawHint: "يمكنك سحب هذا الطلب ما دام لم يُسجَّل أي دفع. وعند سحبه، تُتاح لياليه فورًا.",
  withdrawAction: "سحب الطلب",
  withdrawConfirmTitle: "هل تريد سحب هذا الطلب؟",
  withdrawConfirmBody: "تُتاح الليالي فورًا ولا يمكن استعادة هذا الطلب. للحجز في وقت لاحق، أرسل طلبًا جديدًا.",
  withdrawConfirmAction: "سحب الطلب",
  withdrawKeep: "الإبقاء على طلبي",
  withdrawFailed: "تعذّر علينا تأكيد السحب. يُرجى المحاولة مرة أخرى، فإعادة المحاولة آمنة.",
  withdrawRetry: "حاول مرة أخرى",
  withdrawDone: "سُحب طلبك. أصبحت الليالي متاحة من جديد.",
  withdrawStartAgain: "ابدأ من جديد من صفحة الإقامة",
  withdrawRefusedPartPaid: "سُجّلت دفعة على هذا الطلب في هذه الأثناء، لذا لم يعد بالإمكان سحبه من هنا.",
  withdrawRefusedNotWithdrawable: "لم يعد بالإمكان سحب هذا الطلب من هنا.",
  contactToChange: "لتعديل هذا الطلب أو إلغائه، تواصل معنا:",
  contactWhatsapp: "WhatsApp",
  partPaidLate: "مضى موعد الدفع، {date} الساعة {time} بتوقيت الإمارات. لا تزال لياليك محجوزة، وسنتواصل معك.",
};

const ES: BookingPageCopy = {
  pageTitle: "Tu reserva",
  heading: "Tu reserva",
  backToBookings: "Reservas", // CANVAS k58
  reference: "Referencia",
  testBanner: "Reserva de prueba (TEST) del sitio de vista previa. No envíes dinero.",
  loading: "Cargando tu reserva…",
  noscript: "Activa JavaScript en tu navegador para ver tu reserva.",
  notFound: "No encontramos esta reserva.",
  notFoundSignIn: "Si esta es tu reserva, abre el enlace de tu correo o inicia sesión con el correo con el que reservaste.",
  logIn: "Iniciar sesión",
  unavailable: "No pudimos cargar tu reserva en este momento.",
  tryAgain: "Intentar de nuevo",
  toastDismiss: "Cerrar",
  dates: "Fechas",
  nightsCount: { one: "# noche", other: "# noches" },
  guests: "Huéspedes",
  stay: "Tu estancia", // CANVAS k65
  addressPending: "Dirección exacta tras la confirmación.", // CANVAS k67
  arrival: {
    heading: "Detalles de llegada",
    address: "Dirección",
    wifiName: "Nombre del wifi",
    wifiPassword: "Contraseña del wifi",
    doorCode: "Código de la puerta",
    notes: "Notas de llegada",
  },
  travellers: {
    heading: "Viajeros",
    adult: "Adulto",
    child: "Niño, edad {age}",
    infant: "Bebé, edad {age}",
    booker: "Quien reserva",
    notStaying: "No se aloja",
  },
  addons: { heading: "Extras", line: "{name} × {quantity}" },
  airport: {
    heading: "Aeropuerto de los EAU",
    names: { DXB: "Dubái · DXB", AUH: "Abu Dabi · AUH", SHJ: "Sharjah · SHJ" },
    pickup: "Dirección de recogida",
  },
  money: {
    heading: "Resumen del pago",
    nights: "Noches",
    addons: "Extras",
    subtotal: "Subtotal", // CANVAS k92
    vat: "IVA [RATE]%", // CANVAS k93
    total: "Total", // CANVAS k94
    plan: "Plan de pago",
    planDeposit: "Depósito",
    planFull: "Pago total",
    depositAmount: "Monto del depósito",
    paid: "Pagado", // CANVAS k95
    stillDue: "Pendiente",
    nothingMoreDue: "No queda nada pendiente de pago.",
    balanceDue: "Saldo pendiente", // CANVAS k89
    balanceDueBy: "Saldo pendiente antes del", // CANVAS k90
    balanceLine: "Saldo de {amount}, a pagar a más tardar el {date}",
  },
  payments: {
    heading: "Pagos recibidos",
    receivedOn: "Recibido el",
    method: "Método",
    amount: "Monto",
    bankTransfer: "Transferencia bancaria",
    other: "Pago",
    dateNotRecorded: "Fecha no registrada",
  },
  transfer: {
    heading: "Cómo pagar por transferencia bancaria",
    amount: "Monto a transferir",
    dueBy: "Transfiere a más tardar el {date}",
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
    reply: "Responde al correo que te enviamos con tu comprobante bancario.",
    alsoInEmail: "Estos datos también están en el correo que te enviamos.",
  },
  copyValue: {
    copyReference: "Copiar referencia",
    copyIban: "Copiar IBAN",
    copied: "Copiado",
    failed: "No se pudo copiar. Selecciona el texto y cópialo tú.",
  },
  flags: {
    partReceived: "Recibimos una parte del monto. El resto aparece abajo.",
    acceptedAsPaid: "El monto recibido se aceptó como pagado.",
    overpaid: "Recibimos más que el total. Te contactaremos por la diferencia.",
    moneyOnClosed: "Recibimos {amount}. Te contactaremos al respecto.",
  },
  notSent: {
    line: "Esta solicitud aún no se ha enviado.",
    heldUntil: "Tus fechas están reservadas hasta el {date}, {time}, hora de los EAU.",
    finish: "Termina tu solicitud",
  },
  expired: {
    line: "No se registró ningún pago antes de la fecha límite, así que esta solicitud venció y sus fechas vuelven a estar libres.",
    startAgain: "Empezar de nuevo desde la página de la estancia",
  },
  concierge: {
    heading: "Tu conserje", // CANVAS k96
    line: "Escríbenos sobre cualquier cosa de este viaje.", // CANVAS k97
    whatsapp: "WhatsApp",
    email: "Correo",
  },
  withdrawHint:
    "Puedes retirar esta solicitud mientras no se registre un pago. Si la retiras, sus noches se liberan de inmediato.",
  withdrawAction: "Retirar solicitud",
  withdrawConfirmTitle: "¿Retirar esta solicitud?",
  withdrawConfirmBody:
    "Las noches se liberan de inmediato y esta solicitud no se puede recuperar. Para reservar más adelante, envía una nueva solicitud.",
  withdrawConfirmAction: "Retirar solicitud",
  withdrawKeep: "Mantener mi solicitud",
  withdrawFailed: "No pudimos confirmar el retiro. Inténtalo de nuevo: volver a intentarlo es seguro.",
  withdrawRetry: "Intentar de nuevo",
  withdrawDone: "Tu solicitud está retirada. Las noches vuelven a estar libres.",
  withdrawStartAgain: "Empezar de nuevo desde la página de la estancia",
  withdrawRefusedPartPaid: "Mientras tanto se registró un pago en esta solicitud, así que ya no se puede retirar aquí.",
  withdrawRefusedNotWithdrawable: "Esta solicitud ya no se puede retirar aquí.",
  contactToChange: "Para cambiar o cancelar esta solicitud, contáctanos:",
  contactWhatsapp: "WhatsApp",
  partPaidLate:
    "La fecha límite de pago, el {date} a las {time}, hora de los EAU, ya pasó. Tus noches siguen reservadas y te contactaremos.",
};

export const BOOKING_PAGE_COPY: Record<BookingPageLocale, BookingPageCopy> = { en: EN, ar: AR, es: ES };
