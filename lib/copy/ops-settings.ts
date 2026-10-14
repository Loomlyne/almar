// Plan 02-06: the Settings screen's own copy (self-contained: lib/copy/dashboard.ts stays 03.2-05's slot).
// Lines from the 02-UI-SPEC string table are unchanged (Spanish "Use dos decimales." in usted, owner 2026-10-13);
// every other line is a DRAFT signed with the pictures on 2026-10-13 and correctable at UAT.

export type OpsSettingsLocale = "en" | "ar" | "es";

export type OpsSettingsCopy = {
  brandColors: string;
  colors: { teal: string; charcoal: string; gold: string; ivory: string; white: string };
  goldHint: string;
  type: string;
  titleFace: string;
  bodyFace: string;
  arabicFaces: string;
  money: string;
  vat: string;
  deposit: string;
  fx: string;
  fxHint: string;
  fxNone: string;
  maintenance: string;
  maintenanceOn: string;
  maintenanceHint: string;
  logo: string;
  upload: string;
  logoHint: string;
  removeLogo: string;
  logoRefused: string;
  langCurrency: string;
  language: string;
  currency: string;
  saved: string;
  contrast: string;
  twoDecimals: string;
  percentRange: string;
  saveFailed: string;
  loadFailed: string;
  leaveTitle: string;
  leave: string;
  stay: string;
};

export const OPS_SETTINGS_COPY: Record<OpsSettingsLocale, OpsSettingsCopy> = {
  en: {
    brandColors: "Brand colors",
    colors: { teal: "Teal", charcoal: "Charcoal", gold: "Gold", ivory: "Ivory", white: "White" },
    goldHint: "Gold is used for lines only.",
    type: "Type",
    titleFace: "Title face",
    bodyFace: "Body face",
    arabicFaces: "Arabic keeps Noto Naskh Arabic and Noto Sans Arabic.",
    money: "VAT and deposit",
    vat: "VAT percent",
    deposit: "Deposit percent",
    fx: "FX rate",
    fxHint: "Updated daily. Not editable.",
    fxNone: "Not available right now.",
    maintenance: "Maintenance",
    maintenanceOn: "Maintenance is on",
    maintenanceHint: "When saved, the public site shows the closed page. This dashboard stays open.",
    logo: "Logo",
    upload: "Upload",
    logoHint: "PNG, JPEG or WebP, square, up to 1 MB",
    removeLogo: "Remove logo",
    logoRefused: "Use a PNG, JPEG or WebP file up to 1 MB.",
    langCurrency: "Your language and currency",
    language: "Language",
    currency: "Currency",
    saved: "Settings saved.",
    contrast: "The contrast is too low.",
    twoDecimals: "Use two decimal places.",
    percentRange: "Use a number from 0 to 100.",
    saveFailed: "Settings were not saved. Try again.",
    loadFailed: "Settings could not be loaded. Reload the page.",
    leaveTitle: "You have unsaved changes.",
    leave: "Leave settings",
    stay: "Stay on settings",
  },
  ar: {
    brandColors: "ألوان العلامة",
    colors: { teal: "أخضر مزرق", charcoal: "فحمي", gold: "ذهبي", ivory: "عاجي", white: "أبيض" },
    goldHint: "يُستخدم الذهبي للخطوط فقط.",
    type: "الخطوط",
    titleFace: "خط العناوين",
    bodyFace: "خط النص",
    arabicFaces: "تبقى العربية بخطَّي Noto Naskh Arabic وNoto Sans Arabic.",
    money: "الضريبة والعربون",
    vat: "نسبة ضريبة القيمة المضافة",
    deposit: "نسبة العربون",
    fx: "سعر الصرف",
    fxHint: "يُحدَّث يومياً. غير قابل للتعديل.",
    fxNone: "غير متاح حالياً.",
    maintenance: "الصيانة",
    maintenanceOn: "وضع الصيانة مفعّل",
    maintenanceHint: "بعد الحفظ، يعرض الموقع العام صفحة الإغلاق. وتبقى لوحة التحكم هذه مفتوحة.",
    logo: "الشعار",
    upload: "رفع",
    logoHint: "PNG أو JPEG أو WebP، مربع، حتى 1 ميغابايت",
    removeLogo: "إزالة الشعار",
    logoRefused: "استخدم ملف PNG أو JPEG أو WebP بحجم لا يتجاوز 1 ميغابايت.",
    langCurrency: "لغتك وعملتك",
    language: "اللغة",
    currency: "العملة",
    saved: "تم حفظ الإعدادات.",
    contrast: "التباين منخفض جداً.",
    twoDecimals: "استخدم منزلتين عشريتين.",
    percentRange: "استخدم رقماً من 0 إلى 100.",
    saveFailed: "لم تُحفظ الإعدادات. حاول مرة أخرى.",
    loadFailed: "تعذر تحميل الإعدادات. أعد تحميل الصفحة.",
    leaveTitle: "لديك تغييرات غير محفوظة.",
    leave: "مغادرة الإعدادات",
    stay: "البقاء في الإعدادات",
  },
  es: {
    brandColors: "Colores de marca",
    colors: { teal: "Verde azulado", charcoal: "Carbón", gold: "Dorado", ivory: "Marfil", white: "Blanco" },
    goldHint: "El dorado se usa solo en líneas.",
    type: "Tipografía",
    titleFace: "Fuente de títulos",
    bodyFace: "Fuente de texto",
    arabicFaces: "El árabe conserva Noto Naskh Arabic y Noto Sans Arabic.",
    money: "IVA y depósito",
    vat: "Porcentaje de IVA",
    deposit: "Porcentaje de depósito",
    fx: "Tipo de cambio",
    fxHint: "Se actualiza a diario. No se puede editar.",
    fxNone: "No disponible en este momento.",
    maintenance: "Mantenimiento",
    maintenanceOn: "El mantenimiento está activado",
    maintenanceHint: "Al guardar, el sitio público muestra la página de cierre. Este panel sigue abierto.",
    logo: "Logotipo",
    upload: "Subir",
    logoHint: "PNG, JPEG o WebP, cuadrado, hasta 1 MB",
    removeLogo: "Quitar el logotipo",
    logoRefused: "Use un archivo PNG, JPEG o WebP de hasta 1 MB.",
    langCurrency: "Su idioma y moneda",
    language: "Idioma",
    currency: "Moneda",
    saved: "Ajustes guardados.",
    contrast: "El contraste es demasiado bajo.",
    twoDecimals: "Use dos decimales.",
    percentRange: "Use un número del 0 al 100.",
    saveFailed: "Los ajustes no se guardaron. Inténtelo de nuevo.",
    loadFailed: "No se pudieron cargar los ajustes. Vuelva a cargar la página.",
    leaveTitle: "Tiene cambios sin guardar.",
    leave: "Salir de ajustes",
    stay: "Seguir en ajustes",
  },
};
