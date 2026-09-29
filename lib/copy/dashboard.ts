import type { DocumentLocale } from "../set-document-locale";

export type DashboardLocale = DocumentLocale;

/**
 * Dashboard chrome. English strings are locked.
 * Arabic and Spanish for Close, New booking, and No bookings yet match the UI-SPEC table.
 * Other Arabic and Spanish are standard and correctable at UAT.
 * The owner-only public label is not in this table. Currency codes stay AED, USD, EUR.
 */
export type DashboardCopy = {
  close: string;
  newBooking: string;
  newCustomer: string;
  newDestination: string;
  newStay: string;
  newExperience: string;
  newPackage: string;
  newPage: string;
  newPost: string;
  newMember: string;
  newLegalPage: string;
  noBookingsYet: string;
  noCustomersYet: string;
  noDestinationsYet: string;
  noStaysYet: string;
  noExperiencesYet: string;
  noPackagesYet: string;
  noPagesYet: string;
  noPostsYet: string;
  noTeamMembersYet: string;
  noLegalPagesYet: string;
  noRemindersYet: string;
  signOut: string;
  logoutAll: string;
  signOutOfThisSite: string;
  signOutEverywhere: string;
  staySignedIn: string;
  thisMonth: string;
  last30: string;
  custom: string;
  block: string;
  publish: string;
  save: string;
  menu: string;
  closeMenu: string;
  skip: string;
  currencies: {
    aed: string;
    usd: string;
    eur: string;
  };
  rail: {
    home: string;
    bookings: string;
    customers: string;
    calendar: string;
    catalog: string;
    destinations: string;
    stays: string;
    experiences: string;
    packages: string;
    content: string;
    pages: string;
    blog: string;
    team: string;
    legal: string;
    settings: string;
    profile: string;
  };
};

const currencies = { aed: "AED", usd: "USD", eur: "EUR" } as const;

export const DASHBOARD_COPY: Record<DashboardLocale, DashboardCopy> = {
  en: {
    close: "Close",
    newBooking: "New booking",
    newCustomer: "New customer",
    newDestination: "New destination",
    newStay: "New stay",
    newExperience: "New experience",
    newPackage: "New package",
    newPage: "New page",
    newPost: "New post",
    newMember: "New member",
    newLegalPage: "New legal page",
    noBookingsYet: "No bookings yet",
    noCustomersYet: "No customers yet",
    noDestinationsYet: "No destinations yet",
    noStaysYet: "No stays yet",
    noExperiencesYet: "No experiences yet",
    noPackagesYet: "No packages yet",
    noPagesYet: "No pages yet",
    noPostsYet: "No posts yet",
    noTeamMembersYet: "No team members yet",
    noLegalPagesYet: "No legal pages yet",
    noRemindersYet: "No reminders yet",
    signOut: "Sign out",
    logoutAll: "Logout-all",
    signOutOfThisSite: "Sign out of this site",
    signOutEverywhere: "Sign out everywhere",
    staySignedIn: "Stay signed in",
    thisMonth: "This month",
    last30: "Last 30",
    custom: "Custom",
    block: "Block",
    publish: "Publish",
    save: "Save",
    menu: "Menu",
    closeMenu: "Close menu",
    skip: "Skip to content",
    currencies,
    rail: {
      home: "Home",
      bookings: "Bookings",
      customers: "Customers",
      calendar: "Calendar",
      catalog: "Catalog",
      destinations: "Destinations",
      stays: "Stays",
      experiences: "Experiences & Services",
      packages: "Packages",
      content: "Content",
      pages: "Pages",
      blog: "Blog",
      team: "Team",
      legal: "Legal",
      settings: "Settings",
      profile: "Profile",
    },
  },
  ar: {
    close: "إغلاق",
    newBooking: "حجز جديد",
    newCustomer: "عميل جديد",
    newDestination: "وجهة جديدة",
    newStay: "إقامة جديدة",
    newExperience: "تجربة جديدة",
    newPackage: "باقة جديدة",
    newPage: "صفحة جديدة",
    newPost: "مقال جديد",
    newMember: "عضو جديد",
    newLegalPage: "صفحة قانونية جديدة",
    noBookingsYet: "لا حجوزات بعد",
    noCustomersYet: "لا عملاء بعد",
    noDestinationsYet: "لا وجهات بعد",
    noStaysYet: "لا إقامات بعد",
    noExperiencesYet: "لا تجارب بعد",
    noPackagesYet: "لا باقات بعد",
    noPagesYet: "لا صفحات بعد",
    noPostsYet: "لا مقالات بعد",
    noTeamMembersYet: "لا أعضاء في الفريق بعد",
    noLegalPagesYet: "لا صفحات قانونية بعد",
    noRemindersYet: "لا تذكيرات بعد",
    signOut: "تسجيل الخروج",
    logoutAll: "خروج من الكل",
    signOutOfThisSite: "تسجيل الخروج من هذا الموقع",
    signOutEverywhere: "تسجيل الخروج من كل مكان",
    staySignedIn: "البقاء في الجلسة",
    thisMonth: "هذا الشهر",
    last30: "آخر 30",
    custom: "مخصص",
    block: "حظر",
    publish: "نشر",
    save: "حفظ",
    menu: "القائمة",
    closeMenu: "إغلاق القائمة",
    skip: "تخطي إلى المحتوى",
    currencies,
    rail: {
      home: "الرئيسية",
      bookings: "الحجوزات",
      customers: "العملاء",
      calendar: "التقويم",
      catalog: "الكتالوج",
      destinations: "الوجهات",
      stays: "الإقامات",
      experiences: "التجارب والخدمات",
      packages: "الباقات",
      content: "المحتوى",
      pages: "الصفحات",
      blog: "المدونة",
      team: "الفريق",
      legal: "القانوني",
      settings: "الإعدادات",
      profile: "الملف",
    },
  },
  es: {
    close: "Cerrar",
    newBooking: "Nueva reserva",
    newCustomer: "Nuevo cliente",
    newDestination: "Nuevo destino",
    newStay: "Nueva estancia",
    newExperience: "Nueva experiencia",
    newPackage: "Nuevo paquete",
    newPage: "Nueva página",
    newPost: "Nueva publicación",
    newMember: "Nuevo miembro",
    newLegalPage: "Nueva página legal",
    noBookingsYet: "Aún no hay reservas",
    noCustomersYet: "Aún no hay clientes",
    noDestinationsYet: "Aún no hay destinos",
    noStaysYet: "Aún no hay estancias",
    noExperiencesYet: "Aún no hay experiencias",
    noPackagesYet: "Aún no hay paquetes",
    noPagesYet: "Aún no hay páginas",
    noPostsYet: "Aún no hay publicaciones",
    noTeamMembersYet: "Aún no hay miembros",
    noLegalPagesYet: "Aún no hay páginas legales",
    noRemindersYet: "Aún no hay recordatorios",
    signOut: "Cerrar sesión",
    logoutAll: "Cerrar sesión en todos",
    signOutOfThisSite: "Cerrar sesión en este sitio",
    signOutEverywhere: "Cerrar sesión en todas partes",
    staySignedIn: "Seguir dentro",
    thisMonth: "Este mes",
    last30: "Últimos 30",
    custom: "Personalizado",
    block: "Bloquear",
    publish: "Publicar",
    save: "Guardar",
    menu: "Menú",
    closeMenu: "Cerrar menú",
    skip: "Saltar al contenido",
    currencies,
    rail: {
      home: "Inicio",
      bookings: "Reservas",
      customers: "Clientes",
      calendar: "Calendario",
      catalog: "Catálogo",
      destinations: "Destinos",
      stays: "Estancias",
      experiences: "Experiencias y servicios",
      packages: "Paquetes",
      content: "Contenido",
      pages: "Páginas",
      blog: "Blog",
      team: "Equipo",
      legal: "Legal",
      settings: "Ajustes",
      profile: "Perfil",
    },
  },
};
