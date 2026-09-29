import { C, LOGO, icon, cap, kicker, header } from './lib.mjs';

const B = {
  stay: '/_blob/b419850988981c4fc11054e579355989', walled: '/_blob/2ab2631d6f8ea3584ff064b8c7a7278e', heritage: '/_blob/6b1ec21187c8f2debfe1b6ee485c0590',
  rosario: '/_blob/2299a6d14a809a14dace2a84f593ab30', hero: '/_blob/7d53a3a9f8de9819eabfcc4203ba7d2e', car: '/_blob/79a19165c21252c7b2e6958718861132',
  airport: '/_blob/ead41235be30229e516a6935a1468fda', mono: '/_blob/c93aa758ec96044735f57cf6385526f8',
};
const PHOTOS = [B.walled, B.stay, B.heritage, B.rosario, B.hero, B.car];
const WIDTHS = [[1440, 'd', 'Desktop 1440'], [834, 't', 'Tablet 834'], [390, 'p', 'Phone 390']];
const FLOAT = 'box-shadow:0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1);';
const UP = 'text-transform:{{tt}};letter-spacing:{{ls}};';
const MONOGRAM_FILE = B.mono;

// copy that already exists in lib/copy/home.ts (three languages) is passed in as H
export function makeCtx(k, H) {
  const t3 = (get) => k(get(H.en), get(H.ar), get(H.es));
  const tr = {
    'Your Private Colombia': ['كولومبيا الخاصة بك', 'Tu Colombia privada'], 'Our Story': ['قصتنا', 'Nuestra historia'], 'Our Values': ['قيمنا', 'Nuestros valores'],
    'A small team with a singular focus.': ['فريق صغير بهدف واحد.', 'Un equipo pequeño con un solo enfoque.'], 'Get In Touch': ['تواصل معنا', 'Ponte en contacto'],
    'Plan Your Journey': ['خطط لرحلتك', 'Planifica tu viaje'], 'Travel With Confidence': ['سافر بثقة', 'Viaja con confianza'], 'You’ll be in good hands.': ['ستكون في أيدٍ أمينة.', 'Estarás en buenas manos.'],
    'Colombia’s most extraordinary cities': ['أروع مدن كولومبيا', 'Las ciudades más extraordinarias de Colombia'], 'Your Stay, Personally Selected': ['إقامتك، مختارة بعناية شخصية', 'Tu estancia, elegida personalmente'],
    'About': ['نبذة', 'Acerca de'], 'Amenities': ['المرافق', 'Servicios incluidos'], 'Policies to check': ['سياسات يجب مراجعتها', 'Políticas a revisar'], 'Services': ['الخدمات', 'Servicios'],
    'Experiences': ['التجارب', 'Experiencias'], 'More Private Stays': ['المزيد من الإقامات الخاصة', 'Más estancias privadas'], 'Experience Colombia': ['اكتشف كولومبيا', 'Vive Colombia'],
    'Concierge Services': ['خدمات الكونسيرج', 'Servicios de conserjería'], 'Travel Insights': ['رؤى السفر', 'Guías de viaje'], 'Included in your journey': ['مشمول في رحلتك', 'Incluido en tu viaje'],
    'Cartagena': ['كارتاخينا', 'Cartagena'], 'Medellín': ['ميديين', 'Medellín'], 'Bogotá': ['بوغوتا', 'Bogotá'], 'San Andrés': ['سان أندريس', 'San Andrés'], 'Cocora Valley': ['وادي كوكورا', 'Valle de Cocora'],
    'Cartagena Heritage Tours': ['جولات تراث كارتاخينا', 'Recorridos patrimoniales de Cartagena'], 'Rosario Islands Escape': ['رحلة جزر الروزاريو', 'Escapada a las Islas del Rosario'],
    'Cartagena Walled City Night': ['ليلة في المدينة المسوّرة بكارتاخينا', 'Noche en la ciudad amurallada de Cartagena'],
    '[Short line]': ['[سطر قصير]', '[Línea breve]'], '[Body text]': ['[نص المحتوى]', '[Texto]'], '[Name]': ['[الاسم]', '[Nombre]'], '[Role]': ['[المنصب]', '[Cargo]'],
    '[Date]': ['[التاريخ]', '[Fecha]'], '[Post title]': ['[عنوان المقال]', '[Título de la entrada]'], '[Amenity]': ['[ميزة]', '[Servicio]'], '[Policy]': ['[سياسة]', '[Política]'],
    'Destination': ['الوجهة', 'Destino'], 'Where to?': ['إلى أين؟', '¿A dónde?'], 'Dates': ['التواريخ', 'Fechas'], 'Add dates': ['أضف التواريخ', 'Añade fechas'],
    'Guests': ['الضيوف', 'Huéspedes'], '1 adult': ['بالغ واحد', '1 adulto'], 'Search': ['بحث', 'Buscar'], 'Plan your journey': ['خطط لرحلتك', 'Planifica tu viaje'],
    'Where · When · Who': ['أين · متى · من', 'Dónde · Cuándo · Quién'], 'Menu': ['القائمة', 'Menú'], 'Login': ['دخول', 'Entrar'],
    'Team members appear only when published from Dashboard › Content › Team. With none, the section renders nothing.': ['يظهر أعضاء الفريق فقط عند نشرهم من لوحة التحكم › المحتوى › الفريق. عند عدم وجود أحد لا يُعرض القسم.', 'Los miembros del equipo aparecen solo cuando se publican desde Panel › Contenido › Equipo. Sin miembros, la sección no se muestra.'],
    'Colonial courtyard with arches around a still pool': ['فناء استعماري بأقواس حول بركة ساكنة', 'Patio colonial con arcos alrededor de una piscina tranquila'],
    'Photo': ['صورة', 'Foto'], 'Done': ['تم', 'Listo'], 'Clear dates': ['مسح التواريخ', 'Borrar fechas'], 'Filters': ['التصفية', 'Filtros'], 'Clear filters': ['مسح التصفية', 'Borrar filtros'],
    '6 options · 2 added': ['6 خيارات · تمت إضافة 2', '6 opciones · 2 añadidos'], 'Home stays exactly as built in Framer. These are screenshots of the live page at three widths, in two halves each.': ['تبقى الصفحة الرئيسية كما بُنيت في Framer تمامًا. هذه لقطات للصفحة الحية بثلاثة عروض، كل عرض في نصفين.', 'Inicio se queda exactamente como está en Framer. Son capturas de la página real en tres anchos, cada una en dos mitades.'],
    'Home page, part 1': ['الصفحة الرئيسية، الجزء 1', 'Página de inicio, parte 1'], 'Home page, part 2': ['الصفحة الرئيسية، الجزء 2', 'Página de inicio, parte 2'],
    'Availability is set per stay in Dashboard › Catalog › Stays. The bar checks the dates a guest picks against it. Blocked dates here are examples.': ['يُضبط التوافر لكل إقامة في لوحة التحكم › الفهرس › الإقامات. يتحقق الشريط من التواريخ التي يختارها الضيف. التواريخ المحجوبة هنا أمثلة.', 'La disponibilidad se define por estancia en Panel › Catálogo › Estancias. La barra comprueba las fechas que elige el huésped. Las fechas bloqueadas son ejemplos.'],
    'Experiences and services': ['التجارب والخدمات', 'Experiencias y servicios'], 'Search experiences and services': ['ابحث في التجارب والخدمات', 'Buscar experiencias y servicios'],
    'Type': ['النوع', 'Tipo'], 'All': ['الكل', 'Todo'], 'All destinations': ['كل الوجهات', 'Todos los destinos'], 'All private stays': ['كل الإقامات الخاصة', 'Todas las estancias privadas'],
    'Private stay': ['إقامة خاصة', 'Estancia privada'], '2 added': ['تمت إضافة 2', '2 añadidos'], 'Continue': ['متابعة', 'Continuar'], 'Add': ['أضف', 'Añadir'], 'Added': ['تمت الإضافة', 'Añadido'],
    'Add to cart': ['أضف إلى السلة', 'Añadir al carrito'], 'Cart': ['السلة', 'Carrito'], 'Your cart': ['سلتك', 'Tu carrito'], 'Checkout': ['إتمام الدفع', 'Pagar'], 'Total': ['الإجمالي', 'Total'],
    'Remove': ['إزالة', 'Quitar'], 'Add to booking': ['أضف إلى الحجز', 'Añadir a la reserva'], 'Complete your booking to continue': ['أكمل حجزك للمتابعة', 'Completa tu reserva para continuar'],
    'Choose your stay, dates and guests first. Then pay for the stay and every add-on in one checkout.': ['اختر إقامتك وتواريخك وضيوفك أولاً، ثم ادفع ثمن الإقامة وكل الإضافات في عملية دفع واحدة.', 'Elige primero tu estancia, fechas y huéspedes. Luego paga la estancia y todos los extras en un solo pago.'],
    'Continue to booking': ['تابع إلى الحجز', 'Continuar con la reserva'], 'Signed in, existing booking': ['مسجّل الدخول، حجز قائم', 'Sesión iniciada, reserva existente'], 'Not signed in or no booking yet': ['غير مسجّل أو بلا حجز بعد', 'Sin sesión o sin reserva todavía'],
    'Set by this stay': ['محدد بهذه الإقامة', 'Definido por esta estancia'], 'Stay': ['الإقامة', 'Estancia'], 'Availability': ['التوافر', 'Disponibilidad'], 'Unavailable': ['غير متاح', 'No disponible'],
    'Blocked dates are set for each stay in Dashboard › Catalog › Stays. The dates below are examples.': ['تُحدَّد التواريخ المحجوبة لكل إقامة في لوحة التحكم › الفهرس › الإقامات. التواريخ أدناه أمثلة.', 'Las fechas bloqueadas se definen para cada estancia en Panel › Catálogo › Estancias. Las fechas de abajo son ejemplos.'],
    'Details': ['التفاصيل', 'Detalles'], '[Duration]': ['[المدة]', '[Duración]'], 'Duration': ['المدة', 'Duración'], 'per person': ['للشخص', 'por persona'], 'Close': ['إغلاق', 'Cerrar'], 'Experience': ['تجربة', 'Experiencia'],
    '[n] min read': ['[n] دقائق قراءة', '[n] min de lectura'], 'On this page': ['في هذه الصفحة', 'En esta página'], '[Section title]': ['[عنوان القسم]', '[Título de sección]'], 'Copy link': ['نسخ الرابط', 'Copiar enlace'],
    'Share': ['مشاركة', 'Compartir'], 'Featured stay': ['إقامة مميزة', 'Estancia destacada'], 'Featured experience': ['تجربة مميزة', 'Experiencia destacada'], 'Plan this journey': ['خطط لهذه الرحلة', 'Planifica este viaje'],
    'Related stories': ['قصص ذات صلة', 'Historias relacionadas'], '[Pull quote]': ['[اقتباس]', '[Cita]'], 'Arrive': ['وصول', 'Llegada'], 'Leave': ['مغادرة', 'Salida'],
    'October 2026': ['أكتوبر 2026', 'octubre de 2026'], 'November 2026': ['نوفمبر 2026', 'noviembre de 2026'],
    'Mon': ['إث', 'lun'], 'Tue': ['ث', 'mar'], 'Wed': ['أر', 'mié'], 'Thu': ['خ', 'jue'], 'Fri': ['ج', 'vie'], 'Sat': ['س', 'sáb'], 'Sun': ['أح', 'dom'],
    'Cartagena, Getsemaní Colonial House': ['كارتاخينا، بيت جتسيماني الاستعماري', 'Cartagena, Casa colonial de Getsemaní'], 'From': ['ابتداءً من', 'Desde'], 'Read story': ['اقرأ القصة', 'Leer la historia'], 'Nothing on this page is sent.': ['لا يُرسَل شيء من هذه الصفحة.', 'Nada de esta página se envía.'],
  };
  const T = (en) => { if (!tr[en]) throw new Error('missing translation: ' + en); return k(en, tr[en][0], tr[en][1]); };
  const nav = H.en.nav;
  return { k, T, t3, H, nav };
}

const inset = (cls) => ({ d: 100, t: 32, p: 16 }[cls]);
const contentW = (W, cls) => W - 2 * inset(cls);
const disp = (cls) => (cls === 'p' ? 32 : 48);
const hero = (cls) => (cls === 'p' ? 40 : 64);
const headSz = (cls) => (cls === 'p' ? 24 : 32);
const goldRule = `border-top:2px solid ${C.gold};`;

function logo(w) { return `<img src="${LOGO}" alt="ALMAR Private Journeys" style="width:${w}px;height:auto;display:block">`; }
function ctl(c) { return `<span style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};color:${C.ink};font-size:12px;${UP}"><bdi>${c}</bdi>${icon('chevron-down', 12, 'currentColor')}</span>`; }

function cartBtn(cx) {
  const { T } = cx;
  const n = cx.cartCount || 0;
  return `<span role="img" aria-label="${T('Cart')}" style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.teal}">${icon('cart', 24, C.teal)}${n ? `<span style="position:absolute;top:2px;inset-inline-end:0;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;background:${C.teal};color:${C.ivory};font-size:12px;line-height:20px;text-align:center;font-variant-numeric:tabular-nums">${n}</span>` : ''}</span>`;
}

function acctTrigger(cx, open) {
  const { k } = cx;
  const nm = k('[Guest name]', '[اسم الضيف]', '[Nombre del huésped]');
  return `<span style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 12px 0 16px;box-sizing:border-box;border:1px solid ${open ? C.ink : C.muted};font-size:14px;color:${C.ink}"><span>${nm}</span>${icon(open ? 'chevron-up' : 'chevron-down', 12, 'currentColor')}</span>`;
}

function siteHeader(cx, W, cls) {
  const { T, H, t3 } = cx;
  const link = (txt, active) => `<span style="display:inline-flex;align-items:center;height:44px;font-size:12px;${UP}color:${C.teal};${active ? `border-bottom:2px solid ${C.gold};box-sizing:border-box;` : ''}">${txt}</span>`;
  const links = [t3((h) => h.nav.destinations), t3((h) => h.nav.experiences), t3((h) => h.nav.about), t3((h) => h.nav.contact)];
  const h = cls === 'd' ? 96 : cls === 't' ? 80 : 72;
  const inner = cls === 'd'
    ? `${logo(150)}<nav style="display:flex;align-items:center;gap:32px">${links.map((l, i) => link(l, i === 0)).join('')}</nav><div style="display:flex;align-items:center;gap:16px">${cartBtn(cx)}${ctl('AED')}${ctl('EN')}${cx.signedIn ? acctTrigger(cx, cx.menuOpen) : link(T('Login'))}</div>`
    : `${logo(cls === 'p' ? 112 : 150)}<div style="display:flex;align-items:center;gap:8px">${cartBtn(cx)}<span style="display:inline-flex;align-items:center;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};font-size:14px;color:${C.ink}">${T('Menu')}</span></div>`;
  return { h, html: `<header style="height:${h}px;box-sizing:border-box;padding:0 ${inset(cls)}px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:${C.ivory};border-bottom:1px solid ${C.line}">${inner}</header>` };
}

function heroSection(cx, W, cls, { titleHtml, altEn, photo = B.hero, prefill = null }) {
  const { T, k } = cx;
  const H_STAY = { en: cx.H.en.stays[0].name, ar: cx.H.ar.stays[0].name, es: cx.H.es.stays[0].name };
  const h = cls === 'd' ? 720 : 640;
  const bar = cls === 'p'
    ? `<div style="position:absolute;left:${inset(cls)}px;right:${inset(cls)}px;bottom:32px;height:64px;background:${C.ivory};border-top:2px solid ${C.gold};${FLOAT}display:flex;align-items:center;gap:16px;padding-inline-start:16px;padding-inline-end:8px;box-sizing:border-box">${icon('search', 20, C.teal, true)}<div style="flex:1;display:flex;flex-direction:column;min-width:0"><span style="font-size:16px;line-height:{{lhB}};color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prefill ? T('Cartagena, Getsemaní Colonial House') : T('Plan your journey')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${prefill ? T('Add dates') + ' · ' + T('1 adult') : T('Where · When · Who')}</span></div><span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:${C.teal};color:${C.ivory}">${icon('arrow-right', 20, C.ivory, true)}</span></div>`
    : (() => {
      const seg = (lab, val, grow, filled) => `<div style="flex:${grow};min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 24px"><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${lab}</span><span style="display:flex;align-items:center;gap:8px;font-size:16px;line-height:{{lhB}};color:${filled ? C.ink : C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${filled === 'lock' ? icon('lock', 16, C.muted) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${val}</span></span></div>`;
      const div = `<span style="width:1px;height:36px;background:${C.line};display:block"></span>`;
      return `<div style="position:absolute;left:${inset(cls)}px;right:${inset(cls)}px;bottom:48px;height:72px;background:${C.ivory};border-top:2px solid ${C.gold};${FLOAT}display:flex;align-items:center;box-sizing:border-box">${prefill ? seg(T('Destination'), T('Cartagena'), 1, 'lock') + div + seg(T('Stay'), k(H_STAY.en, H_STAY.ar, H_STAY.es), 1.3, 'lock') : seg(T('Destination'), T('Where to?'), 1.1)}${div}${seg(T('Dates'), T('Add dates'), 1.3)}${div}${seg(T('Guests'), T('1 adult'), 1)}<span style="display:flex;align-items:center;justify-content:center;gap:12px;width:${cls === 'd' ? 200 : 160}px;height:72px;background:${C.teal};color:${C.ivory};font-size:14px;${UP}flex:none">${icon('search', 20, C.ivory, true)}${T('Search')}</span></div>`;
    })();
  const barTop = cls === 'p' ? 96 : 120;
  return { h, html: `<section style="position:relative;height:${h}px;overflow:hidden;background:${C.teal}"><img src="${photo}" alt="${T(altEn)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"><div style="position:absolute;inset:0;background:rgba(38,38,38,0.4)"></div><div style="position:absolute;left:${inset(cls)}px;right:${inset(cls)}px;bottom:${barTop + 24}px;max-width:820px"><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${hero(cls)}px;line-height:{{lh0}};letter-spacing:{{tk}};color:${C.ivory}">${titleHtml}</h1></div>${bar}</section>` };
}

function titleBlock(cx, W, cls, { kick, title, intro, level = 'h2', size }) {
  const sz = size || (cls === 'p' ? 24 : 32);
  const h = (kick ? 40 : 0) + (cls === 'p' ? 260 : 200) + (intro ? 0 : -60);
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden"><div style="${goldRule}padding-top:24px;display:flex;flex-direction:column;gap:12px;max-width:820px">${kick ? kicker(kick) : ''}<${level} style="margin:0;font-family:{{fd}};font-weight:400;font-size:${sz}px;line-height:{{lh2}};color:${C.teal}">${title}</${level}>${intro ? `<p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${intro}</p>` : ''}</div></section>` };
}

function addBtn(cx, on, nameHtml) {
  const { T } = cx;
  return `<button type="button" aria-pressed="${on ? 'true' : 'false'}" aria-label="${T('Add')} · ${nameHtml}" style="flex:none;display:flex;align-items:center;justify-content:center;width:44px;height:44px;box-sizing:border-box;padding:0;background:${on ? C.teal : C.surface};color:${on ? C.ivory : C.teal};border:1px solid ${C.teal};border-radius:0;cursor:pointer">${icon(on ? 'check' : 'plus', 20, 'currentColor')}</button>`;
}

function cards(cx, W, cls, items, { cols, ratio = 0.75, line = true, price = false, add = false, added = [], cw: cwo, bare = false, colsN }) {
  const { T, k } = cx;
  const cw = cwo ?? contentW(W, cls);
  const c = colsN ?? cols[cls];
  const gap = cls === 'd' ? 32 : 24;
  const cardW = (cw - gap * (c - 1)) / c;
  const imgH = Math.round(cardW * ratio);
  const textH = 12 + Math.max(add ? 44 : 0, 26 + (line ? 24 : 0) + (price ? 28 : 0)) + 8;
  const rows = Math.ceil(items.length / c);
  const cardH = imgH + textH;
  const h = bare ? rows * cardH + (rows - 1) * gap : 48 + rows * cardH + (rows - 1) * gap + 8;
  const html = `<section style="${bare ? '' : `height:${h}px;box-sizing:border-box;padding:24px ${inset(cls)}px 0;overflow:hidden`}"><div style="display:grid;grid-template-columns:repeat(${c},minmax(0,1fr));gap:${gap}px">${items.map((it, i) => `<article style="display:flex;flex-direction:column;gap:12px;height:${cardH}px;overflow:hidden"><img src="${PHOTOS[(it.p ?? i) % PHOTOS.length]}" alt="${it.alt}" style="width:100%;height:${imgH}px;object-fit:cover;display:block;outline:1px solid rgba(38,38,38,0.1);outline-offset:-1px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal}">${it.name}</span>${line ? `<span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${it.line}</span>` : ''}${price ? `<span style="font-size:14px;line-height:{{lhL}};color:${C.ink};font-variant-numeric:tabular-nums"><bdi>AED [PRICE]</bdi></span>` : ''}</div>${add ? addBtn(cx, added.includes(i), it.name) : ''}</div></article>`).join('')}</div></section>`;
  return { h, html };
}

function paragraphs(cx, W, cls, { n = 3, title, level = 'h3', texts }) {
  const { T } = cx;
  const lines = texts || Array.from({ length: n }, () => T('[Body text]'));
  const h = 40 + (title ? 56 : 0) + lines.length * (cls === 'p' ? 120 : 84) + 16;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:24px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:16px">${title ? `<${level} style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${title}</${level}>` : ''}${lines.map((x) => `<p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${x}</p>`).join('')}</section>` };
}

function listGrid(cx, W, cls, { title, itemKey, n }) {
  const { T } = cx;
  const c = cls === 'p' ? 1 : 2;
  const rows = Math.ceil(n / c);
  const h = 24 + 56 + rows * 44 + 24;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:24px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:16px"><h3 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${title}</h3><div style="display:grid;grid-template-columns:repeat(${c},minmax(0,1fr));column-gap:32px">${Array.from({ length: n }, () => `<div style="display:flex;align-items:center;gap:12px;height:44px;border-bottom:1px solid ${C.line};font-size:16px;color:${C.ink}">${icon('check', 16, C.teal)}<span>${T(itemKey)}</span></div>`).join('')}</div></section>` };
}

function team(cx, W, cls) {
  const { T, t3 } = cx;
  const cw = contentW(W, cls);
  const c = cls === 'd' ? 3 : cls === 't' ? 2 : 1;
  const gap = 32;
  const cardW = Math.min((cw - gap * (c - 1)) / c, 448);
  const imgH = Math.round(cardW * 1.5);
  const cardH = imgH + 24 + 26 + 8 + 20;
  const h = 40 + 56 + 24 + cardH + 24 + 72;
  const card = `<div style="display:flex;flex-direction:column;gap:24px;width:${cardW}px"><div style="height:${imgH}px;background:${C.tealTint};display:flex;align-items:center;justify-content:center"><img src="${MONOGRAM_FILE}" alt="" style="width:96px;height:auto;display:block"></div><div style="display:flex;flex-direction:column;gap:8px"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal}">${T('[Name]')}</span><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${T('[Role]')}</span></div></div>`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:40px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:24px"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${t3((h) => h.teamTitle)}</h2><div style="display:flex;gap:${gap}px">${Array.from({ length: c }, () => card).join('')}</div><div style="display:flex;align-items:center;min-height:48px;border:1px dashed ${C.muted};padding:8px 16px;box-sizing:border-box;font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('Team members appear only when published from Dashboard › Content › Team. With none, the section renders nothing.')}</div></section>` };
}

function contactForm(cx, W, cls, { title }) {
  const { T, t3 } = cx;
  const fld = (lab, h) => `<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;line-height:{{lhL}};color:${C.ink}">${lab}</span><span style="display:block;height:${h}px;box-sizing:border-box;background:${C.surface};border:1px solid ${C.ink}"></span></div>`;
  const h = cls === 'd' ? 560 : 600;
  const form = `<div style="display:flex;flex-direction:column;gap:16px;flex:1;min-width:0">${fld(t3((x) => x.name), 44)}${fld(t3((x) => x.email), 44)}${fld(t3((x) => x.message), 120)}<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><span style="display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 24px;background:${C.teal};color:${C.ivory};font-size:14px;${UP}">${t3((x) => x.send)}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('Nothing on this page is sent.')}</span></div></div>`;
  const copy = `<div style="display:flex;flex-direction:column;gap:12px;flex:1;min-width:0"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${title}</h2><p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${t3((x) => x.contactIntro)}</p></div>`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden"><div style="${goldRule}padding-top:24px;display:flex;flex-direction:${cls === 'd' ? 'row' : 'column'};gap:${cls === 'd' ? 64 : 24}px">${copy}${form}</div></section>` };
}

function footer(cx, W, cls) {
  const { t3, H } = cx;
  const c = cls === 'd' ? 4 : cls === 't' ? 2 : 1;
  const h = cls === 'd' ? 320 : cls === 't' ? 480 : 800;
  const link = (txt) => `<span style="display:flex;align-items:center;min-height:44px;font-size:12px;${UP}color:${C.teal}">${txt}</span>`;
  const colHead = (txt) => `<span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${txt}</span>`;
  const fld = `<span style="display:flex;align-items:center;flex:1;height:44px;padding:0 16px;box-sizing:border-box;background:${C.surface};border:1px solid ${C.ink};font-size:14px;color:${C.muted}">${t3((x) => x.email)}</span>`;
  return { h, html: `<footer style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden;background:${C.ivory};border-top:1px solid ${C.line}"><div style="display:grid;grid-template-columns:repeat(${c},minmax(0,1fr));gap:32px">
<div style="display:flex;flex-direction:column;gap:16px">${logo(150)}<span style="display:flex;align-items:center;min-height:44px;font-size:14px;color:${C.teal}">Instagram</span></div>
<div style="display:flex;flex-direction:column;gap:4px">${colHead(t3((x) => x.pages))}${link(t3((x) => x.nav.destinations))}${link(t3((x) => x.nav.experiences))}${link(t3((x) => x.nav.about))}${link(t3((x) => x.nav.contact))}</div>
<div style="display:flex;flex-direction:column;gap:8px"><span style="display:flex;align-items:center;min-height:44px;font-size:14px;color:${C.teal}">${t3((x) => x.listTitle)}</span><bdi style="font-size:14px;color:${C.ink}">inquiries@almarprivatejourney.com</bdi><bdi style="font-size:14px;color:${C.ink}">+971 56 388 3302</bdi></div>
<div style="display:flex;flex-direction:column;gap:8px">${colHead(t3((x) => x.newsletter))}<div style="display:flex;gap:8px">${fld}<span style="display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.teal};color:${C.teal};font-size:12px;${UP}">${t3((x) => x.subscribe)}</span></div></div></div></footer>` };
}

function splitBlock(cx, W, cls, { title, photo }) {
  const { T } = cx;
  const cw = contentW(W, cls);
  const imgW = cls === 'd' ? 600 : cw;
  const imgH = Math.round(imgW * 0.75);
  const h = cls === 'd' ? imgH + 96 : imgH + 24 + 300;
  const text = `<div style="display:flex;flex-direction:column;gap:16px;flex:1;min-width:0"><h3 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${title}</h3><p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${T('[Body text]')}</p><p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${T('[Body text]')}</p></div>`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:${cls === 'd' ? 'row' : 'column'};gap:${cls === 'd' ? 64 : 24}px"><img src="${photo}" alt="${T('Photo')}" style="width:${imgW}px;height:${imgH}px;object-fit:cover;display:block;flex:none;outline:1px solid rgba(38,38,38,0.1);outline-offset:-1px">${text}</section>` };
}

function blogHero(cx, W, cls, { photo }) {
  const { T } = cx;
  const cw = contentW(W, cls);
  const imgH = Math.round(cw * 0.5);
  const h = 48 + 26 + 12 + (cls === 'p' ? 96 : 76) + 24 + imgH + 16;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:12px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${T('[Date]')}</span><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${hero(cls)}px;line-height:{{lh0}};letter-spacing:{{tk}};color:${C.teal}">${T('[Post title]')}</h1><img src="${photo}" alt="${T('Photo')}" style="width:100%;height:${imgH}px;object-fit:cover;display:block;margin-top:12px"></section>` };
}

function renderFrame(cx, W, cls, label, sections, noHeader) {
  const parts = [...(noHeader ? [] : [siteHeader(cx, W, cls)]), ...sections.map((fn) => fn(cx, W, cls)), footer(cx, W, cls)];
  const h = parts.reduce((s, p) => s + p.h, 0) + 1;
  return { h, html: `<div style="display:flex;flex-direction:column;gap:12px;flex:none"><span style="font-size:12px;line-height:1.5;color:${C.muted}"><bdi>${label}</bdi></span><div style="width:${W}px;height:${h}px;box-sizing:border-box;background:${C.ivory};border:1px solid ${C.line};overflow:hidden;display:flex;flex-direction:column">${parts.map((p) => p.html).join('')}</div></div>` };
}

// ---- new sections (owner decisions D-62..D-68) ----
const fieldBox = (inner, extra = '') => `<span style="display:flex;align-items:center;gap:8px;height:44px;box-sizing:border-box;padding:0 16px;background:${C.surface};border:1px solid ${C.ink};font-size:14px;color:${C.muted};${extra}">${inner}</span>`;
const dropTrig = (txt, extra = '') => `<span style="display:inline-flex;align-items:center;justify-content:space-between;gap:8px;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};font-size:14px;color:${C.ink};${extra}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${txt}</span>${icon('chevron-down', 12, 'currentColor')}</span>`;
const chipBtn = (t, on, first) => `<span style="display:inline-flex;align-items:center;height:40px;padding:0 16px;box-sizing:border-box;margin-inline-start:${first ? 0 : -1}px;background:${on ? C.teal : 'transparent'};color:${on ? C.ivory : C.ink};border:1px solid ${on ? C.teal : C.muted};font-size:14px">${t}</span>`;
const primaryBtn = (t, extra = '') => `<span style="display:inline-flex;align-items:center;justify-content:center;gap:12px;height:44px;padding:0 24px;box-sizing:border-box;background:${C.teal};color:${C.ivory};font-size:14px;${UP}${extra}">${t}</span>`;

function filterBar(cx, W, cls) {
  const { T } = cx;
  const h = cls === 'p' ? 300 : 200;
  const search = fieldBox(icon('search', 20, C.teal, true) + `<span>${T('Search experiences and services')}</span>`, 'flex:1;min-width:0;border-color:' + C.ink);
  const chips = `<div role="group" aria-label="${T('Type')}" style="display:flex">${chipBtn(T('All'), true, true)}${chipBtn(T('Experiences'), false)}${chipBtn(T('Services'), false)}</div>`;
  const drops = `${dropTrig(T('All destinations'), cls === 'p' ? 'width:100%' : 'width:260px')}${dropTrig(T('All private stays'), cls === 'p' ? 'width:100%' : 'width:260px')}`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:24px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:16px"><div style="display:flex">${search}</div><div style="display:flex;flex-direction:${cls === 'p' ? 'column' : 'row'};align-items:${cls === 'p' ? 'stretch' : 'center'};gap:16px;flex-wrap:wrap">${chips}${drops}</div></section>` };
}

function cartBar(cx, W, cls) {
  const { T } = cx;
  const h = 96;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:16px ${inset(cls)}px 0;overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px;box-sizing:border-box;padding:0 16px;background:${C.ivory};border-top:2px solid ${C.gold};border-bottom:1px solid ${C.line};border-inline:1px solid ${C.line}"><div style="display:flex;flex-direction:column"><span style="font-size:16px;line-height:{{lhB}};color:${C.ink}">${T('2 added')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted};font-variant-numeric:tabular-nums"><bdi>AED [AMOUNT]</bdi></span></div>${primaryBtn(T('Continue'), 'height:56px;')}</div></section>` };
}

function calendarMonth(cx, name, offset, days, blocked, sel) {
  const { T } = cx;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    let st = `background:${C.surface};color:${C.ink};`; let extra = '';
    if (blocked.includes(d)) { st = `background:${C.surface};color:${C.muted};text-decoration:line-through;`; extra = ' aria-disabled="true"'; }
    else if (sel && (d === sel[0] || d === sel[1])) st = `background:${C.teal};color:${C.ivory};font-weight:700;`;
    else if (sel && d > sel[0] && d < sel[1]) st = `background:${C.tealTint};color:${C.ink};`;
    cells.push(`<span${extra} style="display:flex;align-items:center;justify-content:center;height:44px;box-sizing:border-box;font-size:14px;font-variant-numeric:tabular-nums;${st}">${d}</span>`);
  }
  return `<div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:0"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal}">${T(name)}</span><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px"><!-- weekdays -->${wd.map((w) => `<span style="text-align:center;font-size:12px;line-height:{{lhC}};color:${C.muted}">${T(w)}</span>`).join('')}${cells.join('')}</div></div>`;
}

function stayCalendar(cx, W, cls) {
  const { T } = cx;
  const two = cls === 'd';
  const h = 48 + 96 + 6 * 48 + 24 + 88 + (two ? 0 : 0) + 24;
  const oct = calendarMonth(cx, 'October 2026', 3, 31, [1, 2, 3, 4, 19, 20, 21, 22, 26], [12, 17]);
  const nov = calendarMonth(cx, 'November 2026', 6, 30, [1, 2, 8, 9, 10], null);
  const legend = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;font-size:14px;color:${C.ink}"><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:20px;height:20px;background:${C.teal};display:block"></span>${T('Arrive')} / ${T('Leave')}</span><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:20px;height:20px;background:${C.tealTint};display:block"></span>${T('Dates')}</span><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:20px;height:20px;box-sizing:border-box;border:1px solid ${C.line};display:block;color:${C.muted};font-size:12px;line-height:18px;text-align:center;text-decoration:line-through">4</span>${T('Unavailable')}</span></div>`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:16px"><div style="${goldRule}padding-top:24px;display:flex;flex-direction:column;gap:8px"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${T('Availability')}</h2></div><div style="display:flex;gap:48px;background:${C.surface};padding:24px;box-sizing:border-box">${oct}${two ? nov : ''}</div>${legend}<span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('Blocked dates are set for each stay in Dashboard › Catalog › Stays. The dates below are examples.')}</span></section>` };
}

function stayDock(cx, W, cls) {
  const { T } = cx;
  const h = 88;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:0 ${inset(cls)}px;display:flex;align-items:center;gap:16px;background:${C.ivory};border-top:1px solid ${C.line}"><div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;line-height:{{lhL}};color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${T('Cartagena, Getsemaní Colonial House')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">12/10/2026 – 17/10/2026 · ${T('1 adult')}</span></div>${primaryBtn(T('Continue'), 'height:56px;')}</section>` };
}

function blogBody(cx, W, cls) {
  const { T, k, H } = cx;
  const cw = contentW(W, cls);
  const bodyW = cls === 'd' ? cw - 240 - 64 : cw;
  const toc = `<aside aria-label="${T('On this page')}" style="width:${cls === 'd' ? 240 : cw}px;flex:none;display:flex;flex-direction:column;gap:4px;align-self:flex-start"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${T('On this page')}</span>${[1, 2, 3, 4].map(() => `<span style="display:flex;align-items:center;min-height:44px;font-size:14px;color:${C.teal};border-bottom:1px solid ${C.line}">${T('[Section title]')}</span>`).join('')}</aside>`;
  const para = `<p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${T('[Body text]')}</p>`;
  const quote = `<blockquote style="margin:0;padding:24px;background:${C.tealTint}"><span style="font-family:{{fd}};font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${T('[Pull quote]')}</span></blockquote>`;
  const mini = (label, name, photo, add) => `<article style="display:flex;align-items:center;gap:16px;background:${C.surface};padding:12px;border:1px solid ${C.line}"><img src="${photo}" alt="${name}" style="width:96px;height:72px;object-fit:cover;display:block;flex:none"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${label}</span><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal}">${name}</span></div>${add ? addBtn(cx, false, name) : primaryBtn(T('Continue'), 'padding:0 16px;')}</article>`;
  const stay = mini(T('Featured stay'), k(H.en.stays[0].name, H.ar.stays[0].name, H.es.stays[0].name), B.stay, false);
  const exp = mini(T('Featured experience'), T('Cartagena Heritage Tours'), B.heritage, true);
  const share = `<div style="display:flex;align-items:center;gap:16px"><span style="font-size:14px;color:${C.ink}">${T('Share')}</span><span style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.teal};color:${C.teal};font-size:12px;${UP}">${icon('mail', 16, C.teal)}${T('Copy link')}</span></div>`;
  const plan = `<div style="display:flex;flex-direction:${cls === 'd' ? 'row' : 'column'};align-items:${cls === 'd' ? 'center' : 'stretch'};gap:16px;background:${C.ivory};border-top:2px solid ${C.gold};box-shadow:0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1);padding:16px 24px;box-sizing:border-box"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal};flex:1">${T('Plan this journey')}</span><span style="display:flex;align-items:center;gap:8px;font-size:16px;color:${C.ink}">${icon('lock', 16, C.muted)}${T('Cartagena')}</span>${primaryBtn(T('Search'), 'height:56px;')}</div>`;
  const article = `<article style="width:${bodyW}px;flex:none;display:flex;flex-direction:column;gap:24px">${para}${para}${quote}${para}${stay}${para}${exp}${share}${plan}</article>`;
  const h = cls === 'd' ? 1260 : 1660;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:24px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:${cls === 'd' ? 'row' : 'column'};gap:${cls === 'd' ? 64 : 24}px">${toc}${article}</section>` };
}

function blogHero2(cx, W, cls, { photo }) {
  const { T } = cx;
  const cw = contentW(W, cls);
  const imgH = Math.round(cw * 0.45);
  const h = 48 + 24 + 12 + (cls === 'p' ? 96 : 76) + 12 + 44 + 24 + imgH + 16;
  const tag = `<span style="display:inline-flex;align-items:center;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};font-size:14px;color:${C.teal}">${T('Cartagena')}</span>`;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:48px ${inset(cls)}px 0;overflow:hidden;display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${T('[Date]')}</span><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}"><bdi>${T('[n] min read')}</bdi></span></div><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${hero(cls)}px;line-height:{{lh0}};letter-spacing:{{tk}};color:${C.teal}">${T('[Post title]')}</h1>${tag}<img src="${photo}" alt="${T('Photo')}" style="width:100%;height:${imgH}px;object-fit:cover;display:block;margin-top:12px"></section>` };
}

// overlay board: experience or service detail, opened from a card
function overlayFrames(cx) {
  const { T, k, H } = cx;
  const row = (l, v) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;border-bottom:1px solid ${C.line};font-size:14px"><span style="color:${C.muted}">${l}</span><span style="color:${C.ink}"><bdi>${v}</bdi></span></div>`;
  const closeX = `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.teal}">${icon('x', 20, C.teal)}</span>`;
  const info = (padX) => `<div style="padding:24px ${padX}px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${T('Experience')} · ${T('Cartagena')}</span><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:32px;line-height:{{lh2}};color:${C.teal}">${T('Cartagena Heritage Tours')}</h2></div><p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink}">${T('[Body text]')}</p>${row(T('Duration'), T('[Duration]'))}${row(T('Details'), T('[Body text]'))}${row(T('per person'), 'AED [PRICE]')}</div>`;
  const bar = (padX) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;height:88px;box-sizing:border-box;padding:0 ${padX}px;background:${C.ivory};border-top:1px solid ${C.line}"><div style="display:flex;flex-direction:column"><span style="font-size:16px;line-height:{{lhB}};color:${C.ink};font-variant-numeric:tabular-nums"><bdi>AED [PRICE]</bdi></span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('per person')}</span></div>${primaryBtn(T('Add to cart'), 'height:56px;')}</div>`;
  const dim = 'background:rgba(38,38,38,0.4)';
  const desk = `<div style="display:flex;flex-direction:column;gap:12px;flex:none"><span style="font-size:12px;color:${C.muted}"><bdi>Desktop 1440 · overlay</bdi></span><div style="width:1440px;height:900px;box-sizing:border-box;${dim};display:flex;align-items:center;justify-content:center;border:1px solid ${C.line}"><div role="dialog" aria-label="${T('Cartagena Heritage Tours')}" style="width:760px;height:780px;background:${C.surface};display:flex;flex-direction:column;box-shadow:0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12);overflow:hidden"><div style="position:relative;height:280px;flex:none"><img src="${B.heritage}" alt="${T('Cartagena Heritage Tours')}" style="width:100%;height:100%;object-fit:cover;display:block"><span style="position:absolute;top:8px;inset-inline-end:8px;background:${C.surface}">${closeX}</span></div><div style="flex:1;overflow:hidden">${info(32)}</div>${bar(32)}</div></div></div>`;
  const phone = `<div style="display:flex;flex-direction:column;gap:12px;flex:none"><span style="font-size:12px;color:${C.muted}"><bdi>Phone 390 · full screen</bdi></span><div role="dialog" aria-label="${T('Cartagena Heritage Tours')}" style="width:390px;height:844px;box-sizing:border-box;background:${C.surface};display:flex;flex-direction:column;overflow:hidden;border:1px solid ${C.line}"><div style="position:relative;height:220px;flex:none"><img src="${B.heritage}" alt="${T('Cartagena Heritage Tours')}" style="width:100%;height:100%;object-fit:cover;display:block"><span style="position:absolute;top:8px;inset-inline-end:8px;background:${C.surface}">${closeX}</span></div><div style="flex:1;overflow:hidden">${info(16)}</div>${bar(16)}</div></div>`;
  return { framesHtml: `<div style="display:flex;align-items:flex-start;gap:80px">${desk}${phone}</div>`, maxH: 930 };
}

// cart board: header cart states and drawer
function cartFrames(cx) {
  const { T, k, H } = cx;
  const closeX = `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.teal}">${icon('x', 20, C.teal)}</span>`;
  const line = (name, amt) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;border-bottom:1px solid ${C.line};font-size:14px"><span style="flex:1;min-width:0;color:${C.ink}">${name}</span><span style="color:${C.ink};font-variant-numeric:tabular-nums"><bdi>${amt}</bdi></span><span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.muted}">${icon('x', 20, 'currentColor')}</span></div>`;
  const lines = line(T('Cartagena Heritage Tours'), 'AED [AMOUNT]') + line(T('Rosario Islands Escape'), 'AED [AMOUNT]');
  const total = `<div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid ${C.ink};font-size:20px;line-height:{{lhT}}"><span>${T('Total')}</span><span style="font-weight:700;font-variant-numeric:tabular-nums"><bdi>AED [AMOUNT]</bdi></span></div>`;
  const drawer = (title, bodyHtml, cta, w, h) => `<div role="dialog" aria-label="${T('Your cart')}" style="width:${w}px;height:${h}px;box-sizing:border-box;background:${C.surface};display:flex;flex-direction:column;border:1px solid ${C.line};box-shadow:0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;height:60px;padding:0 8px 0 24px;border-bottom:1px solid ${C.line};flex:none"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:20px;line-height:{{lhT}};color:${C.teal}">${T('Your cart')}</h2>${closeX}</div><div style="flex:1;padding:16px 24px;display:flex;flex-direction:column;gap:16px;overflow:hidden">${bodyHtml}</div><div style="padding:16px 24px;border-top:1px solid ${C.line};display:flex;flex-direction:column;gap:12px;flex:none">${total}${cta}</div></div>`;
  const cta = (t) => primaryBtn(t, 'height:56px;width:100%;box-sizing:border-box;');
  const booking = `<div style="display:flex;flex-direction:column;gap:4px;background:${C.tealTint};padding:12px 16px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.teal}">${T('Add to booking')}</span><span style="font-size:14px;line-height:{{lhL}};color:${C.teal}"><bdi>ALMAR-000000</bdi> · ${T('Cartagena, Getsemaní Colonial House')}</span><span style="font-size:14px;line-height:{{lhL}};color:${C.teal}"><bdi>12/10/2026 – 17/10/2026</bdi></span></div>`;
  const steps = `<div style="display:flex;flex-direction:column;gap:8px;border:1px solid ${C.line};padding:16px"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${C.teal}">${T('Complete your booking to continue')}</span><span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${T('Choose your stay, dates and guests first. Then pay for the stay and every add-on in one checkout.')}</span></div>`;
  const hdr = (n) => `<div style="display:flex;align-items:center;gap:24px;height:96px;padding:0 32px;box-sizing:border-box;background:${C.ivory};border-bottom:1px solid ${C.line};width:520px"><span style="flex:1;font-size:14px;color:${C.muted}">${n ? T('Cart') + ' · ' + n : T('Cart')}</span>${cartBtn({ ...cx, cartCount: n })}</div>`;
  const cap2 = (t) => `<span style="font-size:12px;line-height:1.5;color:${C.muted}">${t}</span>`;
  const col_ = (c, inner) => `<div style="display:flex;flex-direction:column;gap:12px;flex:none">${cap2(c)}${inner}</div>`;
  const headers = col_(T('Cart'), `<div style="display:flex;flex-direction:column;gap:16px">${hdr(0)}${hdr(2)}</div>`);
  const d1 = col_(T('Signed in, existing booking'), drawer('', booking + lines, cta(T('Checkout')), 440, 720));
  const d2 = col_(T('Not signed in or no booking yet'), drawer('', steps + lines, cta(T('Continue to booking')), 440, 720));
  const ph = col_('Phone 390 · full screen', drawer('', steps + lines, cta(T('Continue to booking')), 390, 844));
  return { framesHtml: `<div style="display:flex;align-items:flex-start;gap:80px">${headers}${d1}${d2}${ph}</div>`, maxH: 900 };
}


// ---- owner comment fixes (2026-09-29) ----
const SHOTS = {
  d: [['/_blob/ddbb8d18d8273bd6e015c47307b71bb0', 6517], ['/_blob/671081a36203b3169555842f0ea1ae57', 6516]],
  t: [['/_blob/d815b3cc4fbc2f175b0bea8faa84c21a', 5806], ['/_blob/e7e24f9b440532d14aa5dc617b080715', 5805]],
  p: [['/_blob/72398d5407da6111178ee96d0ef2586d', 7108], ['/_blob/2430aae8c01bc2c7af97ffb5d5388420', 7107]],
};
function homeFrames(cx) {
  const { T } = cx;
  const frame = (label, W, src, h, alt) => `<div style="display:flex;flex-direction:column;gap:12px;flex:none"><span style="font-size:12px;line-height:1.5;color:${C.muted}"><bdi>${label}</bdi></span><img src="${src}" alt="${alt}" style="width:${W}px;height:${h}px;display:block;border:1px solid ${C.line};box-sizing:border-box"></div>`;
  const parts = [];
  for (const [W, cls, label] of WIDTHS) SHOTS[cls].forEach(([src, h], i) => parts.push(frame(`${label} · ${i + 1}/2`, W, src, h, T(i === 0 ? 'Home page, part 1' : 'Home page, part 2'))));
  return { framesHtml: `<div style="display:flex;align-items:flex-start;gap:80px">${parts.join('')}</div>`, maxH: 7108 };
}

function stayDatePanel(cx, w, two) {
  const { T } = cx;
  const oct = calendarMonth(cx, 'October 2026', 3, 31, [1, 2, 3, 4, 19, 20, 21, 22, 26], [12, 17]);
  const nov = calendarMonth(cx, 'November 2026', 6, 30, [1, 2, 8, 9, 10], null);
  const legend = `<span style="display:inline-flex;align-items:center;gap:8px;font-size:14px;color:${C.ink}"><span style="width:20px;height:20px;box-sizing:border-box;border:1px solid ${C.line};display:block;color:${C.muted};font-size:12px;line-height:18px;text-align:center;text-decoration:line-through">4</span>${T('Unavailable')}</span>`;
  return `<div style="width:${w}px;box-sizing:border-box;background:${C.surface};box-shadow:0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12);padding:24px 32px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;gap:48px">${oct}${two ? nov : ''}</div><div style="display:flex;align-items:center;gap:24px;padding-top:16px;border-top:1px solid ${C.line}">${legend}<span style="flex:1;font-size:14px;line-height:{{lhL}};color:${C.ink}">${T('Arrive')} <bdi>12/10/2026</bdi> · ${T('Leave')} <bdi>17/10/2026</bdi></span><span style="display:inline-flex;align-items:center;height:44px;padding:0 8px;font-size:14px;color:${C.teal}">${T('Clear dates')}</span>${primaryBtn(T('Done'))}</div><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('Availability is set per stay in Dashboard › Catalog › Stays. The bar checks the dates a guest picks against it. Blocked dates here are examples.')}</span></div>`;
}

function stayHero(cx, W, cls) {
  const { T, k, H } = cx;
  const stayName = k(H.en.stays[0].name, H.ar.stays[0].name, H.es.stays[0].name);
  const h = cls === 'p' ? 960 : 900;
  const i = inset(cls);
  const title = `<h1 style="position:absolute;left:${i}px;right:${i}px;top:56px;margin:0;font-family:{{fd}};font-weight:400;font-size:${hero(cls)}px;line-height:{{lh0}};letter-spacing:{{tk}};color:${C.ivory}">${stayName}</h1>`;
  let barHtml; let panelTop;
  if (cls === 'p') {
    barHtml = `<div style="position:absolute;left:${i}px;right:${i}px;top:150px;height:64px;background:${C.ivory};border-top:2px solid ${C.gold};box-shadow:0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1);display:flex;align-items:center;gap:16px;padding-inline-start:16px;padding-inline-end:8px;box-sizing:border-box">${icon('search', 20, C.teal, true)}<div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:16px;line-height:{{lhB}};color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${T('Cartagena, Getsemaní Colonial House')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${T('Add dates')} · ${T('1 adult')}</span></div><span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:${C.teal};color:${C.ivory}">${icon('arrow-right', 20, C.ivory, true)}</span></div>`;
    panelTop = 230;
  } else {
    const seg = (lab, val, grow, st) => `<div style="flex:${grow};min-width:0;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 24px;background:${st === 'open' ? C.surface : 'transparent'};${st === 'open' ? `box-shadow:inset 0 -3px 0 ${C.teal};` : ''}"><span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${lab}</span><span style="display:flex;align-items:center;gap:8px;font-size:16px;line-height:{{lhB}};color:${st === 'lock' ? C.ink : C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st === 'lock' ? icon('lock', 16, C.muted) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${val}</span></span></div>`;
    const div = `<span style="width:1px;height:36px;background:${C.line};display:block;flex:none"></span>`;
    barHtml = `<div style="position:absolute;left:${i}px;right:${i}px;top:160px;height:72px;background:${C.ivory};border-top:2px solid ${C.gold};box-shadow:0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1);display:flex;align-items:center;box-sizing:border-box">${seg(T('Destination'), T('Cartagena'), 1, 'lock')}${div}${seg(T('Stay'), stayName, 1.3, 'lock')}${div}${seg(T('Dates'), T('Add dates'), 1.3, 'open')}${div}${seg(T('Guests'), T('1 adult'), 1)}<span style="display:flex;align-items:center;justify-content:center;gap:12px;width:${cls === 'd' ? 200 : 160}px;height:72px;background:${C.teal};color:${C.ivory};font-size:14px;${UP}flex:none">${icon('search', 20, C.ivory, true)}${T('Search')}</span></div>`;
    panelTop = 248;
  }
  const cw = contentW(W, cls);
  const pw = cls === 'd' ? 760 : cw;
  const barArea = cw - 200 - 3; const sw4 = (g) => (barArea * g) / 4.6;
  const datesC = sw4(1) + 1 + sw4(1.3) + 1 + sw4(1.3) / 2;
  const px = cls === 'd' ? i + datesC - pw / 2 : i;
  const panel = `<div style="position:absolute;top:${panelTop}px;left:${px}px">${stayDatePanel(cx, pw, cls === 'd')}</div>`;
  return { h, html: `<section style="position:relative;height:${h}px;overflow:hidden;background:${C.teal}"><img src="${B.stay}" alt="${stayName}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"><div style="position:absolute;inset:0;background:rgba(38,38,38,0.4)"></div>${title}${barHtml}${panel}</section>` };
}

function expCatalog(cx, W, cls) {
  const { T, k, H } = cx;
  const expNames = ['Cartagena Walled City Night', 'Cartagena Heritage Tours', 'Rosario Islands Escape'];
  const expI = () => expNames.map((n, i) => ({ p: i, alt: T(n), name: T(n), line: T('[Short line]') }));
  const svcI = () => H.en.services.map((s, i) => ({ p: [5, 4, 5][i], alt: k(s.name, H.ar.services[i].name, H.es.services[i].name), name: k(s.name, H.ar.services[i].name, H.es.services[i].name), line: T('[Short line]') }));
  const i0 = inset(cls);
  const cw = contentW(W, cls);
  const asideW = 280, gapCol = 48;
  const resW = cls === 'd' ? cw - asideW - gapCol : cw;
  const colsN = cls === 'd' ? 3 : cls === 't' ? 2 : 1;
  const grp = (title, items, added) => {
    const g = cards(cx, W, cls, items(), { cols: {}, colsN, cw: resW, bare: true, price: true, add: true, added });
    const gh = 56 + g.h;
    return { h: gh, html: `<div style="height:${gh}px;overflow:hidden;display:flex;flex-direction:column;gap:24px"><div style="display:flex;align-items:baseline;gap:12px;height:32px"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:${cls === 'p' ? 24 : 32}px;line-height:{{lh2}};color:${C.teal}">${title}</h2><span style="font-size:14px;color:${C.muted}"><bdi>3</bdi></span></div>${g.html}</div>` };
  };
  const g1 = grp(T('Experiences'), expI, [1]);
  const g2 = grp(T('Services'), svcI, [1]);
  const chip = (t, x) => `<span style="display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 16px;box-sizing:border-box;background:${C.tealTint};color:${C.teal};font-size:14px">${t}${icon('x', 16, C.teal)}</span>`;
  const resHead = `<div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap"><span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${T('6 options · 2 added')}</span>${chip(T('Cartagena'))}${chip(k(H.en.stays[0].name, H.ar.stays[0].name, H.es.stays[0].name))}</div></div>`;
  const results = `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:32px">${resHead}${g1.html}${g2.html}</div>`;
  const resH = 40 + 32 + g1.h + 32 + g2.h;
  const box = (on) => `<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;box-sizing:border-box;background:${on ? C.teal : C.surface};border:1px solid ${on ? C.teal : C.ink};flex:none">${on ? icon('check', 16, C.ivory) : ''}</span>`;
  const optRow = (t, on) => `<div style="display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;line-height:{{lhL}};color:${C.ink}">${box(on)}<span>${t}</span></div>`;
  const typeBtn = (t, on) => `<span style="display:flex;align-items:center;min-height:44px;padding:0 16px;box-sizing:border-box;background:${on ? C.teal : C.surface};color:${on ? C.ivory : C.ink};border:1px solid ${on ? C.teal : C.muted};font-size:14px">${t}</span>`;
  const fg = (title, inner) => `<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${title}</span>${inner}</div>`;
  const stays = H.en.stays.map((st, i) => k(st.name, H.ar.stays[i].name, H.es.stays[i].name));
  const filters = `<div style="display:flex;flex-direction:column;gap:24px">${fieldBox(icon('search', 20, C.teal, true) + `<span>${T('Search experiences and services')}</span>`, 'width:100%;box-sizing:border-box')}${fg(T('Type'), `<div role="group" aria-label="${T('Type')}" style="display:flex;flex-direction:column;gap:8px">${typeBtn(T('All'), true)}${typeBtn(T('Experiences'), false)}${typeBtn(T('Services'), false)}</div>`)}${fg(T('Destination'), ['Cartagena', 'Medellín', 'Bogotá', 'San Andrés', 'Cocora Valley'].map((n) => optRow(T(n), n === 'Cartagena')).join(''))}${fg(T('Private stay'), stays.map((n, i) => optRow(n, i === 0)).join(''))}<span style="display:inline-flex;align-items:center;min-height:44px;font-size:14px;color:${C.teal}">${T('Clear filters')}</span></div>`;
  const filtersH = 44 + 24 + (12 + 8 + 3 * 44 + 8 * 2) + 24 + (12 + 8 + 5 * 44) + 24 + (12 + 8 + 3 * 44) + 24 + 44;
  if (cls === 'd') {
    const h = Math.max(resH, filtersH) + 32 + 48;
    return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:32px ${i0}px 0;overflow:hidden;display:flex;gap:${gapCol}px;align-items:flex-start"><aside aria-label="${T('Filters')}" style="width:${asideW}px;flex:none">${filters}</aside>${results}</section>` };
  }
  const toolbar = `<div style="display:flex;flex-direction:column;gap:12px">${fieldBox(icon('search', 20, C.teal, true) + `<span>${T('Search experiences and services')}</span>`, 'width:100%;box-sizing:border-box')}<div style="display:flex;align-items:center;gap:12px"><span style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.teal};color:${C.teal};font-size:14px">${T('Filters')}<span style="min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;background:${C.teal};color:${C.ivory};font-size:12px;line-height:20px;text-align:center">2</span></span><div role="group" aria-label="${T('Type')}" style="display:flex">${chipBtn(T('All'), true, true)}${chipBtn(T('Experiences'), false)}${chipBtn(T('Services'), false)}</div></div></div>`;
  const h = 32 + 100 + 32 + resH + 48;
  return { h, html: `<section style="height:${h}px;box-sizing:border-box;padding:32px ${i0}px 0;overflow:hidden;display:flex;flex-direction:column;gap:32px">${toolbar}${results}</section>` };
}

// ---- page definitions ----
export const PAGES = [
  { stem: 'PublicHome', route: '/', label: '5a · Home', title: 'Public · Home', en: 'Home' },
  { stem: 'PublicAbout', route: '/about', label: '5b · About', title: 'Public · About', en: 'About' },
  { stem: 'PublicContact', route: '/contact', label: '5c · Contact', title: 'Public · Contact', en: 'Contact' },
  { stem: 'PublicDestinations', route: '/destinations', label: '5d · Destinations', title: 'Public · Destinations', en: 'Destinations' },
  { stem: 'PublicExperiences', route: '/experiences', label: '5e · Experiences and services', title: 'Public · Experiences and services', en: 'Experiences and services' },
  { stem: 'PublicOverlay', route: 'overlay on /experiences', label: '5f · Experience and service overlay', title: 'Public · Overlay', en: 'Details overlay' },
  { stem: 'PublicCart', route: 'header cart', label: '5g · Cart in the header', title: 'Public · Cart', en: 'Cart' },
  { stem: 'PublicStays', route: '/private-stays', label: '5h · Private stays', title: 'Public · Private stays', en: 'Private stays' },
  { stem: 'PublicStayDetail', route: '/private-stays/[stay]', label: '5i · Stay detail', title: 'Public · Stay detail', en: 'Stay detail' },
  { stem: 'PublicBlog', route: '/blog', label: '5j · Blog', title: 'Public · Blog', en: 'Blog' },
  { stem: 'PublicBlogPost', route: '/blog/[post]', label: '5k · Blog post', title: 'Public · Blog post', en: 'Blog post' },
];

export function buildPage(stem, k, H) {
  const cx = makeCtx(k, H);
  const { T, t3 } = cx;
  cx.cartCount = 0;
  if (stem === 'PublicOverlay') return overlayFrames(cx);
  if (stem === 'PublicHome') return homeFrames(cx);
  if (stem === 'PublicCart') return cartFrames(cx);
  const stayCards = () => H.en.stays.map((s, i) => ({ p: i + 1, alt: k(s.alt, H.ar.stays[i].alt, H.es.stays[i].alt), name: k(s.name, H.ar.stays[i].name, H.es.stays[i].name), line: k(s.detail, H.ar.stays[i].detail, H.es.stays[i].detail) }));
  const destCards = () => ['Cartagena', 'Medellín', 'Bogotá', 'San Andrés', 'Cocora Valley'].map((n, i) => ({ p: i, alt: T(n), name: T(n), line: T('[Short line]') }));
  const expNames = ['Cartagena Walled City Night', 'Cartagena Heritage Tours', 'Rosario Islands Escape'];
  const expCards = () => expNames.map((n, i) => ({ p: i, alt: T(n), name: T(n), line: T('[Short line]') }));
  const svcCards = () => H.en.services.map((s, i) => ({ p: [5, 4, 5][i], alt: k(s.name, H.ar.services[i].name, H.es.services[i].name), name: k(s.name, H.ar.services[i].name, H.es.services[i].name), line: T('[Short line]') }));
  const storyCards = () => H.en.stories.slice(0, 3).map((s, i) => ({ p: i + 2, alt: k(s.title, H.ar.stories[i].title, H.es.stories[i].title), name: k(s.title, H.ar.stories[i].title, H.es.stories[i].title), line: T('[Date]') }));
  const journeyCards = () => H.en.journeys.slice(0, 3).map((j, i) => ({ p: i, alt: k(j.name, H.ar.journeys[i].name, H.es.journeys[i].name), name: k(j.name, H.ar.journeys[i].name, H.es.journeys[i].name), line: T('[Short line]') }));
  const g3 = { d: 3, t: 2, p: 1 };
  const hero_ = () => (cx2, W, cls) => heroSection(cx2, W, cls, { titleHtml: t3((h) => h.heroTitle), altEn: 'Colonial courtyard with arches around a still pool' });
  const ttl = (title, o = {}) => (cx2, W, cls) => titleBlock(cx2, W, cls, { title, ...o });
  const crd = (items, o = {}) => (cx2, W, cls) => cards(cx2, W, cls, items(), { cols: g3, ...o });
  const S = {
    PublicHome: [
      hero_(),
      ttl(t3((h) => h.welcomeTitle), { kick: t3((h) => h.welcomeKicker), intro: t3((h) => h.welcome[0]) }),
      ttl(t3((h) => h.galleryTitle)),
      crd(expCards, { line: false }),
      ttl(t3((h) => h.staysTitle), { intro: t3((h) => h.staysIntro) }),
      crd(stayCards),
    ],
    PublicHome2: [
      ttl(t3((h) => h.servicesTitle), { intro: t3((h) => h.servicesIntro) }),
      crd(svcCards),
      ttl(t3((h) => h.momentsTitle)),
      crd(expCards, { price: true }),
      ttl(t3((h) => h.journeysTitle)),
      crd(journeyCards, { price: true }),
      ttl(t3((h) => h.storiesTitle)),
      crd(storyCards),
      (a, b, c) => team(a, b, c),
      (a, b, c) => contactForm(a, b, c, { title: t3((h) => h.contactTitle) }),
    ],
    PublicAbout: [
      (a, b, c) => heroSection(a, b, c, { titleHtml: T('Your Private Colombia'), altEn: 'Colonial courtyard with arches around a still pool', photo: B.walled }),
      (a, b, c) => splitBlock(a, b, c, { title: T('Our Story'), photo: B.stay }),
      (a, b, c) => paragraphs(a, b, c, { title: T('Our Values'), n: 3 }),
      (a, b, c) => team(a, b, c),
      (a, b, c) => contactForm(a, b, c, { title: T('Get In Touch') }),
    ],
    PublicContact: [
      ttl(T('Plan Your Journey'), { level: 'h1', size: 48, intro: t3((h) => h.contactIntro) }),
      (a, b, c) => contactForm(a, b, c, { title: T('Travel With Confidence') }),
      (a, b, c) => team(a, b, c),
    ],
    PublicDestinations: [ttl(T('Colombia’s most extraordinary cities'), { level: 'h1', size: 48 }), crd(destCards)],
    PublicExperiences: [
      ttl(T('Experiences and services'), { level: 'h1', size: 48 }),
      expCatalog,
      cartBar,
    ],
    PublicStays: [ttl(T('Your Stay, Personally Selected'), { level: 'h1', size: 48 }), crd(() => [...stayCards(), ...stayCards()])],
    PublicStayDetail: [
      stayHero,
      (a, b, c) => paragraphs(a, b, c, { title: T('About'), n: 2 }),
      (a, b, c) => listGrid(a, b, c, { title: T('Amenities'), itemKey: '[Amenity]', n: 6 }),
      (a, b, c) => listGrid(a, b, c, { title: T('Policies to check'), itemKey: '[Policy]', n: 4 }),
      ttl(T('Services')), crd(svcCards, { add: true }),
      ttl(T('Experiences')), crd(expCards, { add: true }),
      ttl(T('More Private Stays')), crd(stayCards),
      stayDock,
    ],
    PublicBlog: [ttl(T('Travel Insights'), { level: 'h1', size: 48 }), crd(() => [...storyCards(), ...storyCards()])],
    PublicBlogPost: [
      (a, b, c) => blogHero2(a, b, c, { photo: B.heritage }),
      blogBody,
      ttl(T('Related stories')), crd(storyCards),
      (a, b, c) => contactForm(a, b, c, { title: t3((h) => h.newsletter) }),
    ],
  };
  if (stem === 'PublicExperiences') cx.cartCount = 2;
  const frames = WIDTHS.map(([W, cls, label]) => renderFrame(cx, W, cls, label, S[stem], stem === 'PublicHome2'));
  const maxH = Math.max(...frames.map((f) => f.h));
  return { framesHtml: `<div style="display:flex;align-items:flex-start;gap:80px">${frames.map((f) => f.html).join('')}</div>`, maxH };
}

export { acctTrigger, siteHeader, cartBtn, inset, WIDTHS, B, primaryBtn, fieldBox, chipBtn };
