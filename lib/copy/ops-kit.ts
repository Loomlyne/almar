// Copy for the dashboard editor kit (components/ops/*), phase 3.2 plan 11. New file; no other copy file is edited.
//
// EN is the house register of the dashboard. Strings marked CANVAS are taken verbatim from the design canvas boards
// (DashServices, DashDestinations, DashTeamLegal, DashMediaNav) in all three languages. Every other EN string is
// DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES
// (Latin American, formal "usted": owner, 2026-10-14, all dashboard copy) are DRAFTS written from the EN, flagged for the
// owner's review, in the same practice as lib/copy/journey.ts. Strings marked PANEL are the drafts 03.2-06 wrote in its
// `panel` group (lib/copy/ops-catalog.ts on gsd/phase-3.2-p06-catalog, ca93e52), taken verbatim (kit panel B, 2026-10-14).
// Never a price, a rate or legal text. `{name}` style tokens are filled with fillCopy.
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
  "alt",
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

  saveAndUpdateSite: string;
  unpublish: string;
  /** Heading of the list of what is missing before Publish works. */
  publishNeeds: string;
  /** Shown beside a disabled Delete on a published item. */
  unpublishFirst: string;
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

  /** Headings of the Arabic and Spanish blocks behind "Edit translations", and the missing lines. */
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

  /** The editor page (kit panel B, owner 2026-10-14): automatic translation. */
  editor: {
    /** PANEL. Card titles a screen may use (its own words when it has better ones). */
    sections: { text: string; price: string; photo: string; settings: string; connections: string };
    /** PANEL. At the top of the section that holds the English text. */
    englishOnly: string;
    /** While the two translation requests run. */
    translating: string;
    /** PANEL. After a Save that translated. */
    translationsUpdated: string;
    /** PANEL. */
    editTranslations: string;
    /** PANEL. */
    hideTranslations: string;
    /** PANEL. */
    translationsNote: string;
    /** PANEL. The AI did not finish (bad output, a timeout, no connection): Publish waits. */
    translationFailed: string;
    /** The daily translation allocation is used up (429 translate_limit): Publish waits. */
    translationLimit: string;
    /** The translation service is busy (503 translate_busy): Publish waits. */
    translationBusy: string;
    /** A published item: the AI did not finish, so nothing was saved and the site is unchanged. */
    translationFailedLive: string;
    /** PANEL. Next to the status while there are unsaved changes. */
    unsaved: string;
    /** Save would leave a published Arabic or Spanish text empty: the question before it does. */
    emptyLiveTitle: string;
    /** Above the list of the published texts that would go (each a `missingLine`). */
    emptyLiveText: string;
    /** The question's confirm button. */
    saveEmpty: string;
    /** I18N-04 (plan 06-01, pictures 06-01): the line under an Arabic or Spanish box the owner fixed by hand. */
    lockedNote: string;
    /** The text button at the end of that line: unlocks the box and fills it again from the English. */
    translateAgain: string;
    /** In that line while Translate again waits for the AI. */
    translatingAgain: string;
    /** In that line when the AI did not answer: the box stays empty and unlocked; the next Save fills it. */
    translateAgainFailed: string;
    /** Screen-reader suffix of a locked box's label. */
    lockedLabel: string;
  };
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

    saveAndUpdateSite: "Save and update site",
    unpublish: "Unpublish",
    publishNeeds: "Publish needs:",
    unpublishFirst: "Unpublish first",
    discardTitle: "Discard changes?",
    discard: "Discard",
    keepEditing: "Keep editing",
    moveUp: "Move up",
    moveDown: "Move down",
    dragHandle: "Drag to reorder",
    order: "Order",
    warnNoBaseRate: "Published without a nightly rate: guests cannot book it yet.",
    warnNoPrice: "Published without a price: it is not offered as an add-on.",

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
      alt: "alt text",
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
      not_found: "This item no longer exists. Go back to the list and refresh it.",
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

    editor: {
      sections: { text: "Text", price: "Price", photo: "Photo", settings: "Settings", connections: "Connections" },
      englishOnly: "Write in English. Arabic and Spanish are added when you save.",
      translating: "Adding Arabic and Spanish…",
      translationsUpdated: "Arabic and Spanish updated",
      editTranslations: "Edit translations",
      hideTranslations: "Hide translations",
      translationsNote: "Arabic and Spanish were filled in from the English. Change a word only if you need to.",
      translationFailed:
        "The Arabic and Spanish translation did not finish, so Publish is waiting. Save again to try once more, or open Edit translations and type them yourself.",
      translationLimit:
        "The Arabic and Spanish translation stopped: today's translation limit is reached (it resets at 04:00 Dubai), so Publish is waiting. Save again tomorrow, or open Edit translations and type them yourself.",
      translationBusy:
        "The Arabic and Spanish translation is busy right now, so Publish is waiting. Save again in a minute, or open Edit translations and type them yourself.",
      translationFailedLive:
        "The Arabic and Spanish translation did not finish, so nothing was saved and the site is unchanged. Save again to try once more, or open Edit translations and type them yourself.",
      unsaved: "Unsaved changes",
      emptyLiveTitle: "Save with a published translation empty?",
      emptyLiveText: "This text is on the site now. If you save it empty, the site loses it:",
      saveEmpty: "Save empty",
      lockedNote: "Your own text. A change to the English will not replace it.",
      translateAgain: "Translate again",
      translatingAgain: "Translating…",
      translateAgainFailed: "Could not translate now. It will be filled when you save.",
      lockedLabel: "locked",
    },
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

    saveAndUpdateSite: "حفظ وتحديث الموقع",
    unpublish: "إلغاء النشر",
    publishNeeds: "للنشر يلزم:",
    unpublishFirst: "ألغِ النشر أولًا",
    discardTitle: "تجاهل التغييرات؟",
    discard: "تجاهل",
    keepEditing: "متابعة التعديل",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    dragHandle: "اسحب لإعادة الترتيب",
    order: "الترتيب",
    warnNoBaseRate: "منشور بلا سعر لليلة: لا يستطيع الضيوف حجزه بعد.",
    warnNoPrice: "منشور بلا سعر: لا يُعرض كإضافة.",

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
      alt: "النص البديل",
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
      not_found: "هذا العنصر لم يعد موجودًا. ارجع إلى القائمة وحدّثها.",
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

    editor: {
      sections: { text: "النص", price: "السعر", photo: "الصورة", settings: "الإعدادات", connections: "الارتباطات" },
      englishOnly: "اكتب بالإنجليزية. تُضاف العربية والإسبانية عند الحفظ.",
      translating: "جارٍ إضافة العربية والإسبانية…",
      translationsUpdated: "تم تحديث العربية والإسبانية",
      editTranslations: "تعديل الترجمات",
      hideTranslations: "إخفاء الترجمات",
      translationsNote: "تمت كتابة العربية والإسبانية تلقائيًا من النص الإنجليزي. غيّر كلمة فقط عند الحاجة.",
      translationFailed:
        "لم تكتمل ترجمة العربية والإسبانية، لذلك ينتظر النشر. احفظ مرة أخرى للمحاولة، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
      translationLimit:
        "توقفت ترجمة العربية والإسبانية: بلغت الترجمة حدّها لهذا اليوم (يُعاد ضبطه الساعة 04:00 بتوقيت دبي)، لذلك ينتظر النشر. احفظ مرة أخرى غدًا، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
      translationBusy:
        "ترجمة العربية والإسبانية مشغولة الآن، لذلك ينتظر النشر. احفظ مرة أخرى بعد دقيقة، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
      translationFailedLive:
        "لم تكتمل ترجمة العربية والإسبانية، لذلك لم يُحفظ شيء ولم يتغير الموقع. احفظ مرة أخرى للمحاولة، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
      unsaved: "تغييرات غير محفوظة",
      emptyLiveTitle: "حفظ ترجمة منشورة فارغة؟",
      emptyLiveText: "هذا النص ظاهر على الموقع الآن. إذا حفظته فارغًا فسيُحذف من الموقع:",
      saveEmpty: "احفظه فارغًا",
      lockedNote: "نصّك الخاص. لن يستبدله أي تغيير في النص الإنجليزي.",
      translateAgain: "ترجمة من جديد",
      translatingAgain: "جارٍ الترجمة…",
      translateAgainFailed: "تعذّرت الترجمة الآن. ستُملأ عند الحفظ.",
      lockedLabel: "مقفل",
    },
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

    saveAndUpdateSite: "Guardar y actualizar el sitio",
    unpublish: "Dejar de publicar",
    publishNeeds: "Para publicar falta:",
    unpublishFirst: "Primero deje de publicarlo",
    discardTitle: "¿Descartar los cambios?",
    discard: "Descartar",
    keepEditing: "Seguir editando",
    moveUp: "Subir",
    moveDown: "Bajar",
    dragHandle: "Arrastre para reordenar",
    order: "Orden",
    warnNoBaseRate: "Publicado sin tarifa por noche: los huéspedes aún no pueden reservarlo.",
    warnNoPrice: "Publicado sin precio: no se ofrece como complemento.",

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
      alt: "texto alternativo",
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
      not_found: "Este elemento ya no existe. Vuelva a la lista y actualícela.",
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
      network: "Sin conexión. Revise su conexión a internet e inténtelo de nuevo.",
    },

    chooseDates: "Elegir fechas",
    datePickFirst: "Elija el primer día.",
    datePickLast: "Elija el último día. Elija el mismo día otra vez para un solo día.",
    datePickAfter: "Elija un día a partir del {date}.",
    calendarLabel: "Calendario",

    noResults: "Sin resultados",
    noneConnected: "Nada conectado todavía.",
    connected: "Conectado",
    removeNamed: "Quitar {name}",

    editor: {
      sections: { text: "Texto", price: "Precio", photo: "Foto", settings: "Ajustes", connections: "Conexiones" },
      englishOnly: "Escriba en inglés. El árabe y el español se añaden al guardar.",
      translating: "Añadiendo árabe y español…",
      translationsUpdated: "Árabe y español actualizados",
      editTranslations: "Editar traducciones",
      hideTranslations: "Ocultar traducciones",
      translationsNote: "El árabe y el español se completaron a partir del inglés. Cambie una palabra solo si lo necesita.",
      translationFailed:
        "La traducción al árabe y al español no terminó, así que Publicar está en espera. Guarde de nuevo para reintentar, o abra «Editar traducciones» y escríbalas usted.",
      translationLimit:
        "La traducción al árabe y al español se detuvo: se alcanzó el límite de traducción de hoy (se renueva a las 04:00, hora de Dubái), así que Publicar está en espera. Guarde de nuevo mañana, o abra «Editar traducciones» y escríbalas usted.",
      translationBusy:
        "La traducción al árabe y al español está ocupada en este momento, así que Publicar está en espera. Guarde de nuevo en un minuto, o abra «Editar traducciones» y escríbalas usted.",
      translationFailedLive:
        "La traducción al árabe y al español no terminó, así que no se guardó nada y el sitio no cambió. Guarde de nuevo para reintentar, o abra «Editar traducciones» y escríbalas usted.",
      unsaved: "Cambios sin guardar",
      emptyLiveTitle: "¿Guardar con una traducción publicada vacía?",
      emptyLiveText: "Este texto está ahora en el sitio. Si queda vacío al guardar, el sitio lo pierde:",
      saveEmpty: "Guardar vacío",
      lockedNote: "Su propio texto. Un cambio en el inglés no lo reemplazará.",
      translateAgain: "Traducir de nuevo",
      translatingAgain: "Traduciendo…",
      translateAgainFailed: "No se pudo traducir ahora. Se completará cuando guarde.",
      lockedLabel: "bloqueado",
    },
  },
};
