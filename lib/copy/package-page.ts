// The public package page and its request form (plan 06-06, BOOK-05, ADDN-03, F-01), EN / AR / ES, as signed on
// pictures/06-06 (the strings table, owner 2026-10-30). Public Spanish uses tú. No price, rate, person or legal text: the
// price line, the names and the nights lines are the owner's, from the CMS. The phone label is 06-05's own (owner's word on
// the signature): one set of words, read from lib/copy/site-requests.ts. `waMessage` is the plan's English with AR and ES
// drafted for the controller's check (not on the signed table).

import { SITE_REQUESTS_COPY } from "./site-requests";

export type PackagePageCopy = {
  /** The small line above the name. */
  kicker: string;
  /** The heading of the legs. */
  route: string;
  /** Before a suggested stay's name. */
  stay: string;
  /** Beside the duration line. */
  dur: string;
  /** Beside the ideal-for text when the owner set no label of her own. */
  ideal: string;
  reqHeading: string;
  reqIntro: string;
  arrive: string;
  leave: string;
  guests: string;
  cities: string;
  notes: string;
  name: string;
  email: string;
  phone: string;
  send: string;
  sending: string;
  sent: string;
  err: { required: string; email: string; phone: string; guests: string; dates: string; long: string };
  limited: string;
  failed: string;
  /** The text link at the end of the page. */
  wa: string;
  /** `{name}`: the first line of the WhatsApp message; the page's address follows it. Never a money field. */
  waMessage: string;
};

export const PACKAGE_PAGE_COPY: Record<"en" | "ar" | "es", PackagePageCopy> = {
  en: {
    kicker: "Journey",
    route: "Your route",
    stay: "Suggested stay",
    dur: "Duration",
    ideal: "Ideal for",
    reqHeading: "Request this journey",
    reqIntro: "Tell us your dates and who is travelling. We reply by email or WhatsApp with the price and how to pay.",
    arrive: "Arrive",
    leave: "Leave",
    guests: "Guests",
    cities: "Cities",
    notes: "Notes",
    name: "Name",
    email: "Email",
    phone: SITE_REQUESTS_COPY.en.plan.phone,
    send: "Send request",
    sending: "Sending…",
    sent: "Thank you. Your request has reached ALMAR. We will reply by email or WhatsApp.",
    err: {
      required: "Fill in this field.",
      email: "Check the email address.",
      phone: "Check the phone number.",
      guests: "Enter a number of guests from 1 to 99.",
      dates: "The leave date must be after the arrive date.",
      long: "Use 2,000 characters or fewer.",
    },
    limited: "Too many requests from here. Try again in a few minutes.",
    failed: "Your request could not be sent. Try again, or write to us on WhatsApp.",
    wa: "Something else? Ask on WhatsApp",
    waMessage: "Hello ALMAR, I am looking at the {name} journey and would like to ask about something else.",
  },
  ar: {
    kicker: "رحلة",
    route: "مسار رحلتكم",
    stay: "الإقامة المقترحة",
    dur: "المدة",
    ideal: "مثالي لـ",
    reqHeading: "اطلبوا هذه الرحلة",
    reqIntro: "أخبرونا بتواريخكم وبمن سيسافر. نردّ عليكم بالبريد الإلكتروني أو واتساب بالسعر وطريقة الدفع.",
    arrive: "الوصول",
    leave: "المغادرة",
    guests: "عدد الضيوف",
    cities: "المدن",
    notes: "ملاحظات",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: SITE_REQUESTS_COPY.ar.plan.phone,
    send: "أرسلوا الطلب",
    sending: "جارٍ الإرسال…",
    sent: "شكرًا لكم. وصل طلبكم إلى ALMAR. سنردّ عليكم بالبريد الإلكتروني أو واتساب.",
    err: {
      required: "املؤوا هذا الحقل.",
      email: "تحقّقوا من البريد الإلكتروني.",
      phone: "تحقّقوا من رقم الهاتف.",
      guests: "أدخلوا عدد ضيوف من 1 إلى 99.",
      dates: "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.",
      long: "استخدموا 2000 حرف أو أقل.",
    },
    limited: "طلبات كثيرة من هذا الموقع. حاولوا مرة أخرى بعد بضع دقائق.",
    failed: "تعذّر إرسال طلبكم. حاولوا مرة أخرى أو راسلونا على واتساب.",
    wa: "هل تريدون شيئًا آخر؟ اسألونا على واتساب",
    waMessage: "مرحبًا ALMAR، أتصفّح رحلة {name} وأودّ الاستفسار عن أمر آخر.",
  },
  es: {
    kicker: "Viaje",
    route: "Tu ruta",
    stay: "Estancia sugerida",
    dur: "Duración",
    ideal: "Ideal para",
    reqHeading: "Solicita este viaje",
    reqIntro: "Cuéntanos tus fechas y quién viaja. Te respondemos por correo o por WhatsApp con el precio y cómo pagar.",
    arrive: "Llegada",
    leave: "Salida",
    guests: "Viajeros",
    cities: "Ciudades",
    notes: "Notas",
    name: "Nombre",
    email: "Correo electrónico",
    phone: SITE_REQUESTS_COPY.es.plan.phone,
    send: "Enviar solicitud",
    sending: "Enviando…",
    sent: "Gracias. Tu solicitud ha llegado a ALMAR. Te responderemos por correo o por WhatsApp.",
    err: {
      required: "Completa este campo.",
      email: "Revisa el correo electrónico.",
      phone: "Revisa el número de teléfono.",
      guests: "Escribe un número de viajeros del 1 al 99.",
      dates: "La fecha de salida debe ser posterior a la de llegada.",
      long: "Usa 2.000 caracteres o menos.",
    },
    limited: "Demasiadas solicitudes desde aquí. Inténtalo de nuevo en unos minutos.",
    failed: "No se pudo enviar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.",
    wa: "¿Algo más? Pregunta por WhatsApp",
    waMessage: "Hola, ALMAR: estoy viendo el viaje {name} y me gustaría preguntar por otra cosa.",
  },
};
