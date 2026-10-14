// Copy for the stay editor's Rates, Availability and Access sections (phase 3.2 plan 15). New file; 03.2-07 owns
// lib/copy/ops-stays.ts and the kit owns lib/copy/ops-kit.ts (Save, Cancel, Delete come from there).
//
// Strings marked CANVAS are verbatim from the design canvas board DashStays in all three languages. Strings marked PLAN
// are fixed in English by 03.2-15-PLAN.md. Every other EN string is DRAFTED UI COPY for the owner's review at the picture
// gate; AR (Modern Standard Arabic) and ES (formal "usted", owner 2026-10-14) are drafts written from the EN.
// Never a price, a rate, an address or legal text: those are what the owner types. `{n}` tokens are filled with fillCopy.
// Imported directly by the sections; deliberately not registered in lib/copy/index.ts.

import type { Locale3 } from "../../components/ops/api-types";

export type OpsStayTabsCopy = {
  rates: {
    title: string;
    baseLabel: string;
    baseHint: string;
    savePrice: string;
    noRate: string; // PLAN
    rangesTitle: string;
    rule: string; // PLAN
    firstNight: string;
    lastNight: string;
    nights: string;
    perNight: string;
    dates: string;
    addRange: string;
    edit: string;
    saveRange: string;
    noRanges: string;
    overlap: string; // PLAN
    deleteRangeTitle: string;
    deleteRangeBody: string;
    moneyError: string;
    datesError: string;
    tooLong: string;
    checkTitle: string;
    checkLine: string;
    check: string;
    night: string;
    priceFrom: string;
    source: { range: string; base: string; none: string };
    checkTooLong: string;
    saved: string;
  };
  availability: {
    title: string; // CANVAS
    intro: string; // CANVAS
    blocked: string; // CANVAS
    blockDates: string; // CANVAS
    weekdays: [string, string, string, string, string, string, string]; // CANVAS, Monday first
    reasonsTitle: string;
    noBlocks: string;
    scope: { stay: string; destination: string; all: string };
    noReason: string;
    previousMonth: string;
    nextMonth: string;
  };
  access: {
    title: string;
    guestLine: string; // PLAN
    privateLine: string;
    address: string;
    wifiName: string;
    wifiPassword: string;
    doorCode: string;
    notes: string;
    notesHint: string;
    saveAccess: string;
    tooLong: string;
    saved: string;
    /** DRAFT (controller 2026-10-15): replaces the kit's line, which speaks of Publish; for the owner's signature. */
    translationFailed: string;
  };
  loading: string;
  loadFailed: string;
  retry: string;
};

export const OPS_STAY_TABS_COPY: Record<Locale3, OpsStayTabsCopy> = {
  en: {
    rates: {
      title: "Rates",
      baseLabel: "Price per night (AED)",
      baseHint: "Guests pay this for every night that no date range covers.",
      savePrice: "Save price",
      noRate: "No nightly rate yet: guests cannot book this stay.",
      rangesTitle: "Date ranges",
      rule: "The shortest range covering a night sets its price. Two ranges of the same length cannot share a night.",
      firstNight: "First night",
      lastNight: "Last night",
      nights: "Nights",
      perNight: "AED per night",
      dates: "First and last night",
      addRange: "Add range",
      edit: "Edit",
      saveRange: "Save range",
      noRanges: "No date ranges yet. Every night uses the price per night.",
      overlap: "Another range of the same length already covers these nights.",
      deleteRangeTitle: "Delete this date range?",
      deleteRangeBody: "Its nights go back to the price per night, or to a longer range that covers them.",
      moneyError: "Type the amount in AED, with up to 2 decimals and a dot, for example 1250.50.",
      datesError: "Choose the first and the last night.",
      tooLong: "A range can cover at most 730 nights.",
      checkTitle: "Check prices",
      checkLine: "Choose nights to see the price of each one and where it comes from. Up to 366 nights.",
      check: "Check",
      night: "Night",
      priceFrom: "Price from",
      source: { range: "Range", base: "Base", none: "No rate" },
      checkTooLong: "Choose at most 366 nights.",
      saved: "Saved",
    },
    availability: {
      title: "Availability",
      intro: "Blocked and booked dates for this stay. Blocks are set in the Calendar.",
      blocked: "Blocked",
      blockDates: "Block dates for this stay",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      reasonsTitle: "Blocked days this month",
      noBlocks: "No blocked days this month.",
      scope: { stay: "This stay", destination: "Whole destination", all: "Everything" },
      noReason: "No reason given",
      previousMonth: "Previous month",
      nextMonth: "Next month",
    },
    access: {
      title: "Access",
      guestLine: "The guest sees this only after you confirm the booking.",
      privateLine: "Only you can see it here. It is never on the public site.",
      address: "Address",
      wifiName: "Wi-Fi name",
      wifiPassword: "Wi-Fi password",
      doorCode: "Door code",
      notes: "Notes",
      notesHint: "Parking, keys, anything the guest needs on arrival. Up to 2,000 characters.",
      saveAccess: "Save access",
      tooLong: "Up to 2,000 characters.",
      saved: "Saved",
      translationFailed:
        "Saved, except the Arabic and Spanish notes: the translation did not finish, so they still show the earlier text. Press Save access to try again, or open Edit translations and type them yourself.",
    },
    loading: "Loading…",
    loadFailed: "This could not be loaded.",
    retry: "Try again",
  },
  ar: {
    rates: {
      title: "الأسعار",
      baseLabel: "السعر لكل ليلة (درهم)",
      baseHint: "يدفع الضيوف هذا السعر عن كل ليلة لا يغطيها أي نطاق تواريخ.",
      savePrice: "حفظ السعر",
      noRate: "لا يوجد سعر لليلة بعد: لا يمكن للضيوف حجز هذه الإقامة.",
      rangesTitle: "نطاقات التواريخ",
      rule: "أقصر نطاق يغطي الليلة هو الذي يحدد سعرها. لا يمكن لنطاقين بالطول نفسه أن يشتركا في ليلة.",
      firstNight: "الليلة الأولى",
      lastNight: "الليلة الأخيرة",
      nights: "الليالي",
      perNight: "درهم لكل ليلة",
      dates: "الليلة الأولى والأخيرة",
      addRange: "إضافة نطاق",
      edit: "تعديل",
      saveRange: "حفظ النطاق",
      noRanges: "لا توجد نطاقات تواريخ بعد. كل ليلة تستخدم السعر لكل ليلة.",
      overlap: "يغطي نطاق آخر بالطول نفسه هذه الليالي بالفعل.",
      deleteRangeTitle: "حذف نطاق التواريخ هذا؟",
      deleteRangeBody: "تعود لياليه إلى السعر لكل ليلة، أو إلى نطاق أطول يغطيها.",
      moneyError: "اكتب المبلغ بالدرهم، بخانتين عشريتين كحد أقصى ونقطة، مثل 1250.50.",
      datesError: "اختر الليلة الأولى والأخيرة.",
      tooLong: "يمكن أن يغطي النطاق 730 ليلة كحد أقصى.",
      checkTitle: "التحقق من الأسعار",
      checkLine: "اختر الليالي لترى سعر كل ليلة ومن أين يأتي. حتى 366 ليلة.",
      check: "تحقق",
      night: "الليلة",
      priceFrom: "مصدر السعر",
      source: { range: "نطاق", base: "السعر الأساسي", none: "بلا سعر" },
      checkTooLong: "اختر 366 ليلة كحد أقصى.",
      saved: "تم الحفظ",
    },
    availability: {
      title: "التوافر",
      // CANVAS, corrected by the owner 2026-10-15 02:56 (the canvas said "blocked bookings").
      intro: "التواريخ المحجوبة والمحجوزة لهذه الإقامة. تُضبط التواريخ المحجوبة من التقويم.",
      blocked: "محجوب",
      blockDates: "حجب تواريخ لهذه الإقامة",
      weekdays: ["إث", "ث", "أر", "خ", "ج", "س", "أح"],
      reasonsTitle: "الأيام المحجوبة هذا الشهر",
      noBlocks: "لا توجد أيام محجوبة هذا الشهر.",
      scope: { stay: "هذه الإقامة", destination: "الوجهة كلها", all: "كل شيء" },
      noReason: "بدون سبب",
      previousMonth: "الشهر السابق",
      nextMonth: "الشهر التالي",
    },
    access: {
      title: "معلومات الوصول",
      guestLine: "لا يرى الضيف هذه المعلومات إلا بعد أن تؤكد الحجز.",
      privateLine: "لا يراها هنا أحد غيرك، ولا تظهر أبدًا على الموقع العام.",
      address: "العنوان",
      wifiName: "اسم شبكة Wi-Fi",
      wifiPassword: "كلمة مرور Wi-Fi",
      doorCode: "رمز الباب",
      notes: "ملاحظات",
      notesHint: "الموقف، المفاتيح، وكل ما يحتاجه الضيف عند الوصول. حتى 2,000 حرف.",
      saveAccess: "حفظ معلومات الوصول",
      tooLong: "حتى 2,000 حرف.",
      saved: "تم الحفظ",
      translationFailed:
        "تم الحفظ، باستثناء الملاحظات بالعربية والإسبانية: لم تكتمل الترجمة، لذلك ما زالت تعرض النص السابق. اضغط «حفظ معلومات الوصول» للمحاولة مرة أخرى، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
    },
    loading: "جارٍ التحميل…",
    loadFailed: "تعذّر التحميل.",
    retry: "أعد المحاولة",
  },
  es: {
    rates: {
      title: "Tarifas",
      baseLabel: "Precio por noche (AED)",
      baseHint: "Los huéspedes pagan esto por cada noche que ningún rango de fechas cubre.",
      savePrice: "Guardar precio",
      noRate: "Todavía no hay precio por noche: los huéspedes no pueden reservar esta estancia.",
      rangesTitle: "Rangos de fechas",
      rule: "El rango más corto que cubre una noche fija su precio. Dos rangos de la misma duración no pueden compartir una noche.",
      firstNight: "Primera noche",
      lastNight: "Última noche",
      nights: "Noches",
      perNight: "AED por noche",
      dates: "Primera y última noche",
      addRange: "Añadir rango",
      edit: "Editar",
      saveRange: "Guardar rango",
      noRanges: "Todavía no hay rangos de fechas. Cada noche usa el precio por noche.",
      overlap: "Otro rango de la misma duración ya cubre estas noches.",
      deleteRangeTitle: "¿Eliminar este rango de fechas?",
      deleteRangeBody: "Sus noches vuelven al precio por noche, o a un rango más largo que las cubra.",
      moneyError: "Escriba el importe en AED, con hasta 2 decimales y un punto, por ejemplo 1250.50.",
      datesError: "Elija la primera y la última noche.",
      tooLong: "Un rango puede cubrir como máximo 730 noches.",
      checkTitle: "Comprobar precios",
      checkLine: "Elija las noches para ver el precio de cada una y de dónde viene. Hasta 366 noches.",
      check: "Comprobar",
      night: "Noche",
      priceFrom: "Precio de",
      source: { range: "Rango", base: "Base", none: "Sin precio" },
      checkTooLong: "Elija como máximo 366 noches.",
      saved: "Guardado",
    },
    availability: {
      title: "Disponibilidad",
      intro: "Fechas bloqueadas y reservadas de esta estancia. Los bloqueos se definen en el Calendario.",
      blocked: "Bloqueado",
      blockDates: "Bloquear fechas de esta estancia",
      weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
      reasonsTitle: "Días bloqueados este mes",
      noBlocks: "No hay días bloqueados este mes.",
      scope: { stay: "Esta estancia", destination: "Todo el destino", all: "Todo" },
      noReason: "Sin motivo",
      previousMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
    },
    access: {
      title: "Acceso",
      guestLine: "El huésped solo ve esto después de que confirme la reserva.",
      privateLine: "Solo usted lo ve aquí. Nunca aparece en el sitio público.",
      address: "Dirección",
      wifiName: "Nombre del Wi-Fi",
      wifiPassword: "Contraseña del Wi-Fi",
      doorCode: "Código de la puerta",
      notes: "Notas",
      notesHint: "Aparcamiento, llaves, todo lo que el huésped necesita al llegar. Hasta 2.000 caracteres.",
      saveAccess: "Guardar acceso",
      tooLong: "Hasta 2.000 caracteres.",
      saved: "Guardado",
      translationFailed:
        "Guardado, salvo las notas en árabe y español: la traducción no terminó, así que siguen mostrando el texto anterior. Pulse «Guardar acceso» para reintentar, o abra «Editar traducciones» y escríbalas usted.",
    },
    loading: "Cargando…",
    loadFailed: "No se pudo cargar.",
    retry: "Intentar de nuevo",
  },
};
