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
  /** Plan 02-02, canvas board 6a (Login) and UI-SPEC Strings. */
  auth: {
    heading: string;
    lead: string;
    newHere: string;
    checkEmail: string;
    sentTo: string;
    differentEmail: string;
    sendAgain: string;
    waitSeconds: string;
    linkExpired: string;
    unavailable: string;
    cannotUseEmail: string;
    tagline: string;
    imageAlt: string;
  };
  /** Plan 02-02, canvas board 6b (Account hub): only the parts that work in Phase 2. */
  hub: {
    profile: string;
    firstName: string;
    lastName: string;
    phoneOptional: string;
    save: string;
    saved: string;
    saveFailed: string;
    preferences: string;
    currency: string;
    signInSecurity: string;
    signedInAs: string;
    oneTimeLink: string;
    addFirstName: string;
    addLastName: string;
    nameCharacters: string;
    phoneCharacters: string;
    goHome: string;
    personal: string;
    settings: string;
    needHelp: string;
    needHelpLine: string;
    menuLabel: string;
  };
  /** Plan 02-02, the sign-in email (key "mail"). Public emails never name the ops host. */
  mail: {
    subjectSignIn: string;
    subjectConfirm: string;
    intro: string;
    ignore: string;
    sender: string;
  };
  /** Plan 02-03, the 404 on the server runtime. The static host 404 stays English (lib/not-found-document.ts). */
  notFound: {
    title: string;
    returnHome: string;
  };
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
    auth: {
      heading: "Sign in or create an account",
      lead: "We email you a one-time link. No password to remember.",
      newHere: "New here? Your account is created the first time you use the link.",
      checkEmail: "Check your email",
      sentTo: "We sent a sign-in link to",
      differentEmail: "Use a different email",
      sendAgain: "Send again",
      waitSeconds: "{seconds} s",
      linkExpired: "Your link expired. Try again.",
      unavailable: "Sign-in is not available right now. Try again later.",
      cannotUseEmail: "This email cannot be used here.",
      tagline: "Colombia, Privately Yours",
      imageAlt: "Colonial courtyard in Cartagena’s walled city",
    },
    hub: {
      profile: "Profile",
      firstName: "First name",
      lastName: "Last name",
      phoneOptional: "Phone, optional",
      save: "Save",
      saved: "Saved.",
      saveFailed: "Not saved. Try again.",
      preferences: "Preferences",
      currency: "Currency",
      signInSecurity: "Sign-in and security",
      signedInAs: "Signed in as",
      oneTimeLink: "You sign in with a one-time link sent to this email.",
      addFirstName: "Add your name.",
      addLastName: "Add your last name.",
      nameCharacters: "Use letters, spaces, or hyphens.",
      phoneCharacters: "Use digits and a plus only.",
      goHome: "Go to the home page",
      personal: "Personal",
      settings: "Settings",
      needHelp: "Need help?",
      needHelpLine: "Message your concierge on WhatsApp.",
      menuLabel: "Account menu",
    },
    mail: {
      subjectSignIn: "Sign in",
      subjectConfirm: "Confirm your email",
      intro: "Use this button to sign in to ALMAR Private Journey.",
      ignore: "If you did not ask for this email, you can ignore it.",
      sender: "ALMAR Private Journey",
    },
    notFound: {
      title: "Page not found",
      returnHome: "Return home",
    },
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
    auth: {
      heading: "سجّل الدخول أو أنشئ حسابًا",
      lead: "نرسل إليك رابطًا لمرة واحدة. لا كلمة مرور لتتذكرها.",
      newHere: "جديد هنا؟ يُنشأ حسابك عند أول استخدام للرابط.",
      checkEmail: "تحقق من بريدك",
      sentTo: "أرسلنا رابط تسجيل الدخول إلى",
      differentEmail: "استخدم بريدًا آخر",
      sendAgain: "أعد الإرسال",
      waitSeconds: "{seconds} ث",
      linkExpired: "انتهت صلاحية الرابط. حاول مرة أخرى.",
      unavailable: "تسجيل الدخول غير متاح الآن. حاول لاحقًا.",
      cannotUseEmail: "لا يمكن استخدام هذا البريد هنا.",
      tagline: "كولومبيا، لكم بخصوصية",
      imageAlt: "فناء استعماري في مدينة قرطاجنة المسوّرة",
    },
    hub: {
      profile: "الملف الشخصي",
      firstName: "الاسم",
      lastName: "اسم العائلة",
      phoneOptional: "الهاتف، اختياري",
      save: "حفظ",
      saved: "تم الحفظ.",
      saveFailed: "لم يتم الحفظ. حاول مرة أخرى.",
      preferences: "التفضيلات",
      currency: "العملة",
      signInSecurity: "تسجيل الدخول والأمان",
      signedInAs: "مسجّل الدخول باسم",
      oneTimeLink: "تسجّل الدخول برابط لمرة واحدة يُرسل إلى هذا البريد.",
      addFirstName: "أضف اسمك.",
      addLastName: "أضف اسم عائلتك.",
      nameCharacters: "استخدم حروفاً أو مسافات أو شرطات.",
      phoneCharacters: "استخدم أرقاماً وعلامة زائد فقط.",
      goHome: "الانتقال إلى الصفحة الرئيسية",
      personal: "شخصي",
      settings: "الإعدادات",
      needHelp: "تحتاج مساعدة؟",
      needHelpLine: "راسل منسّقك عبر واتساب.",
      menuLabel: "قائمة الحساب",
    },
    mail: {
      subjectSignIn: "تسجيل الدخول",
      subjectConfirm: "أكد بريدك",
      intro: "استخدم هذا الزر لتسجيل الدخول إلى ALMAR Private Journey.",
      ignore: "إذا لم تطلب هذه الرسالة، يمكنك تجاهلها.",
      sender: "ALMAR Private Journey",
    },
    notFound: {
      title: "الصفحة غير موجودة",
      returnHome: "العودة إلى الرئيسية",
    },
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
    auth: {
      heading: "Inicia sesión o crea una cuenta",
      lead: "Te enviamos un enlace de un solo uso. Sin contraseña que recordar.",
      newHere: "¿Primera vez? Tu cuenta se crea la primera vez que usas el enlace.",
      checkEmail: "Revisa tu correo",
      sentTo: "Enviamos un enlace de acceso a",
      differentEmail: "Usar otro correo",
      sendAgain: "Enviar de nuevo",
      waitSeconds: "{seconds} s",
      linkExpired: "Tu enlace caducó. Inténtalo de nuevo.",
      unavailable: "El acceso no está disponible ahora. Inténtalo más tarde.",
      cannotUseEmail: "Este correo no se puede usar aquí.",
      tagline: "Colombia, en privado",
      imageAlt: "Patio colonial en la ciudad amurallada de Cartagena",
    },
    hub: {
      profile: "Perfil",
      firstName: "Nombre",
      lastName: "Apellidos",
      phoneOptional: "Teléfono, opcional",
      save: "Guardar",
      saved: "Guardado.",
      saveFailed: "No se guardó. Inténtalo de nuevo.",
      preferences: "Preferencias",
      currency: "Moneda",
      signInSecurity: "Acceso y seguridad",
      signedInAs: "Sesión iniciada como",
      oneTimeLink: "Accedes con un enlace de un solo uso enviado a este correo.",
      addFirstName: "Añade tu nombre.",
      addLastName: "Añade tus apellidos.",
      nameCharacters: "Usa letras, espacios o guiones.",
      phoneCharacters: "Usa solo dígitos y un más.",
      goHome: "Ir a la página de inicio",
      personal: "Personal",
      settings: "Ajustes",
      needHelp: "¿Necesitas ayuda?",
      needHelpLine: "Escribe a tu conserje por WhatsApp.",
      menuLabel: "Menú de la cuenta",
    },
    mail: {
      subjectSignIn: "Iniciar sesión",
      subjectConfirm: "Confirma tu correo",
      intro: "Usa este botón para acceder a ALMAR Private Journey.",
      ignore: "Si no pediste este correo, puedes ignorarlo.",
      sender: "ALMAR Private Journey",
    },
    notFound: {
      title: "Página no encontrada",
      returnHome: "Volver al inicio",
    },
  },
};
