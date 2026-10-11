// Payment panel copy (plan 04-04, PAY-06, PAY-08, B-03, B-20). A new file, not lib/copy/journey.ts: 04-03 owns that one.
// EN is the source. AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American) are DRAFTS written from the
// EN strings, flagged for the owner's review with the other new copy (the booking screens' signature, plan 04-07).
// `{total}` is filled by lib/journey-format.ts `fill` with the amount Stripe's checkout object reports; the page never
// computes it (Stripe's confirm() refuses a page that does not show that total).

export type PaymentLocale = "en" | "ar" | "es";

const EN = {
  loading: "Loading secure payment",
  loadError: "The payment form could not be loaded. Check your connection and try again.",
  secure: "Your card details go straight to Stripe. ALMAR does not store them.",
  pay: { label: "Pay {total}", busy: "Processing payment" },
  currency: {
    label: "Pay in",
    note: "Your bank card can be charged in your currency at Stripe's rate; ALMAR receives AED.",
  },
  error: { generic: "The payment could not be completed. Please try again." },
} as const;

type Shape<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type PaymentCopy = Shape<typeof EN>;

const AR: PaymentCopy = {
  loading: "جارٍ تحميل الدفع الآمن",
  loadError: "تعذّر تحميل نموذج الدفع. تحقّق من اتصالك وحاول مرة أخرى.",
  secure: "تُرسل بيانات بطاقتك مباشرةً إلى Stripe. لا يحتفظ ALMAR بها.",
  pay: { label: "ادفع {total}", busy: "جارٍ معالجة الدفع" },
  currency: {
    label: "الدفع بعملة",
    note: "يمكن خصم المبلغ من بطاقتك المصرفية بعملتك وفق سعر Stripe؛ ويتلقى ALMAR المبلغ بالدرهم الإماراتي.",
  },
  error: { generic: "تعذّر إتمام الدفع. يرجى المحاولة مرة أخرى." },
};

const ES: PaymentCopy = {
  loading: "Cargando el pago seguro",
  loadError: "No se pudo cargar el formulario de pago. Revisa tu conexión e inténtalo de nuevo.",
  secure: "Los datos de tu tarjeta van directamente a Stripe. ALMAR no los guarda.",
  pay: { label: "Pagar {total}", busy: "Procesando el pago" },
  currency: {
    label: "Pagar en",
    note: "Tu tarjeta puede cargarse en tu moneda al tipo de cambio de Stripe; ALMAR recibe AED.",
  },
  error: { generic: "No se pudo completar el pago. Inténtalo de nuevo." },
};

export function paymentCopy(locale: PaymentLocale): PaymentCopy {
  if (locale === "ar") return AR;
  if (locale === "es") return ES;
  return EN;
}
