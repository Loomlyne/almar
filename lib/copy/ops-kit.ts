// Copy for the dashboard editor kit (components/ops/*), phase 3.2 plan 11. New file; no other copy file is edited.
//
// EN is the house register of the dashboard. Strings marked CANVAS are taken verbatim from the design canvas boards
// (DashServices, DashDestinations, DashTeamLegal, DashMediaNav) in all three languages. Every other EN string is
// DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES
// (neutral Latin American, formal "usted") are DRAFTS written from the EN, flagged for the owner's review, in the same
// practice as lib/copy/journey.ts. Never a price, a rate or legal text. `{name}` style tokens are filled with fillCopy.
// Imported directly by the kit; deliberately not registered in lib/copy/index.ts.

export type OpsKitLocale = "en" | "ar" | "es";

/** Field names the kit can say in words. The server's `missing` list and the publish check use these names (contract 5.9). */
export const KIT_FIELD_KEYS = [
  "name",
  "title",
  "tagline",
  "short_line",
  "region",
  "summary",
  "nights_label",
  "neighborhood",
  "guests_label",
  "bathrooms_label",
  "beds_label",
  "price_label",
  "price_note",
  "description",
  "amenities",
  "inclusions",
  "policy_headings",
  "duration_label",
  "role",
  "bio",
  "ideal_for_label",
  "ideal_for",
  "body",
  "photo",
  "inset_photo",
  "destination_ids",
  "destination_published",
] as const;
export type KitFieldKey = (typeof KIT_FIELD_KEYS)[number];

export const KIT_ERROR_CODES = [
  "invalid",
  "not_owner",
  "wrong_origin",
  "not_found",
  "slug_taken",
  "rate_overlap",
  "in_use",
  "published",
  "publish_incomplete",
  "has_published_stays",
  "parent_unpublished",
  "amenities_mismatch",
  "too_large",
  "wrong_type",
  "unavailable",
  "network",
] as const;
export type KitErrorCode = (typeof KIT_ERROR_CODES)[number];

export type OpsKitCopy = {
  /** CANVAS. */
  close: string;
  /** CANVAS. */
  save: string;
  /** CANVAS. */
  remove: string;
  /** CANVAS. */
  search: string;
  /** CANVAS. */
  cancel: string;
  /** CANVAS. */
  delete: string;
  /** CANVAS. */
  published: string;
  /** CANVAS. */
  draft: string;
  /** CANVAS. */
  connectSelected: string;
  /** CANVAS (DashMediaNav). */
  publish: string;
  /** CANVAS pattern "2 selected": `{n}`. */
  selected: string;
  /** Same as `selected` for exactly one (Spanish differs). */
  selectedOne: string;
  /** CANVAS: shown under the language tabs while Arabic or Spanish is a draft. */
  draftNote: string;

  saveAndUpdateSite: string;
  unpublish: string;
  /** Heading of the list of what is missing before Publish works. */
  publishNeeds: string;
  /** Shown beside a disabled Delete on a published item. */
  unpublishFirst: string;
  /** Chip on a language tab with no text yet. */
  missing: string;
  checkedTranslation: string;
  discardTitle: string;
  discard: string;
  keepEditing: string;
  moveUp: string;
  moveDown: string;
  dragHandle: string;
  /** Column header of the reorder controls (screen readers only). */
  order: string;
  warnNoBaseRate: string;
  warnNoPrice: string;

  /** Accessible name of the EN / AR / ES tab list. */
  languageTabs: string;
  /** Accessible name of a panel's own tab list. */
  sections: string;
  languages: Record<OpsKitLocale, string>;
  /** One missing line for a per-language field: `{language}` `{field}`. */
  missingLine: string;
  fields: Record<KitFieldKey, string>;
  /** `{field}`: the first bad field of a 400 invalid. */
  invalidField: string;
  errors: Record<KitErrorCode, string>;

  chooseDates: string;
  datePickFirst: string;
  datePickLast: string;
  /** `{date}` DD/MM/YYYY. */
  datePickAfter: string;
  calendarLabel: string;

  noResults: string;
  noneConnected: string;
  connected: string;
  /** `{name}`: the accessible name of a Remove button. */
  removeNamed: string;
};

/** Fills `{token}` placeholders. A token with no value is left as written. */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export const OPS_KIT_COPY: Record<OpsKitLocale, OpsKitCopy> = {
  en: {
    close: "Close",
    save: "Save",
    remove: "Remove",
    search: "Search",
    cancel: "Cancel",
    delete: "Delete",
    published: "Published",
    draft: "Draft",
    connectSelected: "Connect selected",
    publish: "Publish",
    selected: "{n} selected",
    selectedOne: "{n} selected",
    draftNote: "Arabic and Spanish are drafts for owner review.",

    saveAndUpdateSite: "Save and update site",
    unpublish: "Unpublish",
    publishNeeds: "Publish needs:",
    unpublishFirst: "Unpublish first",
    missing: "Missing",
    checkedTranslation: "I checked this translation",
    discardTitle: "Discard changes?",
    discard: "Discard",
    keepEditing: "Keep editing",
    moveUp: "Move up",
    moveDown: "Move down",
    dragHandle: "Drag to reorder",
    order: "Order",
    warnNoBaseRate: "Published without a nightly rate: guests cannot book it yet.",
    warnNoPrice: "Published without a price: it is not offered as an add-on.",

    languageTabs: "Language",
    sections: "Sections",
    languages: { en: "English", ar: "Arabic", es: "Spanish" },
    missingLine: "{language} {field}",
    fields: {
      name: "name",
      title: "title",
      tagline: "tagline",
      short_line: "short line",
      region: "region",
      summary: "summary",
      nights_label: "nights line",
      neighborhood: "neighborhood",
      guests_label: "guests line",
      bathrooms_label: "bathrooms line",
      beds_label: "beds line",
      price_label: "price line",
      price_note: "price note",
      description: "description",
      amenities: "amenities",
      inclusions: "inclusions",
      policy_headings: "policy headings",
      duration_label: "duration line",
      role: "role",
      bio: "bio",
      ideal_for_label: "ideal-for label",
      ideal_for: "ideal-for text",
      body: "body text",
      photo: "A photo",
      inset_photo: "An inset photo",
      destination_ids: "One destination",
      destination_published: "The destination is published",
    },
    invalidField: "Check {field} and try again.",
    errors: {
      invalid: "Something in this form is not valid. Check the fields and try again.",
      not_owner: "This session is not the owner's. Sign in again.",
      wrong_origin: "This request came from the wrong address. Open the dashboard at its own address and try again.",
      not_found: "This item no longer exists. Close the panel and refresh the list.",
      slug_taken: "Another item already uses this web address.",
      rate_overlap: "Another range of the same length already covers these nights.",
      in_use: "This is still used elsewhere. Remove it from there first.",
      published: "This item is published. Unpublish it first.",
      publish_incomplete: "This item cannot be published yet: required items are missing.",
      has_published_stays: "Some stays in this destination are still published. Unpublish them first.",
      parent_unpublished: "The destination of this stay is not published. Publish the destination first.",
      amenities_mismatch: "The Arabic and Spanish amenities need the same number of lines as the English.",
      too_large: "This file is too large.",
      wrong_type: "This file type is not accepted.",
      unavailable: "The server did not answer. Try again in a moment.",
      network: "No connection. Check your internet and try again.",
    },

    chooseDates: "Choose dates",
    datePickFirst: "Choose the first day.",
    datePickLast: "Choose the last day. Choose the same day again for one day.",
    datePickAfter: "Choose a day on or after {date}.",
    calendarLabel: "Calendar",

    noResults: "No results",
    noneConnected: "Nothing connected yet.",
    connected: "Connected",
    removeNamed: "Remove {name}",
  },
  ar: {
    close: "إغلاق",
    save: "حفظ",
    remove: "إزالة",
    search: "بحث",
    cancel: "إلغاء",
    delete: "حذف",
    published: "منشور",
    draft: "مسودة",
    connectSelected: "ربط المحدد",
    publish: "نشر",
    selected: "تم اختيار {n}",
    selectedOne: "تم اختيار {n}",
    draftNote: "العربية والإسبانية مسودات بانتظار مراجعة المالك.",

    saveAndUpdateSite: "حفظ وتحديث الموقع",
    unpublish: "إلغاء النشر",
    publishNeeds: "للنشر يلزم:",
    unpublishFirst: "ألغِ النشر أولًا",
    missing: "ناقص",
    checkedTranslation: "راجعت هذه الترجمة",
    discardTitle: "تجاهل التغييرات؟",
    discard: "تجاهل",
    keepEditing: "متابعة التعديل",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    dragHandle: "اسحب لإعادة الترتيب",
    order: "الترتيب",
    warnNoBaseRate: "منشور بلا سعر لليلة: لا يستطيع الضيوف حجزه بعد.",
    warnNoPrice: "منشور بلا سعر: لا يُعرض كإضافة.",

    languageTabs: "اللغة",
    sections: "الأقسام",
    languages: { en: "الإنجليزية", ar: "العربية", es: "الإسبانية" },
    missingLine: "{field} ({language})",
    fields: {
      name: "الاسم",
      title: "العنوان",
      tagline: "العبارة الوصفية",
      short_line: "سطر قصير",
      region: "المنطقة",
      summary: "الملخص",
      nights_label: "سطر الليالي",
      neighborhood: "الحي",
      guests_label: "سطر الضيوف",
      bathrooms_label: "سطر الحمّامات",
      beds_label: "سطر الأسرّة",
      price_label: "سطر السعر",
      price_note: "ملاحظة السعر",
      description: "الوصف",
      amenities: "المرافق",
      inclusions: "المشمولات",
      policy_headings: "عناوين السياسات",
      duration_label: "سطر المدة",
      role: "المسمّى الوظيفي",
      bio: "النبذة",
      ideal_for_label: "تسمية «مثالي لـ»",
      ideal_for: "نص «مثالي لـ»",
      body: "النص",
      photo: "صورة",
      inset_photo: "صورة إضافية",
      destination_ids: "وجهة واحدة",
      destination_published: "الوجهة منشورة",
    },
    invalidField: "راجع {field} وحاول مرة أخرى.",
    errors: {
      invalid: "هناك قيمة غير صالحة في هذا النموذج. راجع الحقول وحاول مرة أخرى.",
      not_owner: "هذه الجلسة ليست جلسة المالك. سجّل الدخول مرة أخرى.",
      wrong_origin: "جاء هذا الطلب من عنوان غير صحيح. افتح لوحة التحكم من عنوانها الخاص وحاول مرة أخرى.",
      not_found: "هذا العنصر لم يعد موجودًا. أغلق اللوحة وحدّث القائمة.",
      slug_taken: "عنصر آخر يستخدم عنوان الويب هذا.",
      rate_overlap: "نطاق آخر بالطول نفسه يغطي هذه الليالي.",
      in_use: "ما زال هذا مستخدمًا في مكان آخر. أزله من هناك أولًا.",
      published: "هذا العنصر منشور. ألغِ نشره أولًا.",
      publish_incomplete: "لا يمكن نشر هذا العنصر بعد: ينقصه بعض المطلوب.",
      has_published_stays: "ما زالت بعض الإقامات في هذه الوجهة منشورة. ألغِ نشرها أولًا.",
      parent_unpublished: "وجهة هذه الإقامة غير منشورة. انشر الوجهة أولًا.",
      amenities_mismatch: "يجب أن يساوي عدد أسطر المرافق بالعربية والإسبانية عددها بالإنجليزية.",
      too_large: "هذا الملف كبير جدًا.",
      wrong_type: "نوع هذا الملف غير مقبول.",
      unavailable: "لم يستجب الخادم. حاول مرة أخرى بعد قليل.",
      network: "لا يوجد اتصال. تحقق من الإنترنت وحاول مرة أخرى.",
    },

    chooseDates: "اختر التواريخ",
    datePickFirst: "اختر اليوم الأول.",
    datePickLast: "اختر اليوم الأخير. اختر اليوم نفسه مرة أخرى ليوم واحد.",
    datePickAfter: "اختر يومًا في {date} أو بعده.",
    calendarLabel: "التقويم",

    noResults: "لا توجد نتائج",
    noneConnected: "لا شيء مرتبط بعد.",
    connected: "المرتبط",
    removeNamed: "إزالة {name}",
  },
  es: {
    close: "Cerrar",
    save: "Guardar",
    remove: "Quitar",
    search: "Buscar",
    cancel: "Cancelar",
    delete: "Eliminar",
    published: "Publicado",
    draft: "Borrador",
    connectSelected: "Conectar seleccionados",
    publish: "Publicar",
    selected: "{n} seleccionados",
    selectedOne: "{n} seleccionado",
    draftNote: "El árabe y el español son borradores para revisión del propietario.",

    saveAndUpdateSite: "Guardar y actualizar el sitio",
    unpublish: "Dejar de publicar",
    publishNeeds: "Para publicar falta:",
    unpublishFirst: "Primero deje de publicarlo",
    missing: "Falta",
    checkedTranslation: "Revisé esta traducción",
    discardTitle: "¿Descartar los cambios?",
    discard: "Descartar",
    keepEditing: "Seguir editando",
    moveUp: "Subir",
    moveDown: "Bajar",
    dragHandle: "Arrastre para reordenar",
    order: "Orden",
    warnNoBaseRate: "Publicado sin tarifa por noche: los huéspedes aún no pueden reservarlo.",
    warnNoPrice: "Publicado sin precio: no se ofrece como complemento.",

    languageTabs: "Idioma",
    sections: "Secciones",
    languages: { en: "inglés", ar: "árabe", es: "español" },
    missingLine: "{field} en {language}",
    fields: {
      name: "nombre",
      title: "título",
      tagline: "lema",
      short_line: "línea breve",
      region: "región",
      summary: "resumen",
      nights_label: "línea de noches",
      neighborhood: "barrio",
      guests_label: "línea de huéspedes",
      bathrooms_label: "línea de baños",
      beds_label: "línea de camas",
      price_label: "línea de precio",
      price_note: "nota de precio",
      description: "descripción",
      amenities: "comodidades",
      inclusions: "inclusiones",
      policy_headings: "títulos de políticas",
      duration_label: "línea de duración",
      role: "cargo",
      bio: "biografía",
      ideal_for_label: "etiqueta «Ideal para»",
      ideal_for: "texto «Ideal para»",
      body: "texto",
      photo: "Una foto",
      inset_photo: "Una foto secundaria",
      destination_ids: "Un destino",
      destination_published: "El destino está publicado",
    },
    invalidField: "Revise {field} e inténtelo de nuevo.",
    errors: {
      invalid: "Algo en este formulario no es válido. Revise los campos e inténtelo de nuevo.",
      not_owner: "Esta sesión no es la del propietario. Inicie sesión de nuevo.",
      wrong_origin:
        "Esta solicitud llegó desde una dirección incorrecta. Abra el panel en su propia dirección e inténtelo de nuevo.",
      not_found: "Este elemento ya no existe. Cierre el panel y actualice la lista.",
      slug_taken: "Otro elemento ya usa esta dirección web.",
      rate_overlap: "Otro rango de la misma duración ya cubre estas noches.",
      in_use: "Esto todavía se usa en otro lugar. Quítelo de allí primero.",
      published: "Este elemento está publicado. Primero deje de publicarlo.",
      publish_incomplete: "Este elemento aún no se puede publicar: faltan datos obligatorios.",
      has_published_stays: "Algunas estancias de este destino siguen publicadas. Primero deje de publicarlas.",
      parent_unpublished: "El destino de esta estancia no está publicado. Publique primero el destino.",
      amenities_mismatch: "Las comodidades en árabe y español necesitan el mismo número de líneas que en inglés.",
      too_large: "Este archivo es demasiado grande.",
      wrong_type: "Este tipo de archivo no se acepta.",
      unavailable: "El servidor no respondió. Inténtelo de nuevo en un momento.",
      network: "Sin conexión. Revise su internet e inténtelo de nuevo.",
    },

    chooseDates: "Elegir fechas",
    datePickFirst: "Elija el primer día.",
    datePickLast: "Elija el último día. Elija el mismo día otra vez para un solo día.",
    datePickAfter: "Elija un día desde el {date} en adelante.",
    calendarLabel: "Calendario",

    noResults: "Sin resultados",
    noneConnected: "Nada conectado todavía.",
    connected: "Conectado",
    removeNamed: "Quitar {name}",
  },
};
