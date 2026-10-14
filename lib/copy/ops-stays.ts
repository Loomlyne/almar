// Copy for Catalog -> Stays (app/dashboard/(ops)/catalog/stays), phase 3.2 plan 07. New file; no other copy file is edited.
//
// CANVAS strings are taken verbatim from the design canvas board DashStays in all three languages. Every other EN string
// is DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES (Latin
// American, formal "usted", owner 2026-10-14) are DRAFTS written from the EN. The words "Published", "Draft", "Move up",
// "Move down" and the empty-state line "No stays yet" / "New stay" come from OPS_KIT_COPY and DASHBOARD_COPY, not from here.
//
// The list strings, and the stay editor's strings (kit panel B, owner 2026-10-14: English fields only, the kit adds
// Arabic and Spanish on Save). Save, Publish, Unpublish, the back link and the missing lines are the kit's words
// (OPS_KIT_COPY). Imported directly; deliberately not registered in lib/copy/index.ts.

export type OpsStaysLocale = "en" | "ar" | "es";

export type OpsStaysCopy = {
  /** CANVAS: the search field. */
  search: string;
  /** CANVAS: the destination filter's first option. */
  allDestinations: string;
  /** CANVAS: column headers. */
  columnName: string;
  columnDestination: string;
  columnConnected: string;
  columnStatus: string;
  /** DRAFT: accessible name of the destination filter, `{name}` is the chosen option. */
  filterLabel: string;
  /** DRAFT: the line when a search or filter leaves no stay. */
  noMatch: string;
  /** DRAFT: shown while a search or filter is on, because the order cannot be changed on a part of the list. */
  orderLocked: string;

  // ---- the stay editor ----
  /** DRAFT: card titles. `connections` and `capacity` are CANVAS. */
  sectionText: string;
  sectionPhotos: string;
  sectionPlace: string;
  sectionCapacity: string;
  sectionRules: string;
  /** CANVAS: the connections hint, search, kinds and the destination's read-only group. */
  connectionsHint: string;
  /** DRAFT: the picker's own heading inside the card. */
  pickerTitle: string;
  searchConnections: string;
  kindExperience: string;
  kindService: string;
  fromDestination: string;
  /** CANVAS. */
  deleteStay: string;
  /** DRAFT: the facts. */
  destination: string;
  chooseDestination: string;
  slug: string;
  slugHint: string;
  maxGuests: string;
  minGuests: string;
  bedrooms: string;
  bathrooms: string;
  minNights: string;
  minNightsHint: string;
  pets: string;
  petsNotSet: string;
  petsAllowed: string;
  petsNotAllowed: string;
  petsFee: string;
  petFee: string;
  infants: string;
  infantsNotSet: string;
  yes: string;
  no: string;
  /** DRAFT: the texts. `description` is CANVAS. */
  title: string;
  tagline: string;
  neighborhood: string;
  guestsLine: string;
  bathroomsLine: string;
  bedsLine: string;
  priceLine: string;
  priceNote: string;
  description: string;
  amenities: string;
  inclusions: string;
  policyHeadings: string;
  paragraphsHint: string;
  linesHint: string;
  /** DRAFT: the photos. */
  hero: string;
  gallery: string;
  /** DRAFT: what keeps Save off, said under the bar. */
  problemWhole: string;
  problemAtLeastOne: string;
  problemGuestsOrder: string;
  problemFee: string;
  problemFeeNeeded: string;
  problemSlug: string;
  problemSlugNeeded: string;
  problemDestinationNeeded: string;
  /** DRAFT: `{en}`, `{ar}`, `{es}` are line counts. */
  amenitiesMismatch: string;
};

export const OPS_STAYS_COPY: Record<OpsStaysLocale, OpsStaysCopy> = {
  en: {
    search: "Search",
    allDestinations: "All destinations",
    columnName: "Name",
    columnDestination: "Destinations",
    columnConnected: "Experiences and services",
    columnStatus: "Status",
    filterLabel: "Filter by destination: {name}",
    noMatch: "No stay matches your search.",
    orderLocked: "Clear the search and the filter to change the order.",
    sectionText: "Text",
    sectionPhotos: "Photos",
    sectionPlace: "Place",
    sectionCapacity: "Capacity",
    sectionRules: "Stay rules",
    connectionsHint: "Guests can add these to a booking of this stay. Items connected to the destination appear too.",
    pickerTitle: "Add experiences and services",
    searchConnections: "Search experiences and services",
    kindExperience: "Experience",
    kindService: "Service",
    fromDestination: "From the destination",
    deleteStay: "Delete stay",
    destination: "Destination",
    chooseDestination: "Choose a destination",
    slug: "Web address",
    slugHint: "Lowercase letters, numbers and dashes. It cannot change once the stay is published.",
    maxGuests: "Max guests",
    minGuests: "Min guests",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    minNights: "Minimum nights",
    minNightsHint: "There is no maximum.",
    pets: "Pets",
    petsNotSet: "Not set",
    petsAllowed: "Allowed",
    petsNotAllowed: "Not allowed",
    petsFee: "Allowed with a fee",
    petFee: "Pet fee (AED)",
    infants: "Infants count toward guests",
    infantsNotSet: "Not set",
    yes: "Yes",
    no: "No",
    title: "Title",
    tagline: "Tagline",
    neighborhood: "Neighbourhood",
    guestsLine: "Guests line",
    bathroomsLine: "Bathrooms line",
    bedsLine: "Beds line",
    priceLine: "Price line",
    priceNote: "Price note",
    description: "Description",
    amenities: "Amenities",
    inclusions: "Inclusions",
    policyHeadings: "Policy headings",
    paragraphsHint: "One paragraph per line.",
    linesHint: "One per line.",
    hero: "Hero photo",
    gallery: "Gallery",
    problemWhole: "{field}: a whole number, 0 or more.",
    problemAtLeastOne: "{field}: a whole number, 1 or more.",
    problemGuestsOrder: "Max guests cannot be below min guests.",
    problemFee: "{field}: an amount in AED with up to two decimals.",
    problemFeeNeeded: "Enter the pet fee, or choose another pets rule.",
    problemSlug: "{field}: lowercase letters, numbers and single dashes.",
    problemSlugNeeded: "Enter a web address.",
    problemDestinationNeeded: "Choose a destination.",
    amenitiesMismatch: "Amenities need the same number of lines in every language: {en} in English, {ar} in Arabic, {es} in Spanish.",
  },
  ar: {
    search: "بحث",
    allDestinations: "كل الوجهات",
    columnName: "الاسم",
    columnDestination: "الوجهات",
    columnConnected: "التجارب والخدمات",
    columnStatus: "الحالة",
    filterLabel: "التصفية حسب الوجهة: {name}",
    noMatch: "لا توجد إقامة تطابق بحثك.",
    orderLocked: "امسح البحث والتصفية لتغيير الترتيب.",
    sectionText: "النص",
    sectionPhotos: "الصور",
    sectionPlace: "المكان",
    sectionCapacity: "السعة",
    sectionRules: "قواعد الإقامة",
    connectionsHint: "يمكن للضيوف إضافتها إلى حجز هذه الإقامة. تظهر أيضًا البنود المرتبطة بالوجهة.",
    pickerTitle: "إضافة تجارب وخدمات",
    searchConnections: "ابحث في التجارب والخدمات",
    kindExperience: "تجربة",
    kindService: "خدمة",
    fromDestination: "من الوجهة",
    deleteStay: "حذف الإقامة",
    destination: "الوجهة",
    chooseDestination: "اختر وجهة",
    slug: "عنوان الصفحة",
    slugHint: "أحرف لاتينية صغيرة وأرقام وشرطات. لا يمكن تغييره بعد نشر الإقامة.",
    maxGuests: "أقصى عدد للضيوف",
    minGuests: "أدنى عدد للضيوف",
    bedrooms: "غرف النوم",
    bathrooms: "الحمّامات",
    minNights: "الحد الأدنى من الليالي",
    minNightsHint: "لا يوجد حد أقصى.",
    pets: "الحيوانات الأليفة",
    petsNotSet: "غير محدد",
    petsAllowed: "مسموح",
    petsNotAllowed: "غير مسموح",
    petsFee: "مسموح مقابل رسوم",
    petFee: "رسوم الحيوانات الأليفة (درهم)",
    infants: "يُحتسب الرضّع ضمن الضيوف",
    infantsNotSet: "غير محدد",
    yes: "نعم",
    no: "لا",
    title: "العنوان",
    tagline: "العبارة التعريفية",
    neighborhood: "الحي",
    guestsLine: "سطر الضيوف",
    bathroomsLine: "سطر الحمّامات",
    bedsLine: "سطر الأسرّة",
    priceLine: "سطر السعر",
    priceNote: "ملاحظة السعر",
    description: "الوصف",
    amenities: "وسائل الراحة",
    inclusions: "ما يشمله",
    policyHeadings: "عناوين السياسات",
    paragraphsHint: "فقرة واحدة في كل سطر.",
    linesHint: "عنصر واحد في كل سطر.",
    hero: "الصورة الرئيسية",
    gallery: "المعرض",
    problemWhole: "{field}: عدد صحيح، صفر أو أكثر.",
    problemAtLeastOne: "{field}: عدد صحيح، 1 أو أكثر.",
    problemGuestsOrder: "لا يمكن أن يقل أقصى عدد للضيوف عن أدنى عدد.",
    problemFee: "{field}: مبلغ بالدرهم بمنزلتين عشريتين على الأكثر.",
    problemFeeNeeded: "أدخل رسوم الحيوانات الأليفة، أو اختر قاعدة أخرى.",
    problemSlug: "{field}: أحرف لاتينية صغيرة وأرقام وشرطة واحدة بين الكلمات.",
    problemSlugNeeded: "أدخل عنوان الصفحة.",
    problemDestinationNeeded: "اختر وجهة.",
    amenitiesMismatch: "تحتاج وسائل الراحة إلى العدد نفسه من الأسطر في كل لغة: {en} بالإنجليزية، {ar} بالعربية، {es} بالإسبانية.",
  },
  es: {
    search: "Buscar",
    allDestinations: "Todos los destinos",
    columnName: "Nombre",
    columnDestination: "Destinos",
    columnConnected: "Experiencias y servicios",
    columnStatus: "Estado",
    filterLabel: "Filtrar por destino: {name}",
    noMatch: "Ninguna estancia coincide con su búsqueda.",
    orderLocked: "Borre la búsqueda y el filtro para cambiar el orden.",
    sectionText: "Texto",
    sectionPhotos: "Fotos",
    sectionPlace: "Ubicación",
    sectionCapacity: "Capacidad",
    sectionRules: "Reglas de la estancia",
    connectionsHint: "Los huéspedes pueden añadirlos a una reserva de esta estancia. También aparecen los del destino.",
    pickerTitle: "Añadir experiencias y servicios",
    searchConnections: "Buscar experiencias y servicios",
    kindExperience: "Experiencia",
    kindService: "Servicio",
    fromDestination: "Del destino",
    deleteStay: "Eliminar estancia",
    destination: "Destino",
    chooseDestination: "Elija un destino",
    slug: "Dirección web",
    slugHint: "Minúsculas, números y guiones. No se puede cambiar una vez publicada la estancia.",
    maxGuests: "Máximo de huéspedes",
    minGuests: "Mínimo de huéspedes",
    bedrooms: "Dormitorios",
    bathrooms: "Baños",
    minNights: "Noches mínimas",
    minNightsHint: "No hay máximo.",
    pets: "Mascotas",
    petsNotSet: "Sin definir",
    petsAllowed: "Permitidas",
    petsNotAllowed: "No permitidas",
    petsFee: "Permitidas con cargo",
    petFee: "Cargo por mascota (AED)",
    infants: "Los bebés cuentan como huéspedes",
    infantsNotSet: "Sin definir",
    yes: "Sí",
    no: "No",
    title: "Título",
    tagline: "Frase breve",
    neighborhood: "Barrio",
    guestsLine: "Línea de huéspedes",
    bathroomsLine: "Línea de baños",
    bedsLine: "Línea de camas",
    priceLine: "Línea de precio",
    priceNote: "Nota de precio",
    description: "Descripción",
    amenities: "Comodidades",
    inclusions: "Incluye",
    policyHeadings: "Títulos de las políticas",
    paragraphsHint: "Un párrafo por línea.",
    linesHint: "Uno por línea.",
    hero: "Foto principal",
    gallery: "Galería",
    problemWhole: "{field}: un número entero, 0 o más.",
    problemAtLeastOne: "{field}: un número entero, 1 o más.",
    problemGuestsOrder: "El máximo de huéspedes no puede ser menor que el mínimo.",
    problemFee: "{field}: un importe en AED con hasta dos decimales.",
    problemFeeNeeded: "Indique el cargo por mascota o elija otra regla.",
    problemSlug: "{field}: minúsculas, números y un solo guion entre palabras.",
    problemSlugNeeded: "Indique una dirección web.",
    problemDestinationNeeded: "Elija un destino.",
    amenitiesMismatch: "Las comodidades necesitan el mismo número de líneas en cada idioma: {en} en inglés, {ar} en árabe, {es} en español.",
  },
};
