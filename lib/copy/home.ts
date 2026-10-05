// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
export type HomeLocale = "en" | "ar" | "es";

export type HomeCopy = {
  skip: string;
  nav: {
    destinations: string;
    experiences: string;
    about: string;
    contact: string;
    currency: string;
    language: string;
    login: string;
    menu: string;
    close: string;
  };
  heroTitle: string;
  heroImageAlt: string;
  welcomeKicker: string;
  welcomeTitle: string;
  letter: string;
  welcome: [string, string, string];
  galleryTitle: string;
  staysTitle: string;
  staysIntro: string;
  stays: Array<{ name: string; detail: string; alt: string; src: string }>;
  servicesTitle: string;
  servicesIntro: string;
  services: Array<{ name: string; text: string; alt: string; src?: string }>;
  momentsTitle: string;
  momentsIntro: string;
  journeysTitle: string;
  journeysIntro: string;
  journeys: Array<{ name: string; price: string; text: string; alt: string; src: string }>;
  storiesTitle: string;
  stories: Array<{ title: string; date: string; alt: string; src: string }>;
  contactTitle: string;
  contactIntro: string;
  name: string;
  email: string;
  message: string;
  send: string;
  notSent: string;
  teamTitle: string;
  team: Array<{ name: string; role: string; alt: string; src: string }>;
  footerBrand: string;
  pages: string;
  listTitle: string;
  listIntro: string;
  newsletter: string;
  subscribe: string;
  emailError: string;
  signInTitle: string;
  signInBody: string;
  kitPieces: string;
  readStory: string;
};

const stays = {
  en: [
    { name: "Getsemaní Colonial House", detail: "Up to 10 guests", alt: "Getsemaní Colonial House, a private stay in Cartagena", src: "/assets/img/59682878de873329.webp" },
    { name: "Getsemaní Courtyard Residence", detail: "3 king beds, 2 queen beds", alt: "Getsemaní Courtyard Residence, a private stay in Cartagena", src: "/assets/img/3d4468b8d961eff5.webp" },
    { name: "Cartagena Historic Center House", detail: "Up to 7 guests", alt: "Cartagena Historic Center House, a private stay", src: "/assets/img/1c65dc4c2954c949.webp" },
  ],
  ar: [
    { name: "بيت خيتسيماني الاستعماري", detail: "حتى 10 ضيوف", alt: "بيت خيتسيماني الاستعماري، إقامة خاصة في كارتاخينا", src: "/assets/img/59682878de873329.webp" },
    { name: "إقامة فناء خيتسيماني", detail: "3 أسرّة كينغ، سريران كوين", alt: "إقامة فناء خيتسيماني، إقامة خاصة في كارتاخينا", src: "/assets/img/3d4468b8d961eff5.webp" },
    { name: "بيت المركز التاريخي في كارتاخينا", detail: "حتى 7 ضيوف", alt: "بيت المركز التاريخي في كارتاخينا، إقامة خاصة", src: "/assets/img/1c65dc4c2954c949.webp" },
  ],
  es: [
    { name: "Casa colonial de Getsemaní", detail: "Hasta 10 huéspedes", alt: "Casa colonial de Getsemaní, una estancia privada en Cartagena", src: "/assets/img/59682878de873329.webp" },
    { name: "Residencia con patio en Getsemaní", detail: "3 camas king, 2 camas queen", alt: "Residencia con patio en Getsemaní, una estancia privada en Cartagena", src: "/assets/img/3d4468b8d961eff5.webp" },
    { name: "Casa del centro histórico de Cartagena", detail: "Hasta 7 huéspedes", alt: "Casa del centro histórico de Cartagena, una estancia privada", src: "/assets/img/1c65dc4c2954c949.webp" },
  ],
} as const;

export const HOME_COPY: Record<HomeLocale, HomeCopy> = {
  en: {
    skip: "Skip to content",
    nav: {
      destinations: "Destinations",
      experiences: "Experiences",
      about: "About",
      contact: "Contact",
      currency: "Currency",
      language: "Language",
      login: "Login",
      menu: "Menu",
      close: "Close menu",
    },
    heroTitle: "Colombia, Privately Yours",
    heroImageAlt: "Colonial courtyard in Cartagena’s walled city",
    welcomeKicker: "Welcome to ALMAR",
    welcomeTitle: "Where Safety Meets Bespoke Luxury",
    letter: "Dear Traveler,",
    welcome: [
      "ALMAR is built for travellers in the UAE and GCC who want a considered private journey through Colombia, planned around their dates, interests, and preferred pace.",
      "Each journey is personalised with stays, transport, and experiences confirmed for your group. Any additional arrangements are discussed individually and secured only once availability is confirmed.",
      "Our aim is simple: make Colombia easier to experience with a private journey that is clear, personal, and built around what matters to you.",
    ],
    galleryTitle: "Colombia, Beautifully Captured",
    staysTitle: "Private Stays, Fully Vetted",
    staysIntro: "Verified private houses, island estates, and countryside retreats across Cartagena and Antioquia, each selected for security, staff readiness, and discretion.",
    stays: [...stays.en],
    servicesTitle: "Everything Handled. Nothing Left to Chance.",
    servicesIntro: "From private villas to a dedicated concierge, ALMAR manages every detail of your Colombia journey, so you can simply live it.",
    services: [
      {
        name: "24/7 private concierge",
        text: "Reservations, logistics, and last-minute requests, handled around the clock across Colombia.",
        alt: "24/7 private concierge, an ALMAR service in Colombia",
        src: "/assets/img/fad99748eb29b7f8.webp",
      },
      {
        name: "Private chauffeur",
        text: "Mercedes S-Class, Range Rover, and VIP sprinter vans with bilingual chauffeurs.",
        alt: "Private chauffeur for an ALMAR journey in Colombia",
      },
      {
        name: "VIP airport meet and greet",
        text: "Fast-track immigration, lounge access, and curbside pickup at BOG, MDE, and CTG.",
        alt: "VIP airport meet and greet, an ALMAR service in Colombia",
      },
    ],
    momentsTitle: "Moments Designed for You",
    momentsIntro: "From private yacht charters to helicopter tours, every experience is curated around you.",
    journeysTitle: "Choose Your Journey",
    journeysIntro: "Three tiers of privacy and time in Colombia. Each is shaped around a different depth of experience. Prices stay as written. Currency does not convert on this page.",
    journeys: [
      {
        name: "The Explorer",
        price: "From USD $3,000/person · Est. AED 80,000–90,000",
        text: "A considered introduction to Colombia, shaped around your group.",
        alt: "Colorful colonial balconies in Cartagena for The Explorer private journey",
        src: "/assets/img/6dfbf0e54d04f1da.webp",
      },
      {
        name: "The Resident",
        price: "From USD $3,500/person · Est. AED 120,000–150,000",
        text: "A deeper multi-city journey, tailored to your pace. 8–14 nights.",
        alt: "Luxury resort pool framed by tropical mountains for The Resident journey",
        src: "/assets/img/b58677dc2a514f73.webp",
      },
      {
        name: "The Sovereign",
        price: "From USD $20,000/person · Est. AED 200,000–250,000+",
        text: "A high-touch journey, shaped around confirmed possibilities. 14–21 nights.",
        alt: "Private yacht on open water for The Sovereign journey",
        src: "/assets/img/88ad9b5c0cfb91eb.webp",
      },
    ],
    storiesTitle: "ALMAR Stories",
    stories: [
      {
        title: "Discovering Cartagena’s Hidden Colonial Courtyards",
        date: "1 Jun 2025",
        alt: "Colonial courtyard in Cartagena’s walled city with colourful facades and bougainvillea",
        src: "/assets/img/ef78a57ee630532d.webp",
      },
      {
        title: "Why Medellín Is Redefining Luxury Travel in Latin America",
        date: "1 Jun 2025",
        alt: "Medellín city panorama at dusk with lights on the hillside neighbourhoods",
        src: "/assets/img/21bbbec680a4a9ab.webp",
      },
    ],
    contactTitle: "Begin Your Journey",
    contactIntro: "Write to us. Nothing on this page is sent.",
    name: "Name",
    email: "Email",
    message: "Message",
    send: "Send message",
    notSent: "Nothing is sent from this page.",
    teamTitle: "Local insight, personally delivered.",
    team: [],
    footerBrand: "ALMAR",
    pages: "Pages",
    listTitle: "List with us",
    listIntro: "Tell us about a house. Nothing on this page is sent.",
    newsletter: "Newsletter",
    subscribe: "Subscribe",
    emailError: "Enter an email as name@example.com.",
    signInTitle: "Login",
    signInBody: "Sign in uses a magic link. It is not on this page.",
    kitPieces: "Kit pieces",
    readStory: "Read story",
  },
  ar: {
    skip: "تخطي إلى المحتوى",
    nav: {
      destinations: "الوجهات",
      experiences: "التجارب",
      about: "عنّا",
      contact: "تواصل",
      currency: "العملة",
      language: "اللغة",
      login: "دخول",
      menu: "القائمة",
      close: "إغلاق القائمة",
    },
    heroTitle: "كولومبيا، لكم بخصوصية",
    heroImageAlt: "فناء استعماري في المدينة المسوّرة في كارتاخينا",
    welcomeKicker: "أهلاً بكم في ALMAR",
    welcomeTitle: "حيث يلتقي الأمان بالفخامة المفصّلة",
    letter: "عزيزي المسافر،",
    welcome: [
      "بُنيت ALMAR للمسافرين من الإمارات والخليج الذين يريدون رحلة خاصة مدروسة في كولومبيا، تُخطَّط حول تواريخهم واهتماماتهم وإيقاعهم.",
      "كل رحلة تُفصَّل بإقامات وتنقّل وتجارب مؤكدة لمجموعتكم. أي ترتيبات إضافية تُناقَش على حدة ولا تُثبَّت إلا بعد تأكيد التوفر.",
      "هدفنا بسيط: أن نجعل تجربة كولومبيا أسهل عبر رحلة خاصة واضحة وشخصية، مبنية حول ما يهمكم.",
    ],
    galleryTitle: "كولومبيا، في أبهى صورها",
    staysTitle: "إقامات خاصة، موثّقة بالكامل",
    staysIntro: "بيوت خاصة موثّقة وعِزَب على الجزر وملاذات ريفية في كارتاخينا وأنتيوكيا، اختيرت لأمانها وجاهزية طاقمها وخصوصيتها.",
    stays: [...stays.ar],
    servicesTitle: "كل شيء مُرتَّب. لا شيء متروك للصدفة.",
    servicesIntro: "من الفلل الخاصة إلى الكونسيرج المخصّص، تتولى ALMAR كل تفصيل في رحلتكم إلى كولومبيا، فلا يبقى لكم إلا أن تعيشوها.",
    services: [
      {
        name: "كونسيرج على مدار الساعة",
        text: "حجوزات، وتنسيق، وطلبات اللحظة الأخيرة، على مدار الساعة في كولومبيا.",
        alt: "كونسيرج خاص على مدار الساعة، خدمة كونسيرج من ALMAR في كولومبيا",
        src: "/assets/img/fad99748eb29b7f8.webp",
      },
      {
        name: "سائق خاص",
        text: "مرسيدس إس-كلاس، ورينج روفر، وفانات كبار الشخصيات مع سائقين ثنائيي اللغة.",
        alt: "سائق خاص لرحلة من ALMAR في كولومبيا",
      },
      {
        name: "استقبال في المطار",
        text: "عبور سريع للجوازات، وصالة، واستلام عند الرصيف في بوغوتا وميديلين وكارتاخينا.",
        alt: "استقبال كبار الشخصيات في المطار، خدمة من ALMAR في كولومبيا",
      },
    ],
    momentsTitle: "لحظات صُمّمت لكم",
    momentsIntro: "من استئجار اليخوت الخاصة إلى الجولات بالمروحية، تُنتقى كل تجربة خصيصاً لكم.",
    journeysTitle: "اختاروا رحلتكم",
    journeysIntro: "ثلاثة مستويات من الخصوصية والوقت في كولومبيا. الأسعار تبقى كما كُتبت. العملة لا تُحوَّل في هذه الصفحة.",
    journeys: [
      {
        name: "المستكشف",
        price: "From USD $3,000/person · Est. AED 80,000–90,000",
        text: "تعرّف مدروس على كولومبيا، يُشكَّل حول مجموعتكم.",
        alt: "شرفات استعمارية ملوّنة في كارتاخينا لرحلة المستكشف الخاصة",
        src: "/assets/img/6dfbf0e54d04f1da.webp",
      },
      {
        name: "المقيم",
        price: "From USD $3,500/person · Est. AED 120,000–150,000",
        text: "رحلة أعمق بين أكثر من مدينة، على إيقاعكم. 8–14 ليلة.",
        alt: "مسبح منتجع فاخر تحيط به جبال استوائية لرحلة المقيم",
        src: "/assets/img/b58677dc2a514f73.webp",
      },
      {
        name: "السيادة",
        price: "From USD $20,000/person · Est. AED 200,000–250,000+",
        text: "رحلة عالية العناية، تُشكَّل حول ما يمكن تأكيده. 14–21 ليلة.",
        alt: "يخت خاص في عرض البحر لرحلة السيادة",
        src: "/assets/img/88ad9b5c0cfb91eb.webp",
      },
    ],
    storiesTitle: "حكايات ALMAR",
    stories: [
      {
        title: "اكتشاف الأفنية الاستعمارية المخفية في كارتاخينا",
        date: "1 يونيو 2025",
        alt: "فناء استعماري في المدينة المسوّرة في كارتاخينا مع واجهات ملوّنة وجهنمية",
        src: "/assets/img/ef78a57ee630532d.webp",
      },
      {
        title: "لماذا تعيد ميديلين تعريف السفر الفاخر في أمريكا اللاتينية",
        date: "1 يونيو 2025",
        alt: "بانوراما ميديلين عند الغسق وأضواء أحياء التلال",
        src: "/assets/img/21bbbec680a4a9ab.webp",
      },
    ],
    contactTitle: "ابدأوا رحلتكم",
    contactIntro: "اكتبوا لنا. لا يُرسَل شيء من هذه الصفحة.",
    name: "الاسم",
    email: "البريد",
    message: "الرسالة",
    send: "إرسال الرسالة",
    notSent: "لا يُرسَل شيء من هذه الصفحة.",
    teamTitle: "معرفة محلية، تُقدَّم شخصياً.",
    team: [],
    footerBrand: "ALMAR",
    pages: "الصفحات",
    listTitle: "أدرجوا عقاركم",
    listIntro: "أخبرونا عن البيت. لا يُرسَل شيء من هذه الصفحة.",
    newsletter: "النشرة",
    subscribe: "اشتراك",
    emailError: "أدخلوا بريداً بصيغة name@example.com.",
    signInTitle: "دخول",
    signInBody: "الدخول عبر رابط سحري. ليس في هذه الصفحة.",
    kitPieces: "قطع المجموعة",
    readStory: "اقرأوا الحكاية",
  },
  es: {
    skip: "Saltar al contenido",
    nav: {
      destinations: "Destinos",
      experiences: "Experiencias",
      about: "Nosotros",
      contact: "Contacto",
      currency: "Moneda",
      language: "Idioma",
      login: "Entrar",
      menu: "Menú",
      close: "Cerrar menú",
    },
    heroTitle: "Colombia, en privado",
    heroImageAlt: "Patio colonial en la ciudad amurallada de Cartagena",
    welcomeKicker: "Bienvenido a ALMAR",
    welcomeTitle: "Donde la seguridad se encuentra con el lujo a medida",
    letter: "Estimado viajero,",
    welcome: [
      "ALMAR está hecho para viajeros de Emiratos y el Golfo que quieren un viaje privado y pensado por Colombia, organizado según sus fechas, intereses y ritmo.",
      "Cada viaje se personaliza con estancias, traslados y experiencias confirmadas para su grupo. Cualquier arreglo adicional se habla por separado y solo se reserva cuando hay disponibilidad.",
      "El objetivo es simple: hacer Colombia más fácil, con un viaje privado claro, personal y construido alrededor de lo que les importa.",
    ],
    galleryTitle: "Colombia, bellamente retratada",
    staysTitle: "Estancias privadas, totalmente verificadas",
    staysIntro: "Casas privadas verificadas, fincas en islas y retiros de campo en Cartagena y Antioquia, elegidas por su seguridad, su personal preparado y su discreción.",
    stays: [...stays.es],
    servicesTitle: "Todo resuelto. Nada dejado al azar.",
    servicesIntro: "De villas privadas a un conserje dedicado, ALMAR se ocupa de cada detalle de tu viaje por Colombia, para que solo tengas que vivirlo.",
    services: [
      {
        name: "Conserje 24/7",
        text: "Reservas, logística y pedidos de último momento, a cualquier hora en Colombia.",
        alt: "Conserje privado 24/7, un servicio de ALMAR en Colombia",
        src: "/assets/img/fad99748eb29b7f8.webp",
      },
      {
        name: "Chófer privado",
        text: "Mercedes Clase S, Range Rover y furgonetas VIP con chóferes bilingües.",
        alt: "Chófer privado para un viaje de ALMAR en Colombia",
      },
      {
        name: "Recibimiento VIP en el aeropuerto",
        text: "Inmigración rápida, sala y recogida en la acera en BOG, MDE y CTG.",
        alt: "Recibimiento VIP en el aeropuerto, un servicio de ALMAR en Colombia",
      },
    ],
    momentsTitle: "Momentos pensados para ti",
    momentsIntro: "De yates privados a vuelos en helicóptero, cada experiencia se diseña para ti.",
    journeysTitle: "Elige tu viaje",
    journeysIntro: "Tres niveles de privacidad y tiempo en Colombia. Los precios se quedan como están escritos. La moneda no convierte en esta página.",
    journeys: [
      {
        name: "The Explorer",
        price: "From USD $3,000/person · Est. AED 80,000–90,000",
        text: "Una introducción pensada a Colombia, diseñada en torno a tu grupo.",
        alt: "Balcones coloniales de colores en Cartagena para el viaje privado The Explorer",
        src: "/assets/img/6dfbf0e54d04f1da.webp",
      },
      {
        name: "The Resident",
        price: "From USD $3,500/person · Est. AED 120,000–150,000",
        text: "Un viaje más profundo por varias ciudades, a tu ritmo. 8–14 noches.",
        alt: "Piscina de un resort de lujo entre montañas tropicales para el viaje The Resident",
        src: "/assets/img/b58677dc2a514f73.webp",
      },
      {
        name: "The Sovereign",
        price: "From USD $20,000/person · Est. AED 200,000–250,000+",
        text: "Un viaje de mucha atención, formado alrededor de lo que se puede confirmar. 14–21 noches.",
        alt: "Yate privado en mar abierto para el viaje The Sovereign",
        src: "/assets/img/88ad9b5c0cfb91eb.webp",
      },
    ],
    storiesTitle: "Historias ALMAR",
    stories: [
      {
        title: "Descubrir los patios coloniales ocultos de Cartagena",
        date: "1 jun 2025",
        alt: "Patio colonial en la ciudad amurallada de Cartagena, con fachadas de color y buganvilla",
        src: "/assets/img/ef78a57ee630532d.webp",
      },
      {
        title: "Por qué Medellín está redefiniendo el viaje de lujo en América Latina",
        date: "1 jun 2025",
        alt: "Panorama de Medellín al anochecer, con luces en los barrios de la ladera",
        src: "/assets/img/21bbbec680a4a9ab.webp",
      },
    ],
    contactTitle: "Comienza tu viaje",
    contactIntro: "Escríbenos. Nada de esta página se envía.",
    name: "Nombre",
    email: "Correo",
    message: "Mensaje",
    send: "Enviar mensaje",
    notSent: "Nada se envía desde esta página.",
    teamTitle: "Conocimiento local, entregado en persona.",
    team: [],
    footerBrand: "ALMAR",
    pages: "Páginas",
    listTitle: "Publiquen con nosotros",
    listIntro: "Cuéntennos de una casa. Nada de esta página se envía.",
    newsletter: "Boletín",
    subscribe: "Suscribirse",
    emailError: "Escriban un correo como name@example.com.",
    signInTitle: "Entrar",
    signInBody: "La entrada es un enlace mágico. No está en esta página.",
    kitPieces: "Piezas del kit",
    readStory: "Leer la historia",
  },
};

export const BOOKER_COPY: Record<HomeLocale, {
  form: string;
  destination: string;
  choosePlace: string;
  dates: string;
  chooseDates: string;
  checkIn: string;
  checkOut: string;
  addDate: string;
  guests: string;
  search: string;
  done: string;
  clearSearch: string;
  clearDates: string;
  noMatch: string;
  placeholder: string;
  night: string;
  nights: string;
  guest: string;
  guestsWord: string;
  infant: string;
  infants: string;
  adults: string;
  children: string;
  infantsLabel: string;
  adultHint: string;
  childHint: string;
  infantHint: string;
  addAdult: string;
  removeAdult: string;
  addChild: string;
  removeChild: string;
  addInfant: string;
  removeInfant: string;
  floorNote: string;
  needBoth: string;
  needWhere: string;
  needWhen: string;
  preview: string;
  selected: string;
  checkInSet: string;
  nightSelected: string;
  nightsSelected: string;
  datesCleared: string;
}> = {
  en: {
    form: "Find a stay",
    destination: "Destination",
    choosePlace: "Choose a place",
    dates: "Dates",
    chooseDates: "Choose dates",
    checkIn: "Check-in",
    checkOut: "Check-out",
    addDate: "Add date",
    guests: "Guests",
    search: "Search",
    done: "Done",
    clearSearch: "Clear search",
    clearDates: "Clear dates",
    noMatch: "No destinations match that name.",
    placeholder: "Cartagena",
    night: "1 night",
    nights: "{count} nights",
    guest: "1 guest",
    guestsWord: "{count} guests",
    infant: "1 infant",
    infants: "{count} infants",
    adults: "Adults",
    children: "Children",
    infantsLabel: "Infants",
    adultHint: "13+",
    childHint: "3–12",
    infantHint: "0–2",
    addAdult: "Add adult",
    removeAdult: "Remove adult",
    addChild: "Add child",
    removeChild: "Remove child",
    addInfant: "Add infant",
    removeInfant: "Remove infant",
    floorNote: "At least 1 adult",
    needBoth: "Choose a destination and dates to search.",
    needWhere: "Choose a destination to search.",
    needWhen: "Choose check-in and checkout to search.",
    preview: "Search is a preview on this page.",
    selected: "{name} selected.",
    checkInSet: "Check-in set. Choose a checkout date.",
    nightSelected: "1 night selected.",
    nightsSelected: "{count} nights selected.",
    datesCleared: "Dates cleared.",
  },
  ar: {
    form: "ابحثوا عن إقامة",
    destination: "الوجهة",
    choosePlace: "اختاروا مكاناً",
    dates: "التواريخ",
    chooseDates: "اختاروا التواريخ",
    checkIn: "الوصول",
    checkOut: "المغادرة",
    addDate: "أضيفوا تاريخاً",
    guests: "الضيوف",
    search: "بحث",
    done: "تم",
    clearSearch: "امسحوا البحث",
    clearDates: "امسحوا التواريخ",
    noMatch: "لا وجهات تطابق هذا الاسم.",
    placeholder: "كارتاخينا",
    night: "ليلة واحدة",
    nights: "{count} ليالٍ",
    guest: "ضيف واحد",
    guestsWord: "{count} ضيوف",
    infant: "رضيع واحد",
    infants: "{count} رضع",
    adults: "بالغون",
    children: "أطفال",
    infantsLabel: "رضّع",
    adultHint: "13+",
    childHint: "3–12",
    infantHint: "0–2",
    addAdult: "أضيفوا بالغاً",
    removeAdult: "أزيلوا بالغاً",
    addChild: "أضيفوا طفلاً",
    removeChild: "أزيلوا طفلاً",
    addInfant: "أضيفوا رضيعاً",
    removeInfant: "أزيلوا رضيعاً",
    floorNote: "بالغ واحد على الأقل",
    needBoth: "اختاروا وجهة وتواريخ للبحث.",
    needWhere: "اختاروا وجهة للبحث.",
    needWhen: "اختاروا الوصول والمغادرة للبحث.",
    preview: "البحث معاينة في هذه الصفحة.",
    selected: "تم اختيار {name}.",
    checkInSet: "تم تحديد الوصول. اختاروا المغادرة.",
    nightSelected: "تم اختيار ليلة واحدة.",
    nightsSelected: "تم اختيار {count} ليالٍ.",
    datesCleared: "مُسحت التواريخ.",
  },
  es: {
    form: "Buscar una estancia",
    destination: "Destino",
    choosePlace: "Elijan un lugar",
    dates: "Fechas",
    chooseDates: "Elijan fechas",
    checkIn: "Entrada",
    checkOut: "Salida",
    addDate: "Añadir fecha",
    guests: "Huéspedes",
    search: "Buscar",
    done: "Listo",
    clearSearch: "Borrar búsqueda",
    clearDates: "Borrar fechas",
    noMatch: "Ningún destino coincide con ese nombre.",
    placeholder: "Cartagena",
    night: "1 noche",
    nights: "{count} noches",
    guest: "1 huésped",
    guestsWord: "{count} huéspedes",
    infant: "1 bebé",
    infants: "{count} bebés",
    adults: "Adultos",
    children: "Niños",
    infantsLabel: "Bebés",
    adultHint: "13+",
    childHint: "3–12",
    infantHint: "0–2",
    addAdult: "Añadir adulto",
    removeAdult: "Quitar adulto",
    addChild: "Añadir niño",
    removeChild: "Quitar niño",
    addInfant: "Añadir bebé",
    removeInfant: "Quitar bebé",
    floorNote: "Al menos 1 adulto",
    needBoth: "Elijan un destino y fechas para buscar.",
    needWhere: "Elijan un destino para buscar.",
    needWhen: "Elijan entrada y salida para buscar.",
    preview: "La búsqueda es una vista previa en esta página.",
    selected: "{name} seleccionado.",
    checkInSet: "Entrada lista. Elijan la salida.",
    nightSelected: "1 noche seleccionada.",
    nightsSelected: "{count} noches seleccionadas.",
    datesCleared: "Fechas borradas.",
  },
};
