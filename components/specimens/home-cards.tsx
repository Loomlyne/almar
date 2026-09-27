import { CalendarMark, PlaneMark } from "./project-marks";
import styles from "./home-cards.module.css";

type Locale = "en" | "ar" | "es";

const STORIES = {
  en: [
    {
      title: "Discovering Cartagena's Hidden Colonial Courtyards",
      text: "A private guide to the walled city's most intimate spaces — sun-dappled patios, bougainvillea-draped balconies, and the quiet stories they hold.",
      date: "Jun 1, 2025",
      iso: "2025-06-01",
      alt: "Colonial courtyard in Cartagena's walled city with colourful facades and bougainvillea",
      src: "/assets/img/ef78a57ee630532d.webp",
      href: "/blog/discovering-cartagenas-hidden-colonial-courtyards",
    },
    {
      title: "Why Medellín Is Redefining Luxury Travel in Latin America",
      text: "How the City of Eternal Spring evolved from a troubled past into one of South America's most compelling destinations for discerning travellers.",
      date: "May 28, 2025",
      iso: "2025-05-28",
      alt: "Medellín city panorama at dusk with lights illuminating the hillside neighbourhoods",
      src: "/assets/img/21bbbec680a4a9ab.webp",
      href: "/blog/why-medellin-is-redefining-luxury-travel",
    },
    {
      title: "Colombia's Coffee Triangle: A Journey Through Eje Cafetero",
      text: "Coffee estates draped in mist, valleys of wax palms, and the unhurried art of tasting coffee at origin — this is Colombia's most sensory journey.",
      date: "May 24, 2025",
      iso: "2025-05-24",
      alt: "Coffee cherries on a branch in Colombia's Eje Cafetero region",
      src: "/assets/img/2af2299b05a87c37.webp",
      href: "/blog/colombias-coffee-triangle-eje-cafetero",
    },
  ],
  ar: [
    {
      title: "اكتشاف الأفنية الاستعمارية المخفية في كارتاخينا",
      text: "دليل خاص إلى أخصّ أمكنة المدينة المسوّرة: أفنية تملؤها الشمس، وشرفات تلفّها الجهنمية، والحكايات الهادئة التي تحملها.",
      date: "1 يونيو 2025",
      iso: "2025-06-01",
      alt: "فناء استعماري في المدينة المسوّرة في كارتاخينا مع واجهات ملوّنة وجهنمية",
      src: "/assets/img/ef78a57ee630532d.webp",
      href: "/blog/discovering-cartagenas-hidden-colonial-courtyards",
    },
    {
      title: "لماذا تعيد ميديلين تعريف السفر الفاخر في أمريكا اللاتينية",
      text: "كيف صارت مدينة الربيع الأبدي، بعد ماضٍ مضطرب، من أكثر وجهات أمريكا الجنوبية إقناعاً للمسافر الذي يختار بعناية.",
      date: "28 مايو 2025",
      iso: "2025-05-28",
      alt: "بانوراما ميديلين عند الغسق وأضواء أحياء التلال",
      src: "/assets/img/21bbbec680a4a9ab.webp",
      href: "/blog/why-medellin-is-redefining-luxury-travel",
    },
    {
      title: "مثلث القهوة في كولومبيا: رحلة عبر إخي كافيتييرو",
      text: "مزارع قهوة يلفّها الضباب، ووديان نخيل الشمع، وفن تذوّق القهوة على مهل في مصدرها. هذه أكثر رحلات كولومبيا حسيّة.",
      date: "24 مايو 2025",
      iso: "2025-05-24",
      alt: "كرز البن على غصن في منطقة القهوة في كولومبيا",
      src: "/assets/img/2af2299b05a87c37.webp",
      href: "/blog/colombias-coffee-triangle-eje-cafetero",
    },
  ],
  es: [
    {
      title: "Descubrir los patios coloniales ocultos de Cartagena",
      text: "Una guía privada a los espacios más íntimos de la ciudad amurallada: patios con sol, balcones con buganvilla y las historias quietas que guardan.",
      date: "1 jun 2025",
      iso: "2025-06-01",
      alt: "Patio colonial en la ciudad amurallada de Cartagena, con fachadas de color y buganvilla",
      src: "/assets/img/ef78a57ee630532d.webp",
      href: "/blog/discovering-cartagenas-hidden-colonial-courtyards",
    },
    {
      title: "Por qué Medellín está redefiniendo el viaje de lujo en América Latina",
      text: "Cómo la Ciudad de la Eterna Primavera pasó de un pasado difícil a ser uno de los destinos más convincentes de Sudamérica para quien viaja con criterio.",
      date: "28 may 2025",
      iso: "2025-05-28",
      alt: "Panorama de Medellín al anochecer, con luces en los barrios de la ladera",
      src: "/assets/img/21bbbec680a4a9ab.webp",
      href: "/blog/why-medellin-is-redefining-luxury-travel",
    },
    {
      title: "El triángulo cafetero de Colombia: un viaje por el Eje Cafetero",
      text: "Fincas de café entre la niebla, valles de palma de cera y el arte lento de probar el café en origen. Es el viaje más sensorial de Colombia.",
      date: "24 may 2025",
      iso: "2025-05-24",
      alt: "Cerezas de café en una rama del Eje Cafetero de Colombia",
      src: "/assets/img/2af2299b05a87c37.webp",
      href: "/blog/colombias-coffee-triangle-eje-cafetero",
    },
  ],
} as const;

const SERVICE = {
  en: {
    title: "24/7 Private Concierge",
    text: "Your dedicated ALMAR concierge, reservations, logistics, surprises, and last-minute requests handled around the clock across Colombia.",
    alt: "24/7 Private Concierge, ALMAR concierge service in Colombia.",
  },
  ar: {
    title: "كونسيرج خاص على مدار الساعة",
    text: "كونسيرج المار المخصّص لكم: الحجوزات، والتنقّل، والمفاجآت، وطلبات اللحظة الأخيرة، على مدار الساعة في كولومبيا.",
    alt: "كونسيرج خاص على مدار الساعة، خدمة كونسيرج المار في كولومبيا.",
  },
  es: {
    title: "Conserje privado 24/7",
    text: "Su conserje de ALMAR: reservas, logística, sorpresas y pedidos de último momento, a cualquier hora en Colombia.",
    alt: "Conserje privado 24/7, servicio de conserjería de ALMAR en Colombia.",
  },
} as const;

export function StoryCard({
  title,
  text,
  date,
  iso,
  alt,
  src,
  href,
}: {
  title: string;
  text: string;
  date: string;
  iso: string;
  alt: string;
  src: string;
  href: string;
}) {
  return (
    <a className={styles.story} href={href}>
      <img src={src} alt={alt} width={1200} height={750} />
      <h3>{title}</h3>
      <p>{text}</p>
      <time dateTime={iso}>
        <CalendarMark />
        {date}
      </time>
    </a>
  );
}

export function ServiceCard({ locale }: { locale: Locale }) {
  const copy = SERVICE[locale];

  return (
    <a className={styles.service} href="/services/24-7-private-concierge">
      <img src="/assets/img/fad99748eb29b7f8.webp" alt={copy.alt} width={1600} height={1066} />
      <span className={styles.icon}>
        <PlaneMark />
      </span>
      <h3>{copy.title}</h3>
      <p>{copy.text}</p>
    </a>
  );
}

export function HomeCardsSection({ locale }: { locale: Locale }) {
  return (
    <>
      <section className="kit-section" id="project-stories" aria-label="Project stories">
        <header className="kit-head">
          <h2>Project stories</h2>
          <p className="kit-sub">One story card. The home page stories use it.</p>
        </header>
        <div className={styles.grid}>
          {STORIES[locale].map((story) => (
            <StoryCard key={story.href} {...story} />
          ))}
        </div>
      </section>
      <section className="kit-section" id="service-card" aria-label="Service card">
        <header className="kit-head">
          <h2>Service card</h2>
          <p className="kit-sub">The service card from the home page.</p>
        </header>
        <ServiceCard locale={locale} />
      </section>
    </>
  );
}
