import fs from 'node:fs';
import path from 'node:path';
import { makeDict, wrapBoard } from './lib.mjs';
import { colorBoard, typeBoard, spaceBoard } from './foundations.mjs';
import { controlsBoard } from './components1.mjs';
import { surfacesBoard } from './components2.mjs';
import { PAGES, buildPage } from './public.mjs';
import { header } from './lib.mjs';
import { guestBoard } from './guest.mjs';
import { dashBoard } from './dashboard.mjs';
import { barBoard, phoneBoard, addonsBoard, phoneAddonsBoard } from './journey.mjs';
const HOMEMOD = await import('/Users/koss/Developer/almarprod-Website-Code/lib/copy/home.ts');
const JMOD = await import('/Users/koss/Developer/almarprod-Website-Code/lib/copy/journey.ts');
const JC = JMOD.JOURNEY_COPY;
const GMOD = await import('/Users/koss/Developer/almarprod-Website-Code/lib/copy/guest.ts');
const GC = GMOD.GUEST_COPY;
const DMOD = await import('/Users/koss/Developer/almarprod-Website-Code/lib/copy/dashboard.ts');
const DCP = DMOD.DASHBOARD_COPY;
const HC = HOMEMOD.HOME_COPY || HOMEMOD.default || Object.values(HOMEMOD)[0];

const SCR = '/private/tmp/claude-501/-Users-koss-Developer-almarprod-Website-Code/314e86c7-e446-4af1-86cd-2b34d8c37426/scratchpad';
const ROOT = `${SCR}/canvas-root`;
const PROJ = `${ROOT}/project`;
const REPO = '/Users/koss/Developer/almarprod-Website-Code/.planning/design/2026-09-29-system/pages';
fs.mkdirSync(PROJ, { recursive: true });
fs.mkdirSync(REPO, { recursive: true });

const defs = [
  { stem: 'FoundationsColor', page: 'foundations', fn: colorBoard, label: '2a · Colour' },
  { stem: 'FoundationsType', page: 'foundations', fn: typeBoard, label: '2b · Type' },
  { stem: 'FoundationsSpace', page: 'foundations', fn: spaceBoard, label: '2c · Space, shape, motion, dense' },
  { stem: 'ComponentsControls', page: 'components', fn: controlsBoard, label: '3a · Controls' },
  { stem: 'ComponentsSurfaces', page: 'components', fn: surfacesBoard, label: '3b · Surfaces and navigation' },
];
const baseCanvas = JSON.parse(fs.readFileSync(`${SCR}/live4/project/canvas.json`, 'utf8'));
const boards = { ...baseCanvas.boards };
for (const b of Object.values(boards)) if (!b.page) b.page = 'audit';
const order = [...baseCanvas.order];
for (const n of Object.keys(baseCanvas.boards)) if (n.startsWith('Public')) delete boards[n];
for (let i = order.length - 1; i >= 0; i--) if (order[i].startsWith('Public')) order.splice(i, 1);
const copies = { foundations: [], components: [] };
const pos = { foundations: 0, components: 0 };
const files = {};
let notesPublic = {};

for (const d of defs) {
  for (const fixedAr of [false, true]) {
    const { dict, k } = makeDict();
    const { bodyHtml, w, h, title } = d.fn(k);
    const html = wrapBoard({ title: title + (fixedAr ? ' · Arabic RTL' : ''), w, h, bodyHtml, dict, fixedAr });
    const name = `${d.stem}${fixedAr ? 'Ar' : ''}.dc.html`;
    fs.writeFileSync(`${PROJ}/${name}`, html);
    files[`project/${name}`] = `project/${name}`;
    copies[d.page].push(`<!-- ===== ${name} ===== -->\n${html}`);
    boards[name] = { x: pos[d.page], y: 0, w, h, title: `${d.label}${fixedAr ? ' · Arabic RTL (fixed)' : ''}`, page: d.page, ...(fixedAr ? {} : { is_interactive: true }) };
    order.push(name);
    pos[d.page] += w + 80;
  }
}

// ---- page 5: public pages ----
let py = 0;
for (const pg of PAGES) {
  let hh = 0;
  for (const fixedAr of [false]) {
    const { dict, k } = makeDict();
    const { framesHtml, maxH } = buildPage(pg.stem, k, HC);
    const w = pg.stem === 'PublicHome' ? 200 + 2 * 1440 + 2 * 834 + 2 * 390 + 5 * 80 : pg.stem === 'PublicOverlay' ? 200 + 1440 + 80 + 390 : pg.stem === 'PublicCart' ? 200 + 520 + 80 + 440 + 80 + 440 + 80 + 390 : 3024;
    const h = 160 + 230 + 64 + 30 + maxH + 40;
    const bodyHtml = header(k,
      k('ALMAR design system · Public pages · ' + pg.route, 'نظام تصميم ألمار · الصفحات العامة · ' + pg.route, 'Sistema de diseño ALMAR · Páginas públicas · ' + pg.route),
      k(pg.en, pg.en, pg.en),
      k('The Framer layout and section order, drawn on the approved tokens at desktop, tablet and phone. No people, no invented team, no amounts.', 'تخطيط Framer وترتيب الأقسام مرسومان بالقيم المعتمدة على سطح المكتب واللوحي والهاتف. لا أشخاص ولا فريق مخترع ولا مبالغ.', 'El diseño y el orden de secciones de Framer, dibujados con los tokens aprobados en escritorio, tableta y teléfono. Sin personas, sin equipo inventado ni importes.')) + framesHtml;
    const html = wrapBoard({ title: pg.title + (fixedAr ? ' · Arabic RTL' : ''), w, h, bodyHtml, dict, fixedAr });
    const name = `${pg.stem}${fixedAr ? 'Ar' : ''}.dc.html`;
    fs.writeFileSync(`${PROJ}/${name}`, html);
    files[`project/${name}`] = `project/${name}`;
    copies.public = copies.public || [];
    copies.public.push(`<!-- ===== ${name} ===== -->\n${html}`);
    boards[name] = { x: 0, y: py, w, h, title: `${pg.label}${fixedAr ? ' · Arabic RTL (fixed)' : ''}`, page: 'public', ...(fixedAr ? {} : { is_interactive: true }) };
    order.push(name);
    hh = h;
  }
  py += hh + 120;
}
notesPublic = { 'head-public': { kind: 'title1', maxW: 6100, text: 'Public pages · for your sign-off · Arabic and Spanish are drafts', w: 240, x: 0, y: -300, page: 'public' } };

// ---- page 4: journey ----
const jdefs = [
  { stem: 'JourneyBar', fn: barBoard, label: '4a · Journey bar (desktop and tablet)' },
  { stem: 'JourneyPhone', fn: phoneBoard, label: '4b · Phone journey' },
  { stem: 'JourneyAddons', fn: addonsBoard, label: '4c · Add-ons step (desktop)' },
  { stem: 'JourneyPhoneAddons', fn: phoneAddonsBoard, label: '4d · Phone add-ons, cart and Pay' },
];
let jy = 0;
for (const d of jdefs) {
  const { dict, k } = makeDict();
  const { bodyHtml, w, h, title } = d.fn(k, JC);
  const html = wrapBoard({ title, w, h, bodyHtml, dict, fixedAr: false });
  const name = `${d.stem}.dc.html`;
  fs.writeFileSync(`${PROJ}/${name}`, html);
  files[`project/${name}`] = `project/${name}`;
  copies.journey = copies.journey || [];
  copies.journey.push(`<!-- ===== ${name} ===== -->\n${html}`);
  boards[name] = { x: 0, y: jy, w, h, title: d.label, page: 'journey', is_interactive: true };
  order.push(name);
  jy += h + 120;
}
notesPublic['head-journey'] = { kind: 'title1', maxW: 3800, text: 'Journey · for your sign-off · Arabic and Spanish are drafts', w: 240, x: 0, y: -300, page: 'journey' };

// ---- page 6: guest ----
const gdefs = [
  { stem: 'GuestLogin', label: '6a · Login', en: 'Login' },
  { stem: 'GuestAccount', label: '6b · Account', en: 'Account' },
  { stem: 'GuestBookings', label: '6c · Bookings', en: 'Bookings' },
  { stem: 'GuestTrip', label: '6d · Trip detail', en: 'Trip detail' },
  { stem: 'GuestMenu', label: '6e · Account access (header menu)', en: 'Account menu' },
  { stem: 'GuestDelete', label: '6f · Delete account, all states', en: 'Delete account' },
  { stem: 'GuestCancel', label: '6g · Cancellation and refund, all states', en: 'Cancellation and refund' },
];
let gy = 0;
for (const d of gdefs) {
  const { dict, k } = makeDict();
  const { framesHtml, maxH } = guestBoard(d.stem, k, HC, GC);
  const w = d.stem === 'GuestMenu' ? 200 + 1440 + 80 + 390 : d.stem === 'GuestDelete' ? 200 + 1440 + 80 + 390 + 80 + 390 : d.stem === 'GuestCancel' ? 200 + 3 * 640 + 2 * 48 : 3024; const h = 160 + 230 + 64 + maxH + 120;
  const bodyHtml = header(k,
    k('ALMAR design system · Guest · ' + d.en, 'نظام تصميم ألمار · الضيف · ' + d.en, 'Sistema de diseño ALMAR · Huésped · ' + d.en),
    k(d.en, d.en, d.en),
    k('Redesigned after the owner review: no empty space, split-screen sign-in with one page for sign in and sign up, cards for account and bookings. Filled states use brackets only: [Guest name], ALMAR-000000, AED [AMOUNT].', 'أعيد التصميم بعد مراجعة المالك: دون فراغات، وتسجيل دخول بشاشة مقسومة بصفحة واحدة للدخول وإنشاء الحساب، وبطاقات للحساب والحجوزات. الحالات المعبأة تستخدم الأقواس فقط: [اسم الضيف] وALMAR-000000 وAED [AMOUNT].', 'Rediseño tras la revisión del propietario: sin espacios vacíos, acceso en pantalla dividida con una sola página para entrar y registrarse, y tarjetas para cuenta y reservas. Los datos usan solo corchetes: [Nombre del huésped], ALMAR-000000, AED [AMOUNT].')) + framesHtml;
  const html = wrapBoard({ title: 'Guest · ' + d.en, w, h, bodyHtml, dict, fixedAr: false });
  const name = `${d.stem}.dc.html`;
  fs.writeFileSync(`${PROJ}/${name}`, html);
  files[`project/${name}`] = `project/${name}`;
  copies.guest = copies.guest || [];
  copies.guest.push(`<!-- ===== ${name} ===== -->\n${html}`);
  boards[name] = { x: 0, y: gy, w, h, title: d.label, page: 'guest', is_interactive: true };
  order.push(name);
  gy += h + 120;
}
notesPublic['head-guest'] = { kind: 'title1', maxW: 3000, text: 'Guest · for your sign-off · Arabic and Spanish are drafts', w: 240, x: 0, y: -300, page: 'guest' };

// ---- page 7: dashboard ----
const ddefs = [
  { stem: 'DashHome', label: '7a · Home', en: 'Home' },
  { stem: 'DashBookings', label: '7b · Bookings', en: 'Bookings' },
  { stem: 'DashNewBookingA', label: '7c · New booking page, steps 1 to 3', en: 'New booking, steps 1 to 3' },
  { stem: 'DashNewBookingB', label: '7c · New booking page, steps 4 and 5', en: 'New booking, steps 4 and 5' },
  { stem: 'DashBookingDetailA', label: '7d · Booking detail, overview and payments', en: 'Booking detail, overview and payments' },
  { stem: 'DashBookingDetailB', label: '7d · Booking detail, history and cancellation', en: 'Booking detail, history and cancellation' },
  { stem: 'DashCustomers', label: '7e · Customers', en: 'Customers' },
  { stem: 'DashCustomerProfile', label: '7e · Customer profile', en: 'Customer profile' },
  { stem: 'DashCalendar', label: '7f · Calendar and blocking', en: 'Calendar and blocking' },
  { stem: 'DashDestinations', label: '7g · Destinations', en: 'Destinations' },
  { stem: 'DashStays', label: '7h · Stays', en: 'Stays' },
  { stem: 'DashServices', label: '7i · Experiences and services', en: 'Experiences and services' },
  { stem: 'DashPackages', label: '7j · Packages, coming soon', en: 'Packages' },
  { stem: 'DashContent', label: '7k · Content hub and page editor', en: 'Content hub and page editor' },
  { stem: 'DashPosts', label: '7l · Blog', en: 'Blog' },
  { stem: 'DashTeamLegal', label: '7m · Team and Legal', en: 'Team and Legal' },
  { stem: 'DashMediaNav', label: '7n · Media and Navigation', en: 'Media and Navigation' },
  { stem: 'DashSettingsA', label: '7o · Settings, profile, business, payments', en: 'Settings, part 1' },
  { stem: 'DashSettingsB', label: '7o · Settings, team, integrations, security', en: 'Settings, part 2' },
];
let dy = 0;
for (const dd of ddefs) {
  const { dict, k } = makeDict();
  const { framesHtml, maxH } = dashBoard(dd.stem, k, DCP);
  const w = 3024, h = 160 + 230 + 64 + maxH + 120;
  if (h > 8000) console.log('TOO TALL', dd.stem, h);
  const bodyHtml = header(k,
    k('ALMAR design system · Dashboard · ' + dd.en, 'نظام تصميم ألمار · لوحة التحكم · ' + dd.en, 'Sistema de diseño ALMAR · Panel · ' + dd.en),
    k(dd.en, dd.en, dd.en),
    k('Dense dashboard screens at desktop 1440 and tablet 834, empty and filled. Labels and empty lines are lib/copy/dashboard.ts. Filled rows use brackets only: [Guest name], ALMAR-000000, AED [AMOUNT]. Publish and Save are drawn as they behave today.', 'شاشات لوحة التحكم الكثيفة على سطح المكتب ١٤٤٠ واللوحي ٨٣٤، فارغة ومعبأة. التسميات والأسطر الفارغة من lib/copy/dashboard.ts. الصفوف المعبأة تستخدم الأقواس فقط: [اسم الضيف] وALMAR-000000 وAED [AMOUNT].', 'Pantallas densas del panel en escritorio 1440 y tableta 834, vacías y con datos. Etiquetas y líneas vacías de lib/copy/dashboard.ts. Los datos usan solo corchetes: [Nombre del huésped], ALMAR-000000, AED [AMOUNT].')) + framesHtml;
  const html = wrapBoard({ title: 'Dashboard · ' + dd.en, w, h, bodyHtml, dict, fixedAr: false });
  const name = `${dd.stem}.dc.html`;
  fs.writeFileSync(`${PROJ}/${name}`, html);
  files[`project/${name}`] = `project/${name}`;
  copies.dashboard = copies.dashboard || [];
  copies.dashboard.push(`<!-- ===== ${name} ===== -->\n${html}`);
  boards[name] = { x: 0, y: dy, w, h, title: dd.label, page: 'dashboard', is_interactive: true };
  order.push(name);
  dy += h + 120;
}
notesPublic['head-dashboard'] = { kind: 'title1', maxW: 2700, text: 'Dashboard · for your sign-off · Arabic and Spanish are drafts', w: 240, x: 0, y: -300, page: 'dashboard' };

const pages = [
  { id: 'audit', name: '1 · Audit' }, { id: 'foundations', name: '2 · Foundations' }, { id: 'components', name: '3 · Components' },
  { id: 'journey', name: '4 · Journey' }, { id: 'public', name: '5 · Public pages' }, { id: 'guest', name: '6 · Guest' }, { id: 'dashboard', name: '7 · Dashboard' },
];
const notes = {
  ...baseCanvas.notes, ...notesPublic,
};
for (const n of Object.values(notes)) if (!n.page) n.page = 'audit';

const canvas = { ...baseCanvas, boards, order: [...new Set(order)], pages, notes };
fs.writeFileSync(`${PROJ}/canvas.json`, JSON.stringify(canvas, null, 2));
fs.writeFileSync(`${REPO}/foundations.dc.html`, copies.foundations.join('\n\n'));
fs.writeFileSync(`${REPO}/components.dc.html`, copies.components.join('\n\n'));
fs.writeFileSync(`${REPO}/public.dc.html`, copies.public.join('\n\n'));
fs.writeFileSync(`${REPO}/journey.dc.html`, copies.journey.join('\n\n'));
fs.writeFileSync(`${REPO}/guest.dc.html`, copies.guest.join('\n\n'));
fs.writeFileSync(`${REPO}/dashboard.dc.html`, copies.dashboard.join('\n\n'));
fs.writeFileSync(`${SCR}/gen/files.json`, JSON.stringify(files, null, 2));
console.log(Object.keys(files).length, 'boards written');
