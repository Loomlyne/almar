export type GuestLocale = "en" | "ar" | "es";

export type GuestCopy = {
  login: string;
  signIn: string;
  email: string;
  accessWithMagicLink: string;
  enterEmail: string;
  bookings: string;
  noBookingsYet: string;
  startATrip: string;
  account: string;
  name: string;
  phone: string;
  language: string;
  signOut: string;
};

export const GUEST_COPY: Record<GuestLocale, GuestCopy> = {
  en: {
    login: "Login",
    signIn: "Sign in",
    email: "Email",
    accessWithMagicLink: "Access with magic link",
    enterEmail: "Enter an email address.",
    bookings: "Bookings",
    noBookingsYet: "No bookings yet",
    startATrip: "Start a trip",
    account: "Account",
    name: "Name",
    phone: "Phone",
    language: "Language",
    signOut: "Sign out",
  },
  ar: {
    login: "دخول",
    signIn: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    accessWithMagicLink: "الدخول برابط سحري",
    enterEmail: "أدخل عنوان بريد إلكتروني.",
    bookings: "الحجوزات",
    noBookingsYet: "لا حجوزات بعد",
    startATrip: "ابدأ رحلة",
    account: "الحساب",
    name: "الاسم",
    phone: "الهاتف",
    language: "اللغة",
    signOut: "تسجيل الخروج",
  },
  es: {
    login: "Entrar",
    signIn: "Iniciar sesión",
    email: "Correo electrónico",
    accessWithMagicLink: "Acceder con enlace mágico",
    enterEmail: "Ingresa una dirección de correo electrónico.",
    bookings: "Reservas",
    noBookingsYet: "Aún no hay reservas",
    startATrip: "Empezar un viaje",
    account: "Cuenta",
    name: "Nombre",
    phone: "Teléfono",
    language: "Idioma",
    signOut: "Cerrar sesión",
  },
};
