// Dashboard copy for Content -> Team and Catalog -> Packages, plans 03.2-08 and 06-06 (signed pictures/06-06), EN / AR / ES.
// CANVAS = verbatim from the design canvas board DashTeamLegal (its Arabic and Spanish too, except that dashboard
// Spanish is usted, owner 2026-10-14). Every other line is a draft for the owner's signature. No legal wording, no
// price, no person's name. The screens are on the kit editor page: English only, Arabic and Spanish are added on Save.

export type OpsTeamLocale = "en" | "ar" | "es";

export type OpsTeamCopy = {
  team: {
    /** CANVAS. */
    title: string;
    /** CANVAS. */
    newMember: string;
    /** CANVAS. */
    empty: string;
    /** CANVAS. Under the heading. */
    publicNote: string;
    /** The list's name for screen readers. */
    caption: string;
    /** CANVAS. */
    colName: string;
    /** CANVAS. */
    colRole: string;
    /** CANVAS. */
    colShown: string;
    /** CANVAS (usted in Spanish). Under the list when it holds more than one member. */
    orderNote: string;
    /** CANVAS. */
    fieldName: string;
    /** CANVAS. */
    fieldRole: string;
    fieldBio: string;
    /** CANVAS. */
    fieldPhoto: string;
    /** CANVAS. Card title and group name of the link rows. */
    links: string;
    /** CANVAS. */
    linksNote: string;
    linkPlatform: string;
    linkAddress: string;
    /** `{platform}`: the accessible name of a row's Remove button. */
    removeLink: string;
    /** CANVAS. */
    remove: string;
    /** CANVAS. */
    addLink: string;
    /** Beside Add a link once there are eight. */
    linksFull: string;
    linkNeedsHttps: string;
    linkTooLong: string;
    /** Card title of the email. */
    emailSection: string;
    /** CANVAS. */
    fieldEmail: string;
    emailNote: string;
    emailInvalid: string;
    fieldSlug: string;
    slugHint: string;
    slugLocked: string;
    problemSlug: string;
    problemSlugNeeded: string;
    /** CANVAS. */
    deleteMember: string;
    /** `{name}`. */
    deleteTitle: string;
    deleteText: string;
  };
  journeys: {
    /** The rail's name of the section (CANVAS rail). */
    title: string;
    intro: string;
    caption: string;
    colName: string;
    colPrice: string;
    colShown: string;
    empty: string;
    fieldName: string;
    fieldTagline: string;
    fieldDuration: string;
    fieldIdealForLabel: string;
    fieldIdealFor: string;
    fieldBody: string;
    fieldPhoto: string;
    fieldPrice: string;
    priceHint: string;
    /** `{currency}` `{amount}`: what the server read from the English price line. */
    readingFrom: string;
    /** `{currency}` `{low}` `{high}`. */
    readingRange: string;
    /** `{currency}` `{low}`: a range with no top. */
    readingOpen: string;
    readingNone: string;
    /** Under the reading: it is the saved line's. */
    readingSaved: string;
    /** Under the Delete of a shown package, which is off. */
    cannotDelete: string;
    newPackage: string;
    fieldSlug: string;
    slugHint: string;
    slugLocked: string;
    /** The card of the legs. */
    legs: string;
    addCity: string;
    /** Beside Add a city once there are six: a request form takes at most six cities. */
    legsFull: string;
    destination: string;
    stay: string;
    noStay: string;
    nights: string;
    removeCity: string;
    /** `{n}`: the heading of a leg. */
    city: string;
    /** The card of the included add-ons. */
    addons: string;
    addonsSearch: string;
    addonsHint: string;
    deletePkg: string;
    /** `{name}`. */
    deleteTitle: string;
    deleteText: string;
    /** The page title while the English name is empty. */
    untitled: string;
    /** `{languages}`: after a save, a stored translation whose price line was empty kept its saved line. */
    priceKept: string;
    /** `{languages}`: after a save, a new translation with no price line was not saved (the line is required). */
    priceHeld: string;
  };
};

export const LINK_PLATFORM_NAMES = ["Instagram", "LinkedIn", "Facebook", "X"] as const;

export const OPS_TEAM_COPY: Record<OpsTeamLocale, OpsTeamCopy> = {
  en: {
    team: {
      title: "Team",
      newMember: "New member",
      empty: "No team members yet",
      publicNote: "Only members published here appear on the public site.",
      caption: "Team members",
      colName: "Name",
      colRole: "Role",
      colShown: "Shown",
      orderNote: "Drag members in the list to change their order on the site.",
      fieldName: "Name",
      fieldRole: "Role",
      fieldBio: "Bio",
      fieldPhoto: "Photo",
      links: "Social media",
      linksNote: "Shown as icons on the member's card on the public Team section.",
      linkPlatform: "Platform",
      linkAddress: "Link address",
      removeLink: "Remove the {platform} link",
      remove: "Remove",
      addLink: "Add a link",
      linksFull: "Up to eight links.",
      linkNeedsHttps: "Use an address that starts with https://",
      linkTooLong: "Use an address of 300 characters or fewer.",
      emailSection: "Email",
      fieldEmail: "Email (optional)",
      emailNote: "Not shown on the public site.",
      emailInvalid: "Use an email address such as name@example.com.",
      fieldSlug: "Web address",
      slugHint: "Lowercase letters, numbers and dashes. It cannot change once the member is published.",
      slugLocked: "The web address cannot change after publishing.",
      problemSlug: "{field}: lowercase letters, numbers and single dashes.",
      problemSlugNeeded: "Enter a web address.",
      deleteMember: "Delete member",
      deleteTitle: "Delete {name}?",
      deleteText: "The member and their links are deleted. The photo stays in Media.",
    },
    journeys: {
      title: "Packages",
      intro: "These are your journeys. Each has a page on the site where guests can request it.",
      caption: "Home journeys",
      colName: "Name",
      colPrice: "Price line",
      colShown: "Shown",
      empty: "No journeys found.",
      fieldName: "Name",
      fieldTagline: "Tagline",
      fieldDuration: "Duration line",
      fieldIdealForLabel: "Ideal-for label",
      fieldIdealFor: "Ideal for",
      fieldBody: "Description",
      fieldPhoto: "Photo",
      fieldPrice: "Price line",
      priceHint: "Shown on the home page and the package page exactly as you write it.",
      readingFrom: "How the site reads it: from {currency} {amount}",
      readingRange: "How the site reads it: {currency} {low} to {high}",
      readingOpen: "How the site reads it: from {currency} {low}",
      readingNone: "The site cannot read a price from this line; it shows the line as typed.",
      readingSaved: "Read from the price line as last saved.",
      cannotDelete: "A shown package cannot be deleted. Hide it first.",
      newPackage: "New package",
      fieldSlug: "Web address",
      slugHint: "Lowercase letters, numbers and dashes. It cannot change once the package is published.",
      slugLocked: "The web address cannot change after publishing.",
      legs: "Cities on this journey",
      addCity: "Add a city",
      legsFull: "Up to six cities.",
      destination: "Destination",
      stay: "Suggested stay",
      noStay: "No suggested stay",
      nights: "Nights",
      removeCity: "Remove city",
      city: "City {n}",
      addons: "Included in this package",
      addonsSearch: "Search the catalog",
      addonsHint: "Shown as included. Guests cannot remove them.",
      deletePkg: "Delete package",
      deleteTitle: "Delete {name}?",
      deleteText: "The package and its cities are deleted. The photo stays in Media.",
      untitled: "Journey",
      priceKept: "{languages}: the price line was empty, so the saved one is kept.",
      priceHeld: "{languages}: not saved, because a new translation needs a price line. Add it under Edit translations, then save again.",
    },
  },
  ar: {
    team: {
      title: "الفريق",
      newMember: "عضو جديد",
      empty: "لا أعضاء في الفريق بعد",
      publicNote: "يظهر في الموقع العام فقط الأعضاء المنشورون هنا.",
      caption: "أعضاء الفريق",
      colName: "الاسم",
      colRole: "المنصب",
      colShown: "الظهور",
      orderNote: "اسحب الأعضاء في القائمة لتغيير ترتيبهم في الموقع.",
      fieldName: "الاسم",
      fieldRole: "المنصب",
      fieldBio: "نبذة",
      fieldPhoto: "الصورة",
      links: "وسائل التواصل الاجتماعي",
      linksNote: "تظهر كأيقونات على بطاقة العضو في قسم الفريق العام.",
      linkPlatform: "المنصة",
      linkAddress: "عنوان الرابط",
      removeLink: "إزالة رابط {platform}",
      remove: "إزالة",
      addLink: "إضافة رابط",
      linksFull: "ثمانية روابط كحدّ أقصى.",
      linkNeedsHttps: "استخدم عنوانًا يبدأ بـ https://",
      linkTooLong: "استخدم عنوانًا من 300 حرف أو أقل.",
      emailSection: "البريد الإلكتروني",
      fieldEmail: "البريد الإلكتروني (اختياري)",
      emailNote: "لا يظهر في الموقع العام.",
      emailInvalid: "استخدم عنوان بريد مثل name@example.com.",
      fieldSlug: "عنوان الويب",
      slugHint: "أحرف لاتينية صغيرة وأرقام وشرطات. لا يمكن تغييره بعد نشر العضو.",
      slugLocked: "لا يمكن تغيير عنوان الويب بعد النشر.",
      problemSlug: "{field}: أحرف لاتينية صغيرة وأرقام وشرطة واحدة بين الكلمات.",
      problemSlugNeeded: "أدخل عنوان الويب.",
      deleteMember: "حذف العضو",
      deleteTitle: "حذف {name}؟",
      deleteText: "يُحذف العضو وروابطه. تبقى الصورة في الوسائط.",
    },
    journeys: {
      title: "الباقات",
      intro: "هذه هي رحلاتك. لكل رحلة صفحة في الموقع يستطيع الضيوف طلبها منها.",
      caption: "رحلات الصفحة الرئيسية",
      colName: "الاسم",
      colPrice: "سطر السعر",
      colShown: "الظهور",
      empty: "لم يُعثر على رحلات.",
      fieldName: "الاسم",
      fieldTagline: "الشعار",
      fieldDuration: "سطر المدة",
      fieldIdealForLabel: "تسمية «مثالي لـ»",
      fieldIdealFor: "مثالي لـ",
      fieldBody: "الوصف",
      fieldPhoto: "الصورة",
      fieldPrice: "سطر السعر",
      priceHint: "يظهر في الصفحة الرئيسية وصفحة الباقة كما تكتبه تمامًا.",
      readingFrom: "كيف يقرؤه الموقع: ابتداءً من {currency} {amount}",
      readingRange: "كيف يقرؤه الموقع: {currency} {low} إلى {high}",
      readingOpen: "كيف يقرؤه الموقع: ابتداءً من {currency} {low}",
      readingNone: "لا يستطيع الموقع قراءة سعر من هذا السطر؛ يعرضه كما كُتب.",
      readingSaved: "مقروء من سطر السعر كما حُفظ آخر مرة.",
      cannotDelete: "لا يمكن حذف باقة ظاهرة. أخفِها أولًا.",
      newPackage: "باقة جديدة",
      fieldSlug: "عنوان الويب",
      slugHint: "أحرف لاتينية صغيرة وأرقام وشرطات. لا يمكن تغييره بعد نشر الباقة.",
      slugLocked: "لا يمكن تغيير عنوان الويب بعد النشر.",
      legs: "المدن في هذه الرحلة",
      addCity: "إضافة مدينة",
      legsFull: "ست مدن كحدّ أقصى.",
      destination: "الوجهة",
      stay: "الإقامة المقترحة",
      noStay: "بلا إقامة مقترحة",
      nights: "عدد الليالي",
      removeCity: "إزالة المدينة",
      city: "المدينة {n}",
      addons: "المشمول في هذه الباقة",
      addonsSearch: "ابحث في الكتالوج",
      addonsHint: "تظهر كمشمولة. لا يستطيع الضيوف إزالتها.",
      deletePkg: "حذف الباقة",
      deleteTitle: "حذف {name}؟",
      deleteText: "تُحذف الباقة ومدنها. تبقى الصورة في الوسائط.",
      untitled: "رحلة",
      priceKept: "{languages}: كان سطر السعر فارغًا، لذلك يبقى السطر المحفوظ.",
      priceHeld: "{languages}: لم يُحفظ، لأن الترجمة الجديدة تحتاج إلى سطر سعر. أضفه في تعديل الترجمات، ثم احفظ مرة أخرى.",
    },
  },
  es: {
    team: {
      title: "Equipo",
      newMember: "Nuevo miembro",
      empty: "Aún no hay miembros",
      publicNote: "Solo los miembros publicados aquí aparecen en el sitio público.",
      caption: "Miembros del equipo",
      colName: "Nombre",
      colRole: "Cargo",
      colShown: "Visible",
      orderNote: "Arrastre los miembros de la lista para cambiar su orden en el sitio.",
      fieldName: "Nombre",
      fieldRole: "Cargo",
      fieldBio: "Biografía",
      fieldPhoto: "Foto",
      links: "Redes sociales",
      linksNote: "Se muestran como iconos en la tarjeta del miembro en la sección Equipo pública.",
      linkPlatform: "Plataforma",
      linkAddress: "Dirección del enlace",
      removeLink: "Quitar el enlace de {platform}",
      remove: "Quitar",
      addLink: "Añadir enlace",
      linksFull: "Hasta ocho enlaces.",
      linkNeedsHttps: "Use una dirección que empiece por https://",
      linkTooLong: "Use una dirección de 300 caracteres o menos.",
      emailSection: "Correo",
      fieldEmail: "Correo (opcional)",
      emailNote: "No se muestra en el sitio público.",
      emailInvalid: "Use una dirección de correo como name@example.com.",
      fieldSlug: "Dirección web",
      slugHint: "Minúsculas, números y guiones. No se puede cambiar una vez publicado el miembro.",
      slugLocked: "La dirección web no se puede cambiar después de publicar.",
      problemSlug: "{field}: minúsculas, números y un solo guion entre palabras.",
      problemSlugNeeded: "Indique una dirección web.",
      deleteMember: "Eliminar miembro",
      deleteTitle: "¿Eliminar a {name}?",
      deleteText: "Se eliminan el miembro y sus enlaces. La foto queda en Medios.",
    },
    journeys: {
      title: "Paquetes",
      intro: "Estos son sus viajes. Cada uno tiene una página en el sitio donde los huéspedes pueden solicitarlo.",
      caption: "Viajes de la página de inicio",
      colName: "Nombre",
      colPrice: "Línea de precio",
      colShown: "Visible",
      empty: "No se encontraron viajes.",
      fieldName: "Nombre",
      fieldTagline: "Lema",
      fieldDuration: "Línea de duración",
      fieldIdealForLabel: "Etiqueta «Ideal para»",
      fieldIdealFor: "Ideal para",
      fieldBody: "Descripción",
      fieldPhoto: "Foto",
      fieldPrice: "Línea de precio",
      priceHint: "Se muestra en la página de inicio y en la página del paquete tal como usted la escribe.",
      readingFrom: "Cómo la lee el sitio: desde {currency} {amount}",
      readingRange: "Cómo la lee el sitio: {currency} {low} a {high}",
      readingOpen: "Cómo la lee el sitio: desde {currency} {low}",
      readingNone: "El sitio no puede leer un precio en esta línea; la muestra tal como se escribió.",
      readingSaved: "Leído de la línea de precio guardada por última vez.",
      cannotDelete: "No se puede eliminar un paquete visible. Primero ocúltelo.",
      newPackage: "Nuevo paquete",
      fieldSlug: "Dirección web",
      slugHint: "Minúsculas, números y guiones. No se puede cambiar una vez publicado el paquete.",
      slugLocked: "La dirección web no se puede cambiar después de publicar.",
      legs: "Ciudades de este viaje",
      addCity: "Añadir una ciudad",
      legsFull: "Hasta seis ciudades.",
      destination: "Destino",
      stay: "Estancia sugerida",
      noStay: "Sin estancia sugerida",
      nights: "Noches",
      removeCity: "Quitar la ciudad",
      city: "Ciudad {n}",
      addons: "Incluido en este paquete",
      addonsSearch: "Buscar en el catálogo",
      addonsHint: "Se muestra como incluido. Los huéspedes no pueden quitarlo.",
      deletePkg: "Eliminar paquete",
      deleteTitle: "¿Eliminar {name}?",
      deleteText: "Se eliminan el paquete y sus ciudades. La foto permanece en Medios.",
      untitled: "Viaje",
      priceKept: "{languages}: la línea de precio estaba vacía, así que se mantiene la guardada.",
      priceHeld: "{languages}: no se guardó, porque una traducción nueva necesita una línea de precio. Agréguela en Editar traducciones y vuelva a guardar.",
    },
  },
};

/** Fills `{token}` placeholders. A token with no value is left as written. */
export function fillTeamCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}
