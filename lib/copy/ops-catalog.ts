// Copy for Catalog -> Destinations and Catalog -> Experiences and services (app/dashboard/(ops)/catalog/destinations,
// .../experiences), phase 3.2 plan 06. New file; no other copy file is edited. The kit's own words (Save, Publish,
// Close, Published, Draft, Remove, Connect selected, the errors) stay in lib/copy/ops-kit.ts.
//
// CANVAS strings are taken verbatim from the design canvas boards DashDestinations and DashServices in all three
// languages. Every other EN string is DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly
// Modern Standard Arabic) and ES (neutral Latin American, formal "usted": owner, 2026-10-14, all dashboard copy) are DRAFTS
// written from the EN, flagged for the owner's review. Counts are Intl.PluralRules forms (`#` is the number), picked by
// formatPlural (lib/journey-format.ts). Never a price, a rate or legal text. Imported directly; deliberately not
// registered in lib/copy/index.ts.

import type { PluralForms } from "../journey-format";

export type OpsCatalogLocale = "en" | "ar" | "es";

export type OpsCatalogCopy = {
  destinations: {
    /** CANVAS. */
    title: string;
    /** CANVAS. */
    newDestination: string;
    /** CANVAS. */
    search: string;
    /** CANVAS: column headers. */
    colName: string;
    colStays: string;
    colStatus: string;
    /** CANVAS. */
    empty: string;
    /** CANVAS: the panel's tabs. */
    tabDetails: string;
    tabStays: string;
    tabExperiences: string;
    /** CANVAS: field labels. */
    fieldName: string;
    fieldShortLine: string;
    fieldDescription: string;
    fieldPhoto: string;
    /** Not on the canvas (C-18). */
    fieldRegion: string;
    fieldNightsLine: string;
    fieldInsetPhoto: string;
    fieldSlug: string;
    slugHint: string;
    slugLocked: string;
    /** The read-only Stays tab. */
    staysNote: string;
    staysNone: string;
    /** The Experiences and services tab: destination-level items only. */
    experiencesTitle: string;
    experiencesHint: string;
    experiencesSearch: string;
    /** Delete: `{name}` in the confirm. */
    deleteDestination: string;
    deleteTitle: string;
    deleteNeedsUnpublish: string;
    deleteNeedsMove: string;
    /** Accessible name of the table. */
    caption: string;
  };
  /** The redesigned panel (owner, 2026-10-14): sections, automatic translation. DRAFTS. */
  panel: {
    sectionText: string;
    sectionPrice: string;
    sectionPhoto: string;
    sectionSettings: string;
    sectionConnections: string;
    /** Under the English fields: the one language Maria writes in. */
    englishOnly: string;
    translationsUpdated: string;
    editTranslations: string;
    hideTranslations: string;
    translationsNote: string;
    /** Publish waits: the AI did not finish. */
    translationFailed: string;
    /** Status next to the save button on an item with unsaved changes. */
    unsaved: string;
  };
  items: {
    /** CANVAS. */
    title: string;
    newItem: string;
    search: string;
    filterAll: string;
    filterExperiences: string;
    filterServices: string;
    allDestinations: string;
    allStays: string;
    colName: string;
    colType: string;
    colUnit: string;
    colPrice: string;
    colConnected: string;
    colStatus: string;
    kindExperience: string;
    kindService: string;
    unitPerson: string;
    unitNight: string;
    unitTrip: string;
    /** CANVAS: "[n] destinations, [n] stays" as two plural forms joined by `connectedJoin`. */
    destinationCount: PluralForms;
    stayCount: PluralForms;
    connectedJoin: string;
    /** CANVAS. */
    empty: string;
    tabDetails: string;
    tabConnections: string;
    fieldName: string;
    fieldDescription: string;
    fieldPhoto: string;
    /** Not on the canvas (C-18). */
    fieldDuration: string;
    fieldType: string;
    fieldUnit: string;
    fieldPrice: string;
    priceHint: string;
    fieldSlug: string;
    slugHint: string;
    slugLocked: string;
    isUae: string;
    isHomePickup: string;
    homePickupHint: string;
    /** The server's 409 invalid on is_home_pickup, in words, under that toggle. */
    homePickupRefused: string;
    /** CANVAS (Connections tab). */
    connectionsIntro: string;
    searchDestinations: string;
    searchStays: string;
    destinationsHeading: string;
    staysHeading: string;
    deleteTitle: string;
    /** No row matches the filters. */
    emptyFiltered: string;
    caption: string;
    /** `{amount}`; AED in every language. */
    aedAmount: string;
    priceNotSet: string;
  };
};

/** Fills `{token}` placeholders. A token with no value is left as written. */
export function fillCatalogCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export const OPS_CATALOG_COPY: Record<OpsCatalogLocale, OpsCatalogCopy> = {
  en: {
    destinations: {
      title: "Destinations",
      newDestination: "New destination",
      search: "Search",
      colName: "Name",
      colStays: "Stays",
      colStatus: "Status",
      empty: "No destinations yet",
      tabDetails: "Details",
      tabStays: "Stays",
      tabExperiences: "Experiences and services",
      fieldName: "Name",
      fieldShortLine: "Short line",
      fieldDescription: "Description",
      fieldPhoto: "Photo",
      fieldRegion: "Region",
      fieldNightsLine: "Nights line",
      fieldInsetPhoto: "Inset photo (optional)",
      fieldSlug: "Web address",
      slugHint: "Lowercase letters, numbers and hyphens. It cannot change after publishing.",
      slugLocked: "The web address cannot change after publishing.",
      staysNote: "A stay's destination is set in the stay's own Details.",
      staysNone: "No stays in this destination yet.",
      experiencesTitle: "Experiences and services",
      experiencesHint:
        "Items guests can add for the whole destination. An item for one stay only is set in that item's Connections.",
      experiencesSearch: "Search experiences and services",
      deleteDestination: "Delete destination",
      deleteTitle: "Delete {name}? This cannot be undone.",
      deleteNeedsUnpublish: "Unpublish it first",
      deleteNeedsMove: "Move its stays first",
      caption: "Destinations",
    },
    panel: {
      sectionText: "Text",
      sectionPrice: "Price",
      sectionPhoto: "Photo",
      sectionSettings: "Settings",
      sectionConnections: "Connections",
      englishOnly: "Write in English. Arabic and Spanish are added when you save.",
      translationsUpdated: "Arabic and Spanish updated",
      editTranslations: "Edit translations",
      hideTranslations: "Hide translations",
      translationsNote: "Arabic and Spanish were filled in from the English. Change a word only if you need to.",
      translationFailed:
        "The Arabic and Spanish translation did not finish, so Publish is waiting. Save again to try once more, or open Edit translations and type them yourself.",
      unsaved: "Unsaved changes",
    },
    items: {
      title: "Experiences and services",
      newItem: "New experience",
      search: "Search experiences and services",
      filterAll: "All",
      filterExperiences: "Experiences",
      filterServices: "Services",
      allDestinations: "All destinations",
      allStays: "All stays",
      colName: "Name",
      colType: "Type",
      colUnit: "Unit",
      colPrice: "Price",
      colConnected: "Connected to",
      colStatus: "Status",
      kindExperience: "Experience",
      kindService: "Service",
      unitPerson: "per person",
      unitNight: "per night",
      unitTrip: "per trip",
      destinationCount: { one: "# destination", other: "# destinations" },
      stayCount: { one: "# stay", other: "# stays" },
      connectedJoin: ", ",
      empty: "No experiences yet",
      tabDetails: "Details",
      tabConnections: "Connections",
      fieldName: "Name",
      fieldDescription: "Description",
      fieldPhoto: "Photo",
      fieldDuration: "Duration line",
      fieldType: "Type",
      fieldUnit: "Unit",
      fieldPrice: "Price in AED",
      priceHint: "Leave empty if not set",
      fieldSlug: "Web address",
      slugHint: "Lowercase letters, numbers and hyphens. It cannot change after publishing.",
      slugLocked: "The web address cannot change after publishing.",
      isUae: "UAE-side service",
      isHomePickup: "Home pickup · pre-selected at checkout",
      homePickupHint: "Only one item can be the home pickup.",
      homePickupRefused: "Another item is already the home pickup. Turn it off there first.",
      connectionsIntro:
        "Choose where guests can add this item. It can be connected to whole destinations, to single stays, or both.",
      searchDestinations: "Search destinations",
      searchStays: "Search stays",
      destinationsHeading: "Destinations",
      staysHeading: "Stays",
      deleteTitle: "Delete {name}? This cannot be undone.",
      emptyFiltered: "Nothing matches these filters.",
      caption: "Experiences and services",
      aedAmount: "AED {amount}",
      priceNotSet: "Not set",
    },
  },
  ar: {
    destinations: {
      title: "الوجهات",
      newDestination: "وجهة جديدة",
      search: "بحث",
      colName: "الاسم",
      colStays: "الإقامات",
      colStatus: "الحالة",
      empty: "لا وجهات بعد",
      tabDetails: "التفاصيل",
      tabStays: "الإقامات",
      tabExperiences: "التجارب والخدمات",
      fieldName: "الاسم",
      fieldShortLine: "سطر قصير",
      fieldDescription: "الوصف",
      fieldPhoto: "الصورة",
      fieldRegion: "المنطقة",
      fieldNightsLine: "سطر الليالي",
      fieldInsetPhoto: "صورة إضافية (اختيارية)",
      fieldSlug: "عنوان الويب",
      slugHint: "أحرف صغيرة وأرقام وشرطات. لا يمكن تغييره بعد النشر.",
      slugLocked: "لا يمكن تغيير عنوان الويب بعد النشر.",
      staysNote: "تُحدَّد وجهة الإقامة في تفاصيل الإقامة نفسها.",
      staysNone: "لا إقامات في هذه الوجهة بعد.",
      experiencesTitle: "التجارب والخدمات",
      experiencesHint:
        "بنود يمكن للضيوف إضافتها للوجهة كلها. البند الخاص بإقامة واحدة يُحدَّد في ارتباطات ذلك البند.",
      experiencesSearch: "ابحث في التجارب والخدمات",
      deleteDestination: "حذف الوجهة",
      deleteTitle: "حذف {name}؟ لا يمكن التراجع عن ذلك.",
      deleteNeedsUnpublish: "ألغِ نشرها أولًا",
      deleteNeedsMove: "انقل إقاماتها أولًا",
      caption: "الوجهات",
    },
    panel: {
      sectionText: "النص",
      sectionPrice: "السعر",
      sectionPhoto: "الصورة",
      sectionSettings: "الإعدادات",
      sectionConnections: "الارتباطات",
      englishOnly: "اكتب بالإنجليزية. تُضاف العربية والإسبانية عند الحفظ.",
      translationsUpdated: "تم تحديث العربية والإسبانية",
      editTranslations: "تعديل الترجمات",
      hideTranslations: "إخفاء الترجمات",
      translationsNote: "تمت كتابة العربية والإسبانية تلقائيًا من النص الإنجليزي. غيّر كلمة فقط عند الحاجة.",
      translationFailed:
        "لم تكتمل ترجمة العربية والإسبانية، لذلك ينتظر النشر. احفظ مرة أخرى للمحاولة، أو افتح «تعديل الترجمات» واكتبها بنفسك.",
      unsaved: "تغييرات غير محفوظة",
    },
    items: {
      title: "التجارب والخدمات",
      newItem: "تجربة جديدة",
      search: "ابحث في التجارب والخدمات",
      filterAll: "الكل",
      filterExperiences: "التجارب",
      filterServices: "الخدمات",
      allDestinations: "كل الوجهات",
      allStays: "كل الإقامات",
      colName: "الاسم",
      colType: "النوع",
      colUnit: "الوحدة",
      colPrice: "السعر",
      colConnected: "مرتبط بـ",
      colStatus: "الحالة",
      kindExperience: "تجربة",
      kindService: "خدمة",
      unitPerson: "للشخص",
      unitNight: "لكل ليلة",
      unitTrip: "للرحلة",
      destinationCount: {
        zero: "لا وجهات",
        one: "وجهة واحدة",
        two: "وجهتان",
        few: "# وجهات",
        many: "# وجهة",
        other: "# وجهة",
      },
      stayCount: {
        zero: "لا إقامات",
        one: "إقامة واحدة",
        two: "إقامتان",
        few: "# إقامات",
        many: "# إقامة",
        other: "# إقامة",
      },
      connectedJoin: "، ",
      empty: "لا تجارب بعد",
      tabDetails: "التفاصيل",
      tabConnections: "الارتباطات",
      fieldName: "الاسم",
      fieldDescription: "الوصف",
      fieldPhoto: "الصورة",
      fieldDuration: "سطر المدة",
      fieldType: "النوع",
      fieldUnit: "الوحدة",
      fieldPrice: "السعر بالدرهم",
      priceHint: "اتركه فارغًا إن لم يُحدَّد",
      fieldSlug: "عنوان الويب",
      slugHint: "أحرف صغيرة وأرقام وشرطات. لا يمكن تغييره بعد النشر.",
      slugLocked: "لا يمكن تغيير عنوان الويب بعد النشر.",
      isUae: "خدمة داخل الإمارات",
      isHomePickup: "الاستلام من المنزل · محدَّد مسبقًا عند الدفع",
      homePickupHint: "يمكن أن يكون بند واحد فقط هو الاستلام من المنزل.",
      homePickupRefused: "بند آخر هو الاستلام من المنزل بالفعل. أوقفه هناك أولًا.",
      connectionsIntro:
        "اختر أين يمكن للضيوف إضافة هذا البند. يمكن ربطه بوجهات كاملة أو بإقامات محددة أو بكليهما.",
      searchDestinations: "ابحث في الوجهات",
      searchStays: "ابحث في الإقامات",
      destinationsHeading: "الوجهات",
      staysHeading: "الإقامات",
      deleteTitle: "حذف {name}؟ لا يمكن التراجع عن ذلك.",
      emptyFiltered: "لا شيء يطابق هذه التصفية.",
      caption: "التجارب والخدمات",
      aedAmount: "AED {amount}",
      priceNotSet: "غير محدد",
    },
  },
  es: {
    destinations: {
      title: "Destinos",
      newDestination: "Nuevo destino",
      search: "Buscar",
      colName: "Nombre",
      colStays: "Estancias",
      colStatus: "Estado",
      empty: "Aún no hay destinos",
      tabDetails: "Detalles",
      tabStays: "Estancias",
      tabExperiences: "Experiencias y servicios",
      fieldName: "Nombre",
      fieldShortLine: "Línea breve",
      fieldDescription: "Descripción",
      fieldPhoto: "Foto",
      fieldRegion: "Región",
      fieldNightsLine: "Línea de noches",
      fieldInsetPhoto: "Foto secundaria (opcional)",
      fieldSlug: "Dirección web",
      slugHint: "Letras minúsculas, números y guiones. No se puede cambiar después de publicar.",
      slugLocked: "La dirección web no se puede cambiar después de publicar.",
      staysNote: "El destino de una estancia se define en los Detalles de esa estancia.",
      staysNone: "Aún no hay estancias en este destino.",
      experiencesTitle: "Experiencias y servicios",
      experiencesHint:
        "Elementos que los huéspedes pueden añadir en todo el destino. Un elemento de una sola estancia se define en las Conexiones de ese elemento.",
      experiencesSearch: "Buscar experiencias y servicios",
      deleteDestination: "Eliminar destino",
      deleteTitle: "¿Eliminar {name}? No se puede deshacer.",
      deleteNeedsUnpublish: "Primero deje de publicarlo",
      deleteNeedsMove: "Primero mueva sus estancias",
      caption: "Destinos",
    },
    panel: {
      sectionText: "Texto",
      sectionPrice: "Precio",
      sectionPhoto: "Foto",
      sectionSettings: "Ajustes",
      sectionConnections: "Conexiones",
      englishOnly: "Escriba en inglés. El árabe y el español se añaden al guardar.",
      translationsUpdated: "Árabe y español actualizados",
      editTranslations: "Editar traducciones",
      hideTranslations: "Ocultar traducciones",
      translationsNote: "El árabe y el español se completaron a partir del inglés. Cambie una palabra solo si lo necesita.",
      translationFailed:
        "La traducción al árabe y al español no terminó, así que Publicar está en espera. Guarde de nuevo para reintentar, o abra «Editar traducciones» y escríbalas usted.",
      unsaved: "Cambios sin guardar",
    },
    items: {
      title: "Experiencias y servicios",
      newItem: "Nueva experiencia",
      search: "Buscar experiencias y servicios",
      filterAll: "Todo",
      filterExperiences: "Experiencias",
      filterServices: "Servicios",
      allDestinations: "Todos los destinos",
      allStays: "Todas las estancias",
      colName: "Nombre",
      colType: "Tipo",
      colUnit: "Unidad",
      colPrice: "Precio",
      colConnected: "Conectado a",
      colStatus: "Estado",
      kindExperience: "Experiencia",
      kindService: "Servicio",
      unitPerson: "por persona",
      unitNight: "por noche",
      unitTrip: "por viaje",
      destinationCount: { one: "# destino", other: "# destinos" },
      stayCount: { one: "# estancia", other: "# estancias" },
      connectedJoin: ", ",
      empty: "Aún no hay experiencias",
      tabDetails: "Detalles",
      tabConnections: "Conexiones",
      fieldName: "Nombre",
      fieldDescription: "Descripción",
      fieldPhoto: "Foto",
      fieldDuration: "Línea de duración",
      fieldType: "Tipo",
      fieldUnit: "Unidad",
      fieldPrice: "Precio en AED",
      priceHint: "Déjelo vacío si no está definido",
      fieldSlug: "Dirección web",
      slugHint: "Letras minúsculas, números y guiones. No se puede cambiar después de publicar.",
      slugLocked: "La dirección web no se puede cambiar después de publicar.",
      isUae: "Servicio en los EAU",
      isHomePickup: "Recogida en casa · preseleccionada al pagar",
      homePickupHint: "Solo un elemento puede ser la recogida en casa.",
      homePickupRefused: "Otro elemento ya es la recogida en casa. Desactívelo allí primero.",
      connectionsIntro:
        "Elija dónde pueden añadir los huéspedes este elemento: destinos completos, estancias concretas o ambos.",
      searchDestinations: "Buscar destinos",
      searchStays: "Buscar estancias",
      destinationsHeading: "Destinos",
      staysHeading: "Estancias",
      deleteTitle: "¿Eliminar {name}? No se puede deshacer.",
      emptyFiltered: "Nada coincide con estos filtros.",
      caption: "Experiencias y servicios",
      aedAmount: "AED {amount}",
      priceNotSet: "Sin definir",
    },
  },
};
