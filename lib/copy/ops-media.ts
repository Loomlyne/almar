// Copy for the dashboard photo field, the picker and the Content -> Media screen (components/ops/media-*.tsx,
// app/dashboard/(ops)/content/media), phase 3.2 plan 09. New file; no other copy file is edited.
//
// CANVAS strings are taken verbatim from the design canvas board DashMediaNav in all three languages. Every other EN
// string is DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES
// (Latin American, formal "usted", owner 2026-10-11) are DRAFTS written from the EN, flagged for the owner's review.
// `{n}` is filled with fillCopy (lib/copy/ops-kit.ts). Imported directly; deliberately not registered in lib/copy/index.ts.

export type OpsMediaLocale = "en" | "ar" | "es";

export type OpsMediaCopy = {
  /** CANVAS: page title and rail name. */
  media: string;
  /** CANVAS */
  upload: string;
  /** CANVAS */
  search: string;
  /** CANVAS */
  altText: string;
  /** CANVAS: the line under a library card, "Alt text: EN AR ES". */
  altRow: string;
  /** CANVAS */
  deleteImage: string;
  /** CANVAS */
  close: string;
  /** CANVAS */
  save: string;
  choosePhoto: string;
  changePhoto: string;
  removePhoto: string;
  addPhotos: string;
  choose: string;
  uploadPhoto: string;
  altEnRequired: string;
  uploadHint: string;
  uploading: string;
  uploaded: string;
  tooLarge: string;
  wrongType: string;
  incomplete: string;
  /** Replaces the canvas "Used in: [00] pages, [00] stays": the contract returns one count. */
  usedIn: string;
  usedInOne: string;
  usedBlocksDelete: string;
  staysInStorage: string;
  checkedTranslation: string;
  noMatch: string;
  loadMore: string;
};

export const OPS_MEDIA_COPY: Record<OpsMediaLocale, OpsMediaCopy> = {
  en: {
    media: "Media",
    upload: "Upload",
    search: "Search",
    altText: "Alt text",
    altRow: "Alt text: EN AR ES",
    deleteImage: "Delete image",
    close: "Close",
    save: "Save",
    choosePhoto: "Choose photo",
    changePhoto: "Change photo",
    removePhoto: "Remove photo",
    addPhotos: "Add photos",
    choose: "Choose",
    uploadPhoto: "Upload a photo",
    altEnRequired: "English alt text (required)",
    uploadHint: "JPEG, PNG or WebP, up to 15 MB",
    uploading: "Uploading…",
    uploaded: "Uploaded",
    tooLarge: "This file is larger than 15 MB.",
    wrongType: "Use a JPEG, PNG or WebP photo.",
    incomplete: "The upload did not arrive complete. Try again.",
    usedIn: "Used in {n} places",
    usedInOne: "Used in 1 place",
    usedBlocksDelete: "This photo is used, so it cannot be deleted.",
    staysInStorage: "The file stays in storage; it is no longer offered here.",
    checkedTranslation: "I checked this translation",
    noMatch: "No photos match",
    loadMore: "Load more",
  },
  ar: {
    media: "الوسائط",
    upload: "رفع",
    search: "بحث",
    altText: "النص البديل",
    altRow: "النص البديل: EN AR ES",
    deleteImage: "حذف الصورة",
    close: "إغلاق",
    save: "حفظ",
    choosePhoto: "اختيار صورة",
    changePhoto: "تغيير الصورة",
    removePhoto: "إزالة الصورة",
    addPhotos: "إضافة صور",
    choose: "اختيار",
    uploadPhoto: "رفع صورة",
    altEnRequired: "النص البديل بالإنجليزية (مطلوب)",
    uploadHint: "JPEG أو PNG أو WebP، حتى 15 ميغابايت",
    uploading: "جارٍ الرفع…",
    uploaded: "تم الرفع",
    tooLarge: "حجم هذا الملف أكبر من 15 ميغابايت.",
    wrongType: "استخدم صورة بصيغة JPEG أو PNG أو WebP.",
    incomplete: "لم يصل الرفع كاملًا. حاول مرة أخرى.",
    usedIn: "مستخدمة في {n} أماكن",
    usedInOne: "مستخدمة في مكان واحد",
    usedBlocksDelete: "هذه الصورة مستخدمة، لذلك لا يمكن حذفها.",
    staysInStorage: "يبقى الملف في التخزين؛ ولن يُعرض هنا بعد الآن.",
    checkedTranslation: "راجعت هذه الترجمة",
    noMatch: "لا توجد صور مطابقة",
    loadMore: "عرض المزيد",
  },
  es: {
    media: "Medios",
    upload: "Subir",
    search: "Buscar",
    altText: "Texto alternativo",
    altRow: "Texto alt.: EN AR ES",
    deleteImage: "Eliminar imagen",
    close: "Cerrar",
    save: "Guardar",
    choosePhoto: "Elegir foto",
    changePhoto: "Cambiar foto",
    removePhoto: "Quitar foto",
    addPhotos: "Agregar fotos",
    choose: "Elegir",
    uploadPhoto: "Subir una foto",
    altEnRequired: "Texto alternativo en inglés (obligatorio)",
    uploadHint: "JPEG, PNG o WebP, hasta 15 MB",
    uploading: "Subiendo…",
    uploaded: "Subida",
    tooLarge: "Este archivo supera los 15 MB.",
    wrongType: "Use una foto JPEG, PNG o WebP.",
    incomplete: "La subida no llegó completa. Inténtelo de nuevo.",
    usedIn: "Usada en {n} lugares",
    usedInOne: "Usada en 1 lugar",
    usedBlocksDelete: "Esta foto está en uso, así que no se puede eliminar.",
    staysInStorage: "El archivo permanece en el almacenamiento; ya no se ofrece aquí.",
    checkedTranslation: "Revisé esta traducción",
    noMatch: "No hay fotos que coincidan",
    loadMore: "Cargar más",
  },
};
