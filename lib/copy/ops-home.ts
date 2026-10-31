// Dashboard copy of plan 05-04: Home, Customers and Profile, in EN, AR and ES.
//
// EN is ours. AR and ES are model-translated, correctable at UAT, signed only as drawn on the plan-gate pictures
// (.planning/phases/05-ops-os, owner 2026-10-31). Dashboard Spanish uses usted. A leaf with no imports, not registered in
// lib/copy/index.ts (the ops-requests.ts pattern). `home.rangeTooLong` is not on the plan's table: it is the field error
// the plan's range note asks for (ops_home_numbers refuses above 3660 days).

export type OpsHomeCopy = {
  home: {
    bookings: string;
    recorded: string;
    outstanding: string;
    bookingsNote: string;
    recordedNote: string;
    outstandingNote: string;
    foot: string;
    dateRange: string;
    customDates: string;
    pickDates: string;
    rangeTooLong: string;
    loading: string;
    failed: string;
  };
  customers: {
    search: string;
    searchHint: string;
    name: string;
    email: string;
    phone: string;
    bookings: string;
    lastArrival: string;
    showMore: string;
    loading: string;
    noMatch: string;
    failed: string;
  };
  profile: {
    name: string;
    email: string;
    noName: string;
    loading: string;
    failed: string;
  };
};

const EN: OpsHomeCopy = {
  home: {
    bookings: "Bookings",
    recorded: "Recorded money",
    outstanding: "Outstanding",
    bookingsNote: "Requests and hand-made bookings in these dates.",
    recordedNote: "Bank payments received minus refunds in these dates.",
    outstandingNote: "Still due now, whatever the dates.",
    foot: "Amounts in AED. TEST bookings are not counted.",
    dateRange: "Date range",
    customDates: "Dates",
    pickDates: "Pick the first and the last day.",
    rangeTooLong: "The range can cover at most 3,660 days.",
    loading: "Loading the numbers…",
    failed: "The numbers could not be loaded. Reload the page.",
  },
  customers: {
    search: "Search",
    searchHint: "Name, email or phone",
    name: "Name",
    email: "Email",
    phone: "Phone",
    bookings: "Bookings",
    lastArrival: "Last arrival",
    showMore: "Show more",
    loading: "Loading customers…",
    noMatch: "No customer matches this search.",
    failed: "The customers could not be loaded. Reload the page.",
  },
  profile: {
    name: "Name",
    email: "Email",
    noName: "No name on this account",
    loading: "Loading your profile…",
    failed: "Your profile could not be loaded. Reload the page.",
  },
};

const AR: OpsHomeCopy = {
  home: {
    bookings: "الحجوزات",
    recorded: "المبالغ المسجلة",
    outstanding: "المبالغ المستحقة",
    bookingsNote: "الطلبات والحجوزات اليدوية في هذه التواريخ.",
    recordedNote: "الدفعات البنكية المستلمة مطروحًا منها المبالغ المستردة في هذه التواريخ.",
    outstandingNote: "المستحق الآن، بغض النظر عن التواريخ.",
    foot: "المبالغ بالدرهم. حجوزات TEST غير محتسبة.",
    dateRange: "نطاق التاريخ",
    customDates: "التواريخ",
    pickDates: "اختر اليوم الأول واليوم الأخير.",
    rangeTooLong: "يمكن أن يغطي النطاق 3660 يومًا كحد أقصى.",
    loading: "جارٍ تحميل الأرقام…",
    failed: "تعذّر تحميل الأرقام. أعد تحميل الصفحة.",
  },
  customers: {
    search: "بحث",
    searchHint: "الاسم أو البريد أو الهاتف",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    bookings: "الحجوزات",
    lastArrival: "آخر وصول",
    showMore: "عرض المزيد",
    loading: "جارٍ تحميل العملاء…",
    noMatch: "لا يوجد عميل يطابق هذا البحث.",
    failed: "تعذّر تحميل العملاء. أعد تحميل الصفحة.",
  },
  profile: {
    name: "الاسم",
    email: "البريد الإلكتروني",
    noName: "لا يوجد اسم في هذا الحساب",
    loading: "جارٍ تحميل ملفك…",
    failed: "تعذّر تحميل ملفك. أعد تحميل الصفحة.",
  },
};

const ES: OpsHomeCopy = {
  home: {
    bookings: "Reservas",
    recorded: "Dinero registrado",
    outstanding: "Pendiente de cobro",
    bookingsNote: "Solicitudes y reservas manuales en estas fechas.",
    recordedNote: "Pagos bancarios recibidos menos reembolsos en estas fechas.",
    outstandingNote: "Pendiente ahora, sean cuales sean las fechas.",
    foot: "Importes en AED. Las reservas TEST no se cuentan.",
    dateRange: "Intervalo de fechas",
    customDates: "Fechas",
    pickDates: "Elija el primer y el último día.",
    rangeTooLong: "El intervalo puede abarcar como máximo 3660 días.",
    loading: "Cargando las cifras…",
    failed: "No se pudieron cargar las cifras. Recargue la página.",
  },
  customers: {
    search: "Buscar",
    searchHint: "Nombre, correo o teléfono",
    name: "Nombre",
    email: "Correo electrónico",
    phone: "Teléfono",
    bookings: "Reservas",
    lastArrival: "Última llegada",
    showMore: "Mostrar más",
    loading: "Cargando clientes…",
    noMatch: "Ningún cliente coincide con esta búsqueda.",
    failed: "No se pudieron cargar los clientes. Recargue la página.",
  },
  profile: {
    name: "Nombre",
    email: "Correo electrónico",
    noName: "Esta cuenta no tiene nombre",
    loading: "Cargando su perfil…",
    failed: "No se pudo cargar su perfil. Recargue la página.",
  },
};

export const OPS_HOME_COPY: Record<"en" | "ar" | "es", OpsHomeCopy> = { en: EN, ar: AR, es: ES };
