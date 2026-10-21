// Plan 04-09: the money Settings section copy (balance due days, transfer window, bank details), self-contained: a
// granted slot, deliberately not registered in lib/copy/index.ts.
//
// Strings marked CANVAS are taken verbatim from the design canvas board DashSettingsA in all three languages. Every
// other EN string is new UI copy typed for the owner's review at the picture signature (04-09 Task 4). AR (Modern
// Standard Arabic) and ES (dashboard Spanish in formal "usted", owner 2026-10-14) are DRAFTS written from the EN for
// the owner's review. The owner types every value himself (B-30): no bank detail, window, fee, rate or legal sentence
// is written here; numbers in the hints are the rules the SQL checks (P-07: 35 minutes to 30 days; 0 to 365 days).
// `{token}`s are filled with fillCopy (lib/copy/ops-kit.ts).

export type OpsMoneyLocale = "en" | "ar" | "es";

export type OpsMoneyCopy = {
  title: string;
  balanceDue: string;
  balanceDaysAfter: string;
  balanceHint: string;
  window: string;
  units: { minutes: string; hours: string; days: string };
  windowUnit: string;
  windowHint: string;
  windowHours: string;
  windowHoursHint: string;
  accountName: string;
  bankName: string;
  iban: string;
  swift: string;
  bankAddress: string;
  note: string;
  noteHint: string;
  editTranslations: string;
  hideTranslations: string;
  arabic: string;
  spanish: string;
  errors: {
    windowRange: string;
    windowHoursRange: string;
    whole: string;
    daysRange: string;
    checksum: string;
    shape: string;
    long: string;
    required: string;
  };
  readiness: { title: string; window: string; bank: string; terms: string; set: string; notSet: string };
  confirm: { title: string; body: string; save: string; back: string };
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  loadFailed: string;
  translations: { working: string; updated: string; notUpdated: string; limit: string; busy: string };
  lastChanged: string;
};

export const OPS_MONEY_COPY: Record<OpsMoneyLocale, OpsMoneyCopy> = {
  en: {
    title: "Bank transfer",
    balanceDue: "Balance due", // CANVAS
    balanceDaysAfter: "days before arrival", // CANVAS "[00] days before arrival", the number is the field
    balanceHint: "Empty: guests can only pay in full.",
    window: "Transfer window",
    units: { minutes: "Minutes", hours: "Hours", days: "Days" },
    windowUnit: "Unit",
    windowHint:
      "How long a guest has to pay after a request. Empty: requests stay closed. From 35 minutes to 30 days. TEST requests on the preview site use 35 minutes.",
    windowHours: "Transfer window (hours)",
    windowHoursHint:
      "How long a guest has to pay after a request, in whole hours. Empty: requests stay closed. From 1 to 720 hours (30 days). TEST requests on the preview site use 35 minutes.",
    accountName: "Account name",
    bankName: "Bank",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    bankAddress: "Bank address",
    note: "Note line",
    noteHint: "Shown to guests with the bank details. Type it in English; Arabic and Spanish are filled when you save.",
    editTranslations: "Edit translations",
    hideTranslations: "Hide translations",
    arabic: "Arabic",
    spanish: "Spanish",
    errors: {
      windowRange: "Use 35 minutes to 30 days.",
      windowHoursRange: "Use 1 to 720 hours.",
      whole: "Use a whole number.",
      daysRange: "Use 0 to 365 days.",
      checksum: "This IBAN does not check out. Look for a typing error.",
      shape: "A SWIFT / BIC has 8 or 11 letters and digits.",
      long: "This is too long: up to {max} characters.",
      required: "Fill in every bank field, or empty them all.",
    },
    readiness: {
      title: "Guests can send requests once these are set:",
      window: "Transfer window",
      bank: "Bank details",
      terms: "Booking terms text (send it to be added)",
      set: "Set",
      notSet: "Not set",
    },
    confirm: {
      title: "Guests are sent these bank details",
      body: "Check the account name and IBAN before you save: {name}, {iban}.",
      save: "Save details",
      back: "Check again",
    },
    save: "Save bank transfer",
    saving: "Saving…",
    saved: "Bank transfer saved.",
    saveFailed: "Bank transfer was not saved. Try again.",
    loadFailed: "The bank transfer settings could not be loaded. Reload the page.",
    translations: {
      working: "Adding Arabic and Spanish…",
      updated: "Arabic and Spanish updated.",
      notUpdated: "Arabic and Spanish not updated: guests see English until you save again.",
      limit: "Arabic and Spanish not updated: today's translation limit is reached. Guests see English until you save again.",
      busy: "Arabic and Spanish not updated: the translation service is busy. Guests see English until you save again.",
    },
    lastChanged: "Last changed {time} UAE time",
  },

  ar: {
    title: "التحويل المصرفي",
    balanceDue: "موعد الرصيد",
    balanceDaysAfter: "أيام قبل الوصول",
    balanceHint: "فارغ: لا يمكن للضيوف إلا الدفع بالكامل.",
    window: "مهلة التحويل",
    units: { minutes: "دقائق", hours: "ساعات", days: "أيام" },
    windowUnit: "الوحدة",
    windowHint:
      "المدة المتاحة للضيف ليدفع بعد الطلب. فارغ: تبقى الطلبات مغلقة. من 35 دقيقة إلى 30 يومًا. طلبات TEST على موقع المعاينة تستخدم 35 دقيقة.",
    windowHours: "مهلة التحويل (ساعات)",
    windowHoursHint:
      "المدة المتاحة للضيف ليدفع بعد الطلب، بساعات كاملة. فارغ: تبقى الطلبات مغلقة. من 1 إلى 720 ساعة (30 يومًا). طلبات TEST على موقع المعاينة تستخدم 35 دقيقة.",
    accountName: "اسم الحساب",
    bankName: "المصرف",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    bankAddress: "عنوان المصرف",
    note: "سطر الملاحظة",
    noteHint: "يُعرض للضيوف مع بيانات المصرف. اكتبه بالإنجليزية؛ تُملأ العربية والإسبانية عند الحفظ.",
    editTranslations: "تعديل الترجمات",
    hideTranslations: "إخفاء الترجمات",
    arabic: "العربية",
    spanish: "الإسبانية",
    errors: {
      windowRange: "استخدم من 35 دقيقة إلى 30 يومًا.",
      windowHoursRange: "استخدم من 1 إلى 720 ساعة.",
      whole: "استخدم عددًا صحيحًا.",
      daysRange: "استخدم من 0 إلى 365 يومًا.",
      checksum: "رقم IBAN هذا غير صحيح. ابحث عن خطأ في الكتابة.",
      shape: "رمز SWIFT / BIC يتكوّن من 8 أو 11 حرفًا ورقمًا.",
      long: "هذا طويل جدًا: حتى {max} حرف.",
      required: "املأ كل حقول المصرف، أو أفرغها كلها.",
    },
    readiness: {
      title: "يمكن للضيوف إرسال الطلبات بعد ضبط ما يلي:",
      window: "مهلة التحويل",
      bank: "بيانات المصرف",
      terms: "نص شروط الحجز (أرسله ليُضاف)",
      set: "مضبوط",
      notSet: "غير مضبوط",
    },
    confirm: {
      title: "تُرسل بيانات المصرف هذه إلى الضيوف",
      body: "راجع اسم الحساب ورقم IBAN قبل الحفظ: {name}، {iban}.",
      save: "حفظ البيانات",
      back: "المراجعة مرة أخرى",
    },
    save: "حفظ التحويل المصرفي",
    saving: "جارٍ الحفظ…",
    saved: "حُفظ التحويل المصرفي.",
    saveFailed: "لم يُحفظ التحويل المصرفي. حاول مرة أخرى.",
    loadFailed: "تعذّر تحميل إعدادات التحويل المصرفي. أعد تحميل الصفحة.",
    translations: {
      working: "جارٍ إضافة العربية والإسبانية…",
      updated: "تم تحديث العربية والإسبانية.",
      notUpdated: "لم تُحدَّث العربية والإسبانية: يرى الضيوف الإنجليزية حتى تحفظ مرة أخرى.",
      limit: "لم تُحدَّث العربية والإسبانية: بلغ حد الترجمة اليومي. يرى الضيوف الإنجليزية حتى تحفظ مرة أخرى.",
      busy: "لم تُحدَّث العربية والإسبانية: خدمة الترجمة مشغولة. يرى الضيوف الإنجليزية حتى تحفظ مرة أخرى.",
    },
    lastChanged: "آخر تغيير {time} بتوقيت الإمارات",
  },

  es: {
    title: "Transferencia bancaria",
    balanceDue: "Saldo pendiente",
    balanceDaysAfter: "días antes de la llegada",
    balanceHint: "Vacío: los huéspedes solo pueden pagar el total.",
    window: "Plazo de transferencia",
    units: { minutes: "Minutos", hours: "Horas", days: "Días" },
    windowUnit: "Unidad",
    windowHint:
      "Cuánto tiempo tiene un huésped para pagar tras una solicitud. Vacío: las solicitudes siguen cerradas. De 35 minutos a 30 días. Las solicitudes TEST del sitio de vista previa usan 35 minutos.",
    windowHours: "Plazo de transferencia (horas)",
    windowHoursHint:
      "Cuánto tiempo tiene un huésped para pagar tras una solicitud, en horas enteras. Vacío: las solicitudes siguen cerradas. De 1 a 720 horas (30 días). Las solicitudes TEST del sitio de vista previa usan 35 minutos.",
    accountName: "Titular de la cuenta",
    bankName: "Banco",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    bankAddress: "Dirección del banco",
    note: "Línea de nota",
    noteHint: "Se muestra a los huéspedes con los datos bancarios. Escríbala en inglés; el árabe y el español se completan al guardar.",
    editTranslations: "Editar traducciones",
    hideTranslations: "Ocultar traducciones",
    arabic: "Árabe",
    spanish: "Español",
    errors: {
      windowRange: "Use de 35 minutos a 30 días.",
      windowHoursRange: "Use de 1 a 720 horas.",
      whole: "Use un número entero.",
      daysRange: "Use de 0 a 365 días.",
      checksum: "Este IBAN no es válido. Revise si hay un error de escritura.",
      shape: "Un SWIFT / BIC tiene 8 u 11 letras y cifras.",
      long: "Es demasiado largo: hasta {max} caracteres.",
      required: "Complete todos los campos bancarios o déjelos todos vacíos.",
    },
    readiness: {
      title: "Los huéspedes pueden enviar solicitudes cuando esto esté definido:",
      window: "Plazo de transferencia",
      bank: "Datos bancarios",
      terms: "Texto de las condiciones de reserva (envíelo para añadirlo)",
      set: "Definido",
      notSet: "Sin definir",
    },
    confirm: {
      title: "Se envían estos datos bancarios a los huéspedes",
      body: "Revise el titular de la cuenta y el IBAN antes de guardar: {name}, {iban}.",
      save: "Guardar datos",
      back: "Revisar de nuevo",
    },
    save: "Guardar transferencia bancaria",
    saving: "Guardando…",
    saved: "Transferencia bancaria guardada.",
    saveFailed: "La transferencia bancaria no se guardó. Inténtelo de nuevo.",
    loadFailed: "No se pudieron cargar los ajustes de transferencia bancaria. Vuelva a cargar la página.",
    translations: {
      working: "Añadiendo árabe y español…",
      updated: "Árabe y español actualizados.",
      notUpdated: "Árabe y español no actualizados: los huéspedes ven el inglés hasta que vuelva a guardar.",
      limit: "Árabe y español no actualizados: se alcanzó el límite diario de traducción. Los huéspedes ven el inglés hasta que vuelva a guardar.",
      busy: "Árabe y español no actualizados: el servicio de traducción está ocupado. Los huéspedes ven el inglés hasta que vuelva a guardar.",
    },
    lastChanged: "Último cambio {time} hora de los EAU",
  },
};
