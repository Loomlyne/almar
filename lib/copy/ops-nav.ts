// Dashboard copy for Content -> Navigation and footer (plan 06-02, CMS-09, F-15), EN / AR / ES. Signed by the owner with
// the 06-02 pictures (decisions/2026-10-27-06-02-06-03-pictures-signed.md): English ours, Arabic and Spanish his approved
// drafts, dashboard Spanish usted. The contact email and phone are never typed here (SITE-13): the screen shows
// SITE_CONTACT.

import type { NavTargetKey } from "../site-nav";

export type OpsNavLocale = "en" | "ar" | "es";

export type OpsNavCopy = {
  header: string;
  footer: string;
  addLink: string;
  label: string;
  linkTo: string;
  onSite: string;
  onSiteHint: string;
  web: string;
  webHint: string;
  page: string;
  webField: string;
  webBad: string;
  showOnSite: string;
  colLabel: string;
  colTo: string;
  colShown: string;
  edit: string;
  deleteLink: string;
  deleteTitle: string;
  deleteText: string;
  /** One label per lib/site-nav.ts NAV_TARGETS key. */
  targets: Record<NavTargetKey, string>;
  notYet: string;
  notYetLine: string;
  /** Login row: fixed, always last (SITE-01). */
  loginFixed: string;
  /** Currency and language rows. */
  toolsFixed: string;
  /** SITE-13: the values are SITE_CONTACT, never typed here. */
  contactFixed: string;
  email: string;
  phone: string;
  newLink: string;
  /** A package link: "{name}". */
  packageTarget: string;
};

export const OPS_NAV_COPY: Record<OpsNavLocale, OpsNavCopy> = {
  en: {
    header: "Header",
    footer: "Footer",
    addLink: "Add link",
    label: "Label",
    linkTo: "Link to",
    onSite: "A page on this site",
    onSiteHint: "Opens in the same tab.",
    web: "A web address",
    webHint: "Opens in a new tab on the site.",
    page: "Page",
    webField: "Web address (https)",
    webBad: "Use an address that starts with https://",
    showOnSite: "Show on site",
    colLabel: "Label",
    colTo: "Goes to",
    colShown: "On the site",
    edit: "Edit",
    deleteLink: "Delete link",
    deleteTitle: "Delete this link?",
    deleteText: "It is removed from the site after the update.",
    targets: {
      home: "Home",
      "private-stays": "Private stays",
      destinations: "Destinations",
      experiences: "Experiences",
      about: "About",
      contact: "Contact",
      blog: "Blog",
      "plan-with-us": "Plan with us",
      "list-with-us": "List with us",
      "legal-privacy": "Privacy policy",
      "legal-terms": "Terms and conditions",
      "legal-booking-terms": "Booking terms",
      "legal-waiver": "Liability waiver",
      "legal-disclaimer": "Disclaimer",
    },
    notYet: "(not on the site yet)",
    notYetLine:
      "This page is not on the site yet. The link appears once it is.",
    loginFixed: "Always last. It cannot be hidden or moved.",
    toolsFixed: "Fixed: currency and language are always in the header.",
    contactFixed: "Fixed contact details. They are not edited here.",
    email: "Email",
    phone: "Phone",
    newLink: "New link",
    packageTarget: "Package: {name}",
  },
  ar: {
    header: "الترويسة",
    footer: "التذييل",
    addLink: "إضافة رابط",
    label: "النص",
    linkTo: "يربط إلى",
    onSite: "صفحة في هذا الموقع",
    onSiteHint: "يفتح في التبويب نفسه.",
    web: "عنوان ويب",
    webHint: "يفتح في تبويب جديد على الموقع.",
    page: "الصفحة",
    webField: "عنوان الويب (https)",
    webBad: "استخدم عنوانًا يبدأ بـ https://",
    showOnSite: "إظهار على الموقع",
    colLabel: "النص",
    colTo: "يذهب إلى",
    colShown: "على الموقع",
    edit: "تعديل",
    deleteLink: "حذف الرابط",
    deleteTitle: "حذف هذا الرابط؟",
    deleteText: "يُزال من الموقع بعد التحديث.",
    targets: {
      home: "الرئيسية",
      "private-stays": "الإقامات الخاصة",
      destinations: "الوجهات",
      experiences: "التجارب",
      about: "عنّا",
      contact: "تواصل",
      blog: "المدونة",
      "plan-with-us": "خطّط معنا",
      "list-with-us": "أدرِج عقارك معنا",
      "legal-privacy": "سياسة الخصوصية",
      "legal-terms": "الشروط والأحكام",
      "legal-booking-terms": "شروط الحجز",
      "legal-waiver": "إقرار إخلاء المسؤولية",
      "legal-disclaimer": "إخلاء المسؤولية",
    },
    notYet: "(ليست على الموقع بعد)",
    notYetLine: "هذه الصفحة ليست على الموقع بعد. يظهر الرابط عندما تُنشر.",
    loginFixed: "دائمًا في الأخير. لا يمكن إخفاؤه أو تحريكه.",
    toolsFixed: "ثابت: العملة واللغة دائمًا في الترويسة.",
    contactFixed: "بيانات تواصل ثابتة. لا تُعدَّل هنا.",
    email: "البريد",
    phone: "الهاتف",
    newLink: "رابط جديد",
    packageTarget: "باقة: {name}",
  },
  es: {
    header: "Encabezado",
    footer: "Pie de página",
    addLink: "Añadir enlace",
    label: "Texto",
    linkTo: "Enlace a",
    onSite: "Una página de este sitio",
    onSiteHint: "Se abre en la misma pestaña.",
    web: "Una dirección web",
    webHint: "Se abre en una pestaña nueva en el sitio.",
    page: "Página",
    webField: "Dirección web (https)",
    webBad: "Use una dirección que empiece por https://",
    showOnSite: "Mostrar en el sitio",
    colLabel: "Texto",
    colTo: "Lleva a",
    colShown: "En el sitio",
    edit: "Editar",
    deleteLink: "Eliminar enlace",
    deleteTitle: "¿Eliminar este enlace?",
    deleteText: "Se quita del sitio después de la actualización.",
    targets: {
      home: "Inicio",
      "private-stays": "Estancias privadas",
      destinations: "Destinos",
      experiences: "Experiencias",
      about: "Nosotros",
      contact: "Contacto",
      blog: "Blog",
      "plan-with-us": "Planifique con nosotros",
      "list-with-us": "Publique su propiedad",
      "legal-privacy": "Política de privacidad",
      "legal-terms": "Términos y condiciones",
      "legal-booking-terms": "Condiciones de reserva",
      "legal-waiver": "Exención de responsabilidad",
      "legal-disclaimer": "Aviso legal",
    },
    notYet: "(aún no está en el sitio)",
    notYetLine:
      "Esta página aún no está en el sitio. El enlace aparece cuando lo esté.",
    loginFixed: "Siempre al final. No se puede ocultar ni mover.",
    toolsFixed: "Fijo: la moneda y el idioma siempre están en el encabezado.",
    contactFixed: "Datos de contacto fijos. No se editan aquí.",
    email: "Correo",
    phone: "Teléfono",
    newLink: "Nuevo enlace",
    packageTarget: "Paquete: {name}",
  },
};
