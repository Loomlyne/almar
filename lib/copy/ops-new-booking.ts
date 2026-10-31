// Phase 5 plan 05-02: every word of the owner's New booking screen (/dashboard/bookings/new), in English, Arabic and Spanish.
// Imported only by the screen files under app/dashboard/(ops)/bookings/new/: never from lib/ops or app/api, and not registered
// in lib/copy/index.ts, so it stays in the browser-only chunk (Worker size).
//
// Strings marked CANVAS are taken verbatim, in all three languages, from the DICT of the canvas boards DashNewBookingA and
// DashNewBookingB (.planning/design/2026-10-01-canvas/boards). Every other EN string is new copy shown on the plan-gate
// pictures for the owner's signature. New Arabic and Spanish are model-translated DRAFTS written from the English for the
// owner's review; dashboard Spanish is the formal "usted" (owner, 2026-10-14). Airport names are those of
// lib/copy/booking-email.ts (`airports`), copied. The language names are English, العربية and Español in every language.
// Never a price, a rate, a fee or a legal sentence: amounts and days come through formatAed and the server's answer;
// `{token}`s are filled with fillCopy (lib/copy/ops-kit.ts).

export type OpsNewBookingLocale = "en" | "ar" | "es";

export type OpsNewBookingCopy = {
  /** CANVAS k59. */
  title: string;
  /** CANVAS k60. */
  close: string;
  /** CANVAS DashNewBookingB k84. */
  bookings: string;
  /** CANVAS k163. */
  back: string;
  /** CANVAS k69. */
  continue: string;
  /** CANVAS DashNewBookingB k164. */
  edit: string;
  /** "{n}" and "{name}". */
  stepOf: string;
  /** CANVAS k29-k33. */
  steps: { guest: string; stay: string; extras: string; payment: string; review: string };
  requestUnread: string;
  guest: {
    /** CANVAS k61. */
    heading: string;
    /** CANVAS k64. */
    name: string;
    /** CANVAS k65. */
    email: string;
    /** CANVAS k66. */
    phone: string;
    /** CANVAS k67. */
    language: string;
    languageHint: string;
    languages: { en: string; ar: string; es: string };
    nameError: string;
    emailError: string;
    phoneError: string;
  };
  stay: {
    /** CANVAS k139. */
    heading: string;
    /** CANVAS k140. */
    destinations: string;
    /** CANVAS k141. */
    stays: string;
    /** CANVAS k310. */
    all: string;
    /** CANVAS k73. */
    dates: string;
    /** CANVAS k159. */
    guests: string;
    /** CANVAS k147. */
    availability: string;
    /** CANVAS k146. */
    available: string;
    legend: string;
    /** "{nights}". */
    unavailable: string;
    choose: string;
  };
  extras: {
    /** CANVAS k308. */
    heading: string;
    /** CANVAS k309. */
    search: string;
    /** CANVAS k310-k312. */
    all: string;
    experiences: string;
    services: string;
    /** CANVAS DashNewBookingA k313 and k315. */
    experience: string;
    service: string;
    /** CANVAS k314. */
    add: string;
    airport: string;
    noAirport: string;
    airports: { DXB: string; AUH: string; SHJ: string };
    pickup: string;
    pickupError: string;
    nothing: string;
  };
  payment: {
    agreedTitle: string;
    agreedToggle: string;
    agreedAmount: string;
    agreedHint: string;
    amountError: string;
    reason: string;
    reasonHint: string;
    reasonError: string;
    noRate: string;
    /** CANVAS DashNewBookingB k61. */
    plan: string;
    /** CANVAS k62. */
    deposit: string;
    /** CANVAS k64. */
    balanceBy: string;
    /** CANVAS k65. */
    full: string;
    dueNow: string;
    depositClosed: string;
    depositUnavailable: string;
    holdTitle: string;
    holdDate: string;
    holdTime: string;
    holdHint: string;
    holdFloor: string;
    holdError: string;
  };
  review: {
    /** CANVAS k155. */
    heading: string;
    /** CANVAS k156-k162. */
    guest: string;
    stay: string;
    dates: string;
    guests: string;
    extras: string;
    payment: string;
    /** "{adults}", "{children}", "{infants}". */
    guestsLine: string;
    depositLine: string;
    fullLine: string;
    emailLine: string;
    test: string;
    testHint: string;
    gateReal: string;
    gateTest: string;
    /** CANVAS k174. */
    create: string;
    leaveTitle: string;
    leaveText: string;
    stayHere: string;
    leave: string;
  };
  summary: {
    /** CANVAS k70. */
    title: string;
    /** CANVAS k71-k73. */
    guest: string;
    stay: string;
    dates: string;
    /** CANVAS DashNewBookingB k80-k83; "{rate}". */
    nights: string;
    extras: string;
    vat: string;
    total: string;
    dueNow: string;
    pending: string;
  };
  problems: {
    invalid: string;
    not_owner: string;
    requests_closed: string;
    hold_too_soon: string;
    settings_missing: string;
    settings_changed: string;
    stay_unavailable: string;
    below_minimum_charge: string;
    blocked: string;
    sold_out: string;
    below_min_nights: string;
    over_max_guests: string;
    deposit_unavailable: string;
    no_rate: string;
    addon_unavailable: string;
    addon_quantity: string;
    dates_invalid: string;
    unavailable: string;
    quoteFailed: string;
    saveFailed: string;
    loadFailed: string;
  };
};

export const OPS_NEW_BOOKING_COPY: Record<OpsNewBookingLocale, OpsNewBookingCopy> = {
  en: {
    title: "New booking",
    close: "Close",
    bookings: "Bookings",
    back: "Back",
    continue: "Continue",
    edit: "Edit",
    stepOf: "Step {n} / 5 · {name}",
    steps: { guest: "Guest", stay: "Stay and dates", extras: "Extras", payment: "Payment", review: "Review" },
    requestUnread: "That request could not be read. Type the details.",
    guest: {
      heading: "Who is booking?",
      name: "Name",
      email: "Email",
      phone: "Phone",
      language: "Booking language",
      languageHint: "The guest's emails go in this language.",
      languages: { en: "English", ar: "العربية", es: "Español" },
      nameError: "Type the guest's name (up to 120 characters).",
      emailError: "Type a valid email address.",
      phoneError: "Type a phone number of 7 to 20 digits, like +971 50 000 0000.",
    },
    stay: {
      heading: "Stay",
      destinations: "Destinations",
      stays: "Stays",
      all: "All",
      dates: "Dates",
      guests: "Guests",
      availability: "Availability",
      available: "Available for these dates",
      legend: "Blocked or booked",
      unavailable: "These nights are not available: {nights}",
      choose: "Choose a stay and dates",
    },
    extras: {
      heading: "Experiences and services",
      search: "Search",
      all: "All",
      experiences: "Experiences",
      services: "Services",
      experience: "Experience",
      service: "Service",
      add: "Add",
      airport: "Airport",
      noAirport: "No airport",
      airports: { DXB: "Dubai · DXB", AUH: "Abu Dhabi · AUH", SHJ: "Sharjah · SHJ" },
      pickup: "Pickup address",
      pickupError: "Type the pickup address (up to 300 characters).",
      nothing: "Nothing matches.",
    },
    payment: {
      agreedTitle: "Agreed price",
      agreedToggle: "Type an agreed price",
      agreedAmount: "Agreed price for the stay, before VAT (AED)",
      agreedHint: "VAT and the deposit come from Settings. This price applies to this booking only.",
      amountError: "Type the price in AED, like 3000 or 3,000.50.",
      reason: "Reason",
      reasonHint: "Kept in the booking's history.",
      reasonError: "Type a reason of 3 to 300 characters.",
      noRate: "This stay has no rate for these nights. Type the price you agreed.",
      plan: "Payment plan",
      deposit: "Deposit",
      balanceBy: "balance due by",
      full: "Full payment",
      dueNow: "Due now",
      depositClosed: "Deposit is closed: set the balance due days in Settings.",
      depositUnavailable: "Deposit is not available for this booking. Full payment is selected.",
      holdTitle: "Hold until",
      holdDate: "Date",
      holdTime: "Time, UAE",
      holdHint: "The nights stay held until this time. After it the booking turns Expired and the nights free up.",
      holdFloor: "Choose a time at least 35 minutes from now.",
      holdError: "Choose the date and the time.",
    },
    review: {
      heading: "Review",
      guest: "Guest",
      stay: "Stay",
      dates: "Dates",
      guests: "Guests",
      extras: "Extras",
      payment: "Payment",
      guestsLine: "Adults {adults}, children {children}, infants {infants}",
      depositLine: "Deposit, bank details by email",
      fullLine: "Full payment, bank details by email",
      emailLine: "The guest gets an email with the bank details and the booking link.",
      test: "Test booking",
      testHint: "Links go to the preview site and no real money is expected.",
      gateReal:
        "Real bookings stay closed until the booking terms are published and Settings has the bank details, VAT, deposit and transfer window. You can make a Test booking.",
      gateTest: "Bookings stay closed until Settings has the bank details, VAT and deposit.",
      create: "Create booking",
      leaveTitle: "Leave this booking?",
      leaveText: "What you typed is lost.",
      stayHere: "Stay here",
      leave: "Leave",
    },
    summary: {
      title: "Booking summary",
      guest: "Guest",
      stay: "Stay",
      dates: "Dates",
      nights: "Stay",
      extras: "Extras",
      vat: "VAT {rate}%",
      total: "Total",
      dueNow: "Due now",
      pending: "Choose a stay and dates",
    },
    problems: {
      invalid: "Something in the form is not valid. Check it and try again.",
      not_owner: "Sign in as the owner to make a booking.",
      requests_closed: "Bookings are closed right now. Check Settings, or tick Test booking.",
      hold_too_soon: "Choose a time at least 35 minutes from now.",
      settings_missing: "Set VAT and the deposit in Settings first.",
      settings_changed: "Settings changed while you worked. The price was refreshed: check it and try again.",
      stay_unavailable: "This stay cannot be booked.",
      below_minimum_charge: "The amount due now is too small. Change the price or choose full payment.",
      blocked: "These nights are not available: {nights}",
      sold_out: "These nights are not available: {nights}",
      below_min_nights: "This stay needs at least {min} nights.",
      over_max_guests: "This stay takes at most {max} guests.",
      deposit_unavailable: "Deposit is not available for this booking. Full payment is selected.",
      no_rate: "This stay has no rate for these nights. Type the price you agreed.",
      addon_unavailable: "An extra is no longer available. Remove it.",
      addon_quantity: "An extra allows at most {max}.",
      dates_invalid: "Choose dates from today, with at least one night.",
      unavailable: "This could not be done right now. Try again.",
      quoteFailed: "The price could not be worked out. Try again.",
      saveFailed: "The booking was not created. Try again.",
      loadFailed: "The stays could not be loaded. Reload the page.",
    },
  },
  ar: {
    title: "حجز جديد",
    close: "إغلاق",
    bookings: "الحجوزات",
    back: "رجوع",
    continue: "متابعة",
    edit: "تعديل",
    stepOf: "الخطوة {n} / 5 · {name}",
    steps: { guest: "الضيف", stay: "الإقامة والتواريخ", extras: "الإضافات", payment: "الدفع", review: "المراجعة" },
    requestUnread: "تعذّرت قراءة هذا الطلب. اكتب البيانات.",
    guest: {
      heading: "من يحجز؟",
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      language: "لغة الحجز",
      languageHint: "تصل رسائل الضيف بهذه اللغة.",
      languages: { en: "English", ar: "العربية", es: "Español" },
      nameError: "اكتب اسم الضيف (حتى 120 حرفًا).",
      emailError: "اكتب عنوان بريد صحيحًا.",
      phoneError: "اكتب رقم هاتف من 7 إلى 20 رقمًا، مثل +971 50 000 0000.",
    },
    stay: {
      heading: "الإقامة",
      destinations: "الوجهات",
      stays: "الإقامات",
      all: "الكل",
      dates: "التواريخ",
      guests: "الضيوف",
      availability: "التوافر",
      available: "متاح في هذه التواريخ",
      legend: "محجوب أو محجوز",
      unavailable: "هذه الليالي غير متاحة: {nights}",
      choose: "اختر إقامة وتواريخ",
    },
    extras: {
      heading: "التجارب والخدمات",
      search: "بحث",
      all: "الكل",
      experiences: "التجارب",
      services: "الخدمات",
      experience: "تجربة",
      service: "خدمة",
      add: "أضف",
      airport: "المطار",
      noAirport: "بلا مطار",
      airports: { DXB: "دبي · DXB", AUH: "أبوظبي · AUH", SHJ: "الشارقة · SHJ" },
      pickup: "عنوان الاستقبال",
      pickupError: "اكتب عنوان الاستقبال (حتى 300 حرف).",
      nothing: "لا نتائج مطابقة.",
    },
    payment: {
      agreedTitle: "السعر المتفق عليه",
      agreedToggle: "اكتب سعرًا متفقًا عليه",
      agreedAmount: "السعر المتفق عليه للإقامة قبل ضريبة القيمة المضافة (درهم)",
      agreedHint: "تأتي ضريبة القيمة المضافة والدفعة المقدّمة من الإعدادات. يسري هذا السعر على هذا الحجز فقط.",
      amountError: "اكتب السعر بالدرهم، مثل 3000 أو 3,000.50.",
      reason: "السبب",
      reasonHint: "يُحفظ في سجل الحجز.",
      reasonError: "اكتب سببًا من 3 إلى 300 حرف.",
      noRate: "لا يوجد سعر لهذه الإقامة في هذه الليالي. اكتب السعر الذي اتفقتم عليه.",
      plan: "خطة الدفع",
      deposit: "دفعة مقدّمة",
      balanceBy: "الرصيد مستحق قبل",
      full: "دفع كامل",
      dueNow: "المستحق الآن",
      depositClosed: "الدفعة المقدّمة غير متاحة: حدّد أيام استحقاق الرصيد في الإعدادات.",
      depositUnavailable: "الدفعة المقدّمة غير متاحة لهذا الحجز. اختير الدفع الكامل.",
      holdTitle: "الحجز حتى",
      holdDate: "التاريخ",
      holdTime: "الوقت، بتوقيت الإمارات",
      holdHint: "تبقى الليالي محجوزة حتى هذا الوقت. بعده يصبح الحجز منتهيًا وتُتاح الليالي من جديد.",
      holdFloor: "اختر وقتًا بعد 35 دقيقة على الأقل من الآن.",
      holdError: "اختر التاريخ والوقت.",
    },
    review: {
      heading: "المراجعة",
      guest: "الضيف",
      stay: "الإقامة",
      dates: "التواريخ",
      guests: "الضيوف",
      extras: "الإضافات",
      payment: "الدفع",
      guestsLine: "البالغون {adults}، الأطفال {children}، الرضّع {infants}",
      depositLine: "دفعة مقدّمة، بيانات البنك بالبريد",
      fullLine: "دفع كامل، بيانات البنك بالبريد",
      emailLine: "يصل الضيف بريد فيه بيانات البنك ورابط الحجز.",
      test: "حجز تجريبي",
      testHint: "تذهب الروابط إلى موقع المعاينة ولا يُنتظر أي مال حقيقي.",
      gateReal:
        "تبقى الحجوزات الحقيقية مغلقة حتى تُنشر شروط الحجز وتحتوي الإعدادات على بيانات البنك وضريبة القيمة المضافة والدفعة المقدّمة ومهلة التحويل. يمكنك إنشاء حجز تجريبي.",
      gateTest: "تبقى الحجوزات مغلقة حتى تحتوي الإعدادات على بيانات البنك وضريبة القيمة المضافة والدفعة المقدّمة.",
      create: "إنشاء الحجز",
      leaveTitle: "مغادرة هذا الحجز؟",
      leaveText: "سيضيع ما كتبته.",
      stayHere: "البقاء هنا",
      leave: "مغادرة",
    },
    summary: {
      title: "ملخص الحجز",
      guest: "الضيف",
      stay: "الإقامة",
      dates: "التواريخ",
      nights: "الإقامة",
      extras: "الإضافات",
      vat: "ضريبة القيمة المضافة {rate}٪",
      total: "الإجمالي",
      dueNow: "المستحق الآن",
      pending: "اختر إقامة وتواريخ",
    },
    problems: {
      invalid: "في النموذج ما هو غير صالح. راجعه وحاول مرة أخرى.",
      not_owner: "سجّل الدخول بصفتك المالك لإنشاء حجز.",
      requests_closed: "الحجوزات مغلقة الآن. راجع الإعدادات أو فعّل حجزًا تجريبيًا.",
      hold_too_soon: "اختر وقتًا بعد 35 دقيقة على الأقل من الآن.",
      settings_missing: "حدّد ضريبة القيمة المضافة والدفعة المقدّمة في الإعدادات أولًا.",
      settings_changed: "تغيّرت الإعدادات أثناء عملك. حُدّث السعر: راجعه وحاول مرة أخرى.",
      stay_unavailable: "لا يمكن حجز هذه الإقامة.",
      below_minimum_charge: "المبلغ المستحق الآن صغير جدًا. غيّر السعر أو اختر الدفع الكامل.",
      blocked: "هذه الليالي غير متاحة: {nights}",
      sold_out: "هذه الليالي غير متاحة: {nights}",
      below_min_nights: "تتطلب هذه الإقامة {min} ليالٍ على الأقل.",
      over_max_guests: "تتسع هذه الإقامة لـ {max} ضيوف كحد أقصى.",
      deposit_unavailable: "الدفعة المقدّمة غير متاحة لهذا الحجز. اختير الدفع الكامل.",
      no_rate: "لا يوجد سعر لهذه الإقامة في هذه الليالي. اكتب السعر الذي اتفقتم عليه.",
      addon_unavailable: "إضافة لم تعد متاحة. أزلها.",
      addon_quantity: "تسمح إحدى الإضافات بـ {max} كحد أقصى.",
      dates_invalid: "اختر تواريخ تبدأ من اليوم بليلة واحدة على الأقل.",
      unavailable: "تعذّر تنفيذ ذلك الآن. حاول مرة أخرى.",
      quoteFailed: "تعذّر حساب السعر. حاول مرة أخرى.",
      saveFailed: "لم يُنشأ الحجز. حاول مرة أخرى.",
      loadFailed: "تعذّر تحميل الإقامات. أعد تحميل الصفحة.",
    },
  },
  es: {
    title: "Nueva reserva",
    close: "Cerrar",
    bookings: "Reservas",
    back: "Atrás",
    continue: "Continuar",
    edit: "Editar",
    stepOf: "Paso {n} / 5 · {name}",
    steps: { guest: "Huésped", stay: "Estancia y fechas", extras: "Extras", payment: "Pago", review: "Revisión" },
    requestUnread: "No se pudo leer esa solicitud. Escriba los datos.",
    guest: {
      heading: "¿Quién reserva?",
      name: "Nombre",
      email: "Correo electrónico",
      phone: "Teléfono",
      language: "Idioma de la reserva",
      languageHint: "Los correos del huésped se envían en este idioma.",
      languages: { en: "English", ar: "العربية", es: "Español" },
      nameError: "Escriba el nombre del huésped (hasta 120 caracteres).",
      emailError: "Escriba un correo válido.",
      phoneError: "Escriba un teléfono de 7 a 20 dígitos, por ejemplo +971 50 000 0000.",
    },
    stay: {
      heading: "Estancia",
      destinations: "Destinos",
      stays: "Estancias",
      all: "Todo",
      dates: "Fechas",
      guests: "Huéspedes",
      availability: "Disponibilidad",
      available: "Disponible en estas fechas",
      legend: "Bloqueado o reservado",
      unavailable: "Estas noches no están disponibles: {nights}",
      choose: "Elija una estancia y las fechas",
    },
    extras: {
      heading: "Experiencias y servicios",
      search: "Buscar",
      all: "Todo",
      experiences: "Experiencias",
      services: "Servicios",
      experience: "Experiencia",
      service: "Servicio",
      add: "Añadir",
      airport: "Aeropuerto",
      noAirport: "Sin aeropuerto",
      airports: { DXB: "Dubái · DXB", AUH: "Abu Dabi · AUH", SHJ: "Sharjah · SHJ" },
      pickup: "Dirección de recogida",
      pickupError: "Escriba la dirección de recogida (hasta 300 caracteres).",
      nothing: "Nada coincide.",
    },
    payment: {
      agreedTitle: "Precio acordado",
      agreedToggle: "Escribir un precio acordado",
      agreedAmount: "Precio acordado de la estancia, antes del IVA (AED)",
      agreedHint: "El IVA y el depósito vienen de Ajustes. Este precio vale solo para esta reserva.",
      amountError: "Escriba el precio en AED, por ejemplo 3000 o 3,000.50.",
      reason: "Motivo",
      reasonHint: "Se guarda en el historial de la reserva.",
      reasonError: "Escriba un motivo de 3 a 300 caracteres.",
      noRate: "Esta estancia no tiene tarifa para estas noches. Escriba el precio que acordó.",
      plan: "Plan de pago",
      deposit: "Depósito",
      balanceBy: "saldo antes del",
      full: "Pago completo",
      dueNow: "A pagar ahora",
      depositClosed: "El depósito está cerrado: defina los días para el saldo en Ajustes.",
      depositUnavailable: "El depósito no está disponible para esta reserva. Se eligió el pago completo.",
      holdTitle: "Reservar hasta",
      holdDate: "Fecha",
      holdTime: "Hora, Emiratos",
      holdHint: "Las noches quedan reservadas hasta esta hora. Después la reserva pasa a Vencida y las noches se liberan.",
      holdFloor: "Elija una hora al menos 35 minutos a partir de ahora.",
      holdError: "Elija la fecha y la hora.",
    },
    review: {
      heading: "Revisión",
      guest: "Huésped",
      stay: "Estancia",
      dates: "Fechas",
      guests: "Huéspedes",
      extras: "Extras",
      payment: "Pago",
      guestsLine: "Adultos {adults}, niños {children}, bebés {infants}",
      depositLine: "Depósito, datos bancarios por correo",
      fullLine: "Pago completo, datos bancarios por correo",
      emailLine: "El huésped recibe un correo con los datos bancarios y el enlace de la reserva.",
      test: "Reserva de prueba",
      testHint: "Los enlaces van al sitio de vista previa y no se espera dinero real.",
      gateReal:
        "Las reservas reales siguen cerradas hasta que se publiquen las condiciones de reserva y Ajustes tenga los datos bancarios, el IVA, el depósito y el plazo de transferencia. Puede hacer una reserva de prueba.",
      gateTest: "Las reservas siguen cerradas hasta que Ajustes tenga los datos bancarios, el IVA y el depósito.",
      create: "Crear reserva",
      leaveTitle: "¿Salir de esta reserva?",
      leaveText: "Lo que escribió se perderá.",
      stayHere: "Quedarme aquí",
      leave: "Salir",
    },
    summary: {
      title: "Resumen de la reserva",
      guest: "Huésped",
      stay: "Estancia",
      dates: "Fechas",
      nights: "Estancia",
      extras: "Extras",
      vat: "IVA {rate} %",
      total: "Total",
      dueNow: "A pagar ahora",
      pending: "Elija una estancia y las fechas",
    },
    problems: {
      invalid: "Algo del formulario no es válido. Revíselo e inténtelo de nuevo.",
      not_owner: "Inicie sesión como propietario para crear una reserva.",
      requests_closed: "Las reservas están cerradas por ahora. Revise Ajustes o marque Reserva de prueba.",
      hold_too_soon: "Elija una hora al menos 35 minutos a partir de ahora.",
      settings_missing: "Defina primero el IVA y el depósito en Ajustes.",
      settings_changed: "Ajustes cambió mientras trabajaba. El precio se actualizó: revíselo e inténtelo de nuevo.",
      stay_unavailable: "Esta estancia no se puede reservar.",
      below_minimum_charge: "El importe a pagar ahora es demasiado pequeño. Cambie el precio o elija el pago completo.",
      blocked: "Estas noches no están disponibles: {nights}",
      sold_out: "Estas noches no están disponibles: {nights}",
      below_min_nights: "Esta estancia requiere al menos {min} noches.",
      over_max_guests: "Esta estancia admite como máximo {max} huéspedes.",
      deposit_unavailable: "El depósito no está disponible para esta reserva. Se eligió el pago completo.",
      no_rate: "Esta estancia no tiene tarifa para estas noches. Escriba el precio que acordó.",
      addon_unavailable: "Un extra ya no está disponible. Quítelo.",
      addon_quantity: "Un extra admite como máximo {max}.",
      dates_invalid: "Elija fechas desde hoy, con al menos una noche.",
      unavailable: "No se pudo hacer ahora. Inténtelo de nuevo.",
      quoteFailed: "No se pudo calcular el precio. Inténtelo de nuevo.",
      saveFailed: "La reserva no se creó. Inténtelo de nuevo.",
      loadFailed: "No se pudieron cargar las estancias. Vuelva a cargar la página.",
    },
  },
};
