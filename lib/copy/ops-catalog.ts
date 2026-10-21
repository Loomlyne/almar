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
    /** CANVAS (the Stays card's title). */
    tabStays: string;
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
    deleteNeedsMove: string;
    /** A published destination missing a fact Publish needs: Save waits. {list} = the kit's missing lines. */
    liveNeeds: string;
    /** Removing a published item's only destination is refused before any save. */
    lastDestination: string;
    /** The connect loop stopped partway: how many saved, which item did not, and why. */
    connectPartial: string;
    /** Accessible name of the table. */
    caption: string;
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
    /** The price sort's options (CMS-02). The accessible name is the chosen option. */
    sortPosition: string;
    sortLow: string;
    sortHigh: string;
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
    fieldName: string;
    fieldDescription: string;
    fieldPhoto: string;
    /** Not on the canvas (C-18). */
    fieldDuration: string;
    fieldType: string;
    fieldUnit: string;
    fieldPrice: string;
    priceHint: string;
    /** A published item missing a fact Publish needs: Save waits. {list} = the kit's missing lines. */
    liveNeeds: string;
    /** The "Publish needs" line for a price that is typed but not money (not an empty one). */
    validPrice: string;
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
      tabStays: "Stays",
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
      deleteNeedsMove: "Move its stays first",
      liveNeeds: "It is on the site, so it can only be saved with: {list}. To save without it, unpublish first.",
      lastDestination: "{name} is published and this is its only destination. Connect it to another destination first, or unpublish it.",
      connectPartial: "{saved} of {total} saved. {name} was not saved: {reason}",
      caption: "Destinations",
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
      sortPosition: "Sort: my order",
      sortLow: "Price: low to high",
      sortHigh: "Price: high to low",
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
      fieldName: "Name",
      fieldDescription: "Description",
      fieldPhoto: "Photo",
      fieldDuration: "Duration line",
      fieldType: "Type",
      fieldUnit: "Unit",
      fieldPrice: "Price in AED",
      priceHint: "Digits 0–9 only, up to two decimals, no currency sign or commas. Leave empty if not set.",
      liveNeeds: "It is on the site, so it can only be saved with: {list}. To save without it, unpublish first.",
      validPrice: "A valid price in AED",
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
      tabStays: "الإقامات",
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
      deleteNeedsMove: "انقل إقاماتها أولًا",
      liveNeeds: "إنها منشورة على الموقع، لذا لا تُحفظ إلا مع: {list}. لحفظها بدون ذلك، ألغِ نشرها أولًا.",
      lastDestination: "{name} منشور وهذه وجهته الوحيدة. اربطه بوجهة أخرى أولًا، أو ألغِ نشره.",
      connectPartial: "حُفظ {saved} من {total}. لم يُحفظ {name}: {reason}",
      caption: "الوجهات",
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
      sortPosition: "الترتيب: ترتيبي",
      sortLow: "السعر: من الأقل إلى الأعلى",
      sortHigh: "السعر: من الأعلى إلى الأقل",
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
      fieldName: "الاسم",
      fieldDescription: "الوصف",
      fieldPhoto: "الصورة",
      fieldDuration: "سطر المدة",
      fieldType: "النوع",
      fieldUnit: "الوحدة",
      fieldPrice: "السعر بالدرهم",
      priceHint: "أرقام من 0 إلى 9 فقط، بحد أقصى منزلتين عشريتين، بدون رمز العملة أو الفواصل. اتركه فارغًا إن لم يُحدَّد.",
      liveNeeds: "إنه منشور على الموقع، لذا لا يُحفظ إلا مع: {list}. لحفظه بدون ذلك، ألغِ نشره أولًا.",
      validPrice: "سعر صالح بالدرهم الإماراتي",
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
      tabStays: "Estancias",
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
      deleteNeedsMove: "Primero mueva sus estancias",
      liveNeeds: "Está en el sitio, así que solo puede guardarse con: {list}. Para guardarlo sin ello, despublíquelo primero.",
      lastDestination: "{name} está publicado y este es su único destino. Conéctelo antes a otro destino o despublíquelo.",
      connectPartial: "Se guardaron {saved} de {total}. {name} no se guardó: {reason}",
      caption: "Destinos",
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
      sortPosition: "Orden: el mío",
      sortLow: "Precio: de menor a mayor",
      sortHigh: "Precio: de mayor a menor",
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
      fieldName: "Nombre",
      fieldDescription: "Descripción",
      fieldPhoto: "Foto",
      fieldDuration: "Línea de duración",
      fieldType: "Tipo",
      fieldUnit: "Unidad",
      fieldPrice: "Precio en AED",
      priceHint: "Solo cifras del 0 al 9, con hasta dos decimales, sin símbolo de moneda ni comas. Déjelo vacío si no está definido.",
      liveNeeds: "Está en el sitio, así que solo puede guardarse con: {list}. Para guardarlo sin ello, despublíquelo primero.",
      validPrice: "Un precio válido en AED",
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
