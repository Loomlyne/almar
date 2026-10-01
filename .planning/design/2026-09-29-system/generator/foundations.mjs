import { C, MONO, icon, mono, code, kicker, cap, lab, body, h3, col, row, grid, panel, section, header, flex } from './lib.mjs';

/* ---------- Board F1: colour ---------- */
export function colorBoard(k) {
  const sw = (name, hex, role, fill) => `<div style="display:flex;flex-direction:column;gap:8px">
<span style="height:72px;display:block;${fill}"></span>
${code(name, C.ink, 14)}${code(hex, C.muted, 12)}${cap(role)}</div>`;
  const solid = (c) => `background:${c};`;
  const bordered = (c) => `background:${c};border:1px solid ${C.line};box-sizing:border-box;`;
  const tokens = [
    ['ivory', '#fffaf0', k('Page, bar at rest, docks', 'الصفحة والشريط في وضعه العادي والأشرطة السفلية', 'Página, barra en reposo, barras inferiores'), bordered(C.ivory)],
    ['surface', '#ffffff', k('Panels, open segment, cards, inputs', 'اللوحات والحقول والبطاقات والقسم المفتوح', 'Paneles, segmento abierto, tarjetas, campos'), bordered(C.surface)],
    ['teal', '#1f3b40', k('Primary fill, headings, links, focus', 'التعبئة الأساسية والعناوين والروابط والتركيز', 'Relleno principal, títulos, enlaces, foco'), solid(C.teal)],
    ['teal-hover', '#1b3438', k('Primary hover', 'تمرير المؤشر على الزر الأساسي', 'Primario al pasar el cursor'), solid(C.tealHover)],
    ['teal-press', '#182d31', k('Primary press', 'ضغط الزر الأساسي', 'Primario al pulsar'), solid(C.tealPress)],
    ['teal-tint', '#d1dfe0', k('Backgrounds only, never text', 'للخلفيات فقط، لا للنص أبدًا', 'Solo fondos, nunca texto'), solid(C.tealTint)],
    ['gold', '#d4ba8a', k('Lines only. Never a fill, text or icon', 'خطوط فقط. ليس تعبئة ولا نصًا ولا أيقونة', 'Solo líneas. Nunca relleno, texto ni icono'),
      `background:${C.surface};border:1px solid ${C.line};border-top:6px solid ${C.gold};box-sizing:border-box;`],
    ['ink', '#262626', k('Body text and values', 'نص المحتوى والقيم', 'Texto y valores'), solid(C.ink)],
    ['muted', '#63615f', k('Labels, hints, disabled, control outlines', 'التسميات والتلميحات والمعطّل وحدود العناصر', 'Etiquetas, ayudas, deshabilitado, bordes de controles'), solid(C.muted)],
    ['line', 'rgb(38 38 38 / 0.16)', k('Dividers and hairlines only', 'الفواصل والخطوط الرفيعة فقط', 'Solo divisores y líneas finas'), `background:${C.line};`],
    ['error', '#8f2d2d', k('Missing field, error text. Never a fill', 'الحقل الناقص ونص الخطأ. ليس تعبئة أبدًا', 'Campo faltante, texto de error. Nunca relleno'), solid(C.error)],
    ['success', '#1e6b45', k('Status icons', 'أيقونات الحالة', 'Iconos de estado'), solid(C.success)],
    ['warning', '#8a3b12', k('Status icons', 'أيقونات الحالة', 'Iconos de estado'), solid(C.warning)],
    ['whatsapp', '#25D366', k('WhatsApp channel fill, charcoal glyph', 'تعبئة قناة واتساب مع رمز بلون الفحم', 'Relleno del canal de WhatsApp, glifo carbón'), solid(C.whatsapp)],
  ];
  const palette = grid(5, 24, tokens.map((t) => sw(...t)).join('') +
    `<div style="display:flex;flex-direction:column;gap:8px;justify-content:flex-end">${cap(k('Light only. No dark theme. 60% ivory, 30% white, 10% teal.', 'الوضع الفاتح فقط. لا سمة داكنة. ٦٠٪ عاجي، ٣٠٪ أبيض، ١٠٪ أخضر مزرق.', 'Solo claro. Sin tema oscuro. 60 % marfil, 30 % blanco, 10 % verde azulado.'))}</div>`);

  const li = (t) => `<li style="font-size:16px;line-height:{{lhB}};color:${C.ink}">${t}</li>`;
  const ul = (items) => `<ol style="margin:0;padding-inline-start:24px;display:flex;flex-direction:column;gap:8px">${items.map(li).join('')}</ol>`;
  const rules = grid(2, 48,
    col(16, h3(k('Teal is reserved for', 'الأخضر المزرق مخصص لـ', 'El verde azulado se reserva para')) + ul([
      k('The primary button fill. One per view.', 'تعبئة الزر الأساسي. واحد في كل عرض.', 'El relleno del botón principal. Uno por vista.'),
      k('Arrive and leave day cells.', 'خلايا يوم الوصول والمغادرة.', 'Las celdas de llegada y salida.'),
      k('The Added toggle and the filter chip that is on.', 'زر «تمت الإضافة» ورقاقة التصفية المفعّلة.', 'El interruptor «Añadido» y el filtro activo.'),
      k('Stepper outline and glyph.', 'حدود وأيقونة عدّاد الأعداد.', 'Borde y glifo del contador.'),
      k('Open segment rule, current step rule, selected ring.', 'خط القسم المفتوح وخط الخطوة الحالية وحلقة التحديد.', 'Regla del segmento abierto, del paso actual y anillo de selección.'),
      k('Headings, names, links and ghost text.', 'العناوين والأسماء والروابط والنص الشفاف.', 'Títulos, nombres, enlaces y texto fantasma.'),
      k('The 2px focus ring.', 'حلقة التركيز بسماكة ٢ بكسل.', 'El anillo de foco de 2 px.'),
      k('Saved heart, close glyphs, check icons, chevrons.', 'قلب الحفظ ورموز الإغلاق والتحقق والأسهم.', 'Corazón guardado, glifos de cierre, checks y flechas.'),
    ])) +
    col(16, h3(k('Gold is a line. The complete list', 'الذهبي خط فقط. القائمة كاملة', 'El dorado es una línea. La lista completa')) + ul([
      k('2px top rule of the journey bar (hero, docked, phone).', 'خط علوي بسماكة ٢ بكسل لشريط الرحلة.', 'Regla superior de 2 px de la barra de viaje.'),
      k('Rules between page sections.', 'الخطوط الفاصلة بين أقسام الصفحة.', 'Reglas entre secciones de la página.'),
      k('Active public-nav underline, 2px.', 'تسطير عنصر التنقل النشط، ٢ بكسل.', 'Subrayado activo de la navegación pública, 2 px.'),
      k('Current-step rule. Teal in this phase, pending your answer A.', 'خط الخطوة الحالية. أخضر مزرق في هذه المرحلة بانتظار إجابتك على السؤال أ.', 'Regla del paso actual. Verde azulado en esta fase, a la espera de tu respuesta A.'),
      k('1px hairline on the Confirmed status chip.', 'خط رفيع ١ بكسل على رقاقة «مؤكد».', 'Línea de 1 px en el chip «Confirmed».'),
      k('1px underline on link hover.', 'تسطير ١ بكسل عند تمرير المؤشر على الرابط.', 'Subrayado de 1 px al pasar sobre un enlace.'),
    ]) + cap(k('Gold on ivory is 1.80:1, so it is never text or an icon.', 'الذهبي على العاجي نسبته ١٫٨٠:١، لذلك لا يُستخدم نصًا أو أيقونة.', 'El dorado sobre marfil es 1,80:1, por eso nunca es texto ni icono.'))));

  const rowsData = [
    [C.ivory, C.teal, '11.48:1', k('Primary labels, arrive and leave numerals', 'تسميات الزر الأساسي وأرقام الوصول والمغادرة', 'Etiquetas primarias, números de llegada y salida'), 'AAA'],
    [C.ink, C.tealTint, '11.06:1', k('Range nights, selected destination line', 'ليالي المدة والسطر المحدد للوجهة', 'Noches del rango, línea del destino elegido'), 'AAA'],
    [C.teal, C.tealTint, '8.73:1', k('Inclusions text, selected row, sidebar selected', 'نص المشمولات والصف المحدد والشريط الجانبي المحدد', 'Texto de incluidos, fila y barra lateral seleccionadas'), 'AAA'],
    [C.muted, C.tealTint, '4.51:1', k('Banned on tint. Use ink or teal', 'ممنوع على الخلفية الفاتحة. استخدم الفحمي أو الأخضر المزرق', 'Prohibido sobre el tinte. Usa tinta o verde azulado'), 'X'],
    [C.muted, C.ivory, '5.93:1', k('Labels, placeholders, hints, disabled', 'التسميات والنصوص البديلة والتلميحات والمعطّل', 'Etiquetas, marcadores, ayudas, deshabilitado'), 'AA'],
    [C.muted, C.surface, '6.17:1', k('Hints in panels, kind line on rows', 'تلميحات اللوحات وسطر النوع في الصفوف', 'Ayudas en paneles, línea de tipo en filas'), 'AA'],
    [C.error, C.ivory, '7.82:1', k('Missing label, sheet warning line', 'تسمية الحقل الناقص وسطر التحذير', 'Etiqueta faltante, línea de aviso'), 'AAA'],
    [C.error, C.surface, '8.14:1', k('Alert line on its white surface', 'سطر التنبيه على سطحه الأبيض', 'Línea de alerta sobre superficie blanca'), 'AAA'],
    [C.teal, C.surface, '11.95:1', k('Names and headings in panels, stepper glyphs', 'الأسماء والعناوين في اللوحات ورموز العدّاد', 'Nombres y títulos en paneles, glifos del contador'), 'AAA'],
    [C.teal, C.ivory, '11.48:1', k('Headings and links', 'العناوين والروابط', 'Títulos y enlaces'), 'AAA'],
    [C.ink, C.ivory, '14.55:1', k('Body text and values', 'نص المحتوى والقيم', 'Texto y valores'), 'AAA'],
    [C.gold, C.ivory, '1.80:1', k('Never text or glyph. Lines only', 'لا يُستخدم نصًا أو رمزًا. خطوط فقط', 'Nunca texto ni glifo. Solo líneas'), 'X'],
  ];
  const pass = k('Pass', 'ناجح', 'Cumple');
  const fail = k('Fails', 'غير مقبول', 'No cumple');
  const head = (t) => `<span style="font-size:12px;line-height:{{lhC}};text-transform:{{tt}};letter-spacing:{{ls}};color:${C.muted}">${t}</span>`;
  const cols = 'grid-template-columns:120px 300px 100px minmax(0,1fr) 100px;column-gap:24px;align-items:center;';
  const table = `<div style="display:flex;flex-direction:column;border:1px solid ${C.line};background:${C.surface}">
<div style="display:grid;${cols}padding:12px 24px;border-bottom:1px solid ${C.line}">${head(k('Sample', 'عينة', 'Muestra'))}${head(k('Pair', 'الزوج', 'Par'))}${head(k('Ratio', 'النسبة', 'Ratio'))}${head(k('Used for', 'الاستخدام', 'Uso'))}${head(k('Result', 'النتيجة', 'Resultado'))}</div>` +
    rowsData.map(([fg, bg, ratio, use, res]) => `<div style="display:grid;${cols}padding:12px 24px;border-bottom:1px solid ${C.line}">
${fg === C.gold ? `<span style="display:block;height:44px;background:${bg};border:1px solid ${C.line};border-bottom:3px solid ${C.gold};box-sizing:border-box"></span>` : `<span style="display:flex;align-items:center;justify-content:center;height:44px;background:${bg};color:${fg};font-size:16px;border:1px solid ${C.line};box-sizing:border-box">Aa</span>`}
${code(`${fg.startsWith('rgb') ? 'line' : fg} on ${bg}`, C.ink, 12)}${code(ratio, C.ink, 14)}${lab(use)}<span style="font-size:14px;color:${res === 'X' ? C.error : C.ink}">${res === 'X' ? fail : pass + ' ' + res}</span></div>`).join('') + `</div>`;
  const borders = row(16, `<span style="width:96px;height:44px;border:1px solid ${C.muted};background:${C.ivory};box-sizing:border-box;display:block"></span>${code('muted on ivory', C.ink)}${code('5.93:1', C.ink, 14)}${lab(k('UI boundary of chips, select trigger, off ToggleCard', 'حدود الرقاقات ومحدد القائمة وبطاقة التبديل غير المفعّلة', 'Borde de chips, selector y tarjeta desactivada'))}`) +
    row(16, `<span style="width:96px;height:44px;border:1px solid ${C.line};background:${C.ivory};box-sizing:border-box;display:block"></span>${code('line on ivory', C.ink)}${code('1.37:1', C.ink, 14)}${lab(k('Decorative dividers only. Never the only boundary of a control', 'فواصل زخرفية فقط. ليست الحد الوحيد لأي عنصر تحكم', 'Solo divisores decorativos. Nunca el único borde de un control'))}`);

  const bodyHtml = header(k,
    k('ALMAR design system · Foundations · 1 of 3', 'نظام تصميم ألمار · الأسس · ١ من ٣', 'Sistema de diseño ALMAR · Fundamentos · 1 de 3'),
    k('Colour', 'الألوان', 'Color'),
    k('Fourteen tokens. Teal leads, ivory and white carry the page, gold draws lines. Values are copied from the approved contract, not from the Framer files.', 'أربعة عشر رمزًا. الأخضر المزرق يقود، والعاجي والأبيض يحملان الصفحة، والذهبي يرسم الخطوط. القيم منسوخة من العقد المعتمد وليس من ملفات Framer.', 'Catorce tokens. El verde azulado lidera, el marfil y el blanco sostienen la página y el dorado dibuja líneas. Los valores vienen del contrato aprobado, no de los archivos de Framer.')) +
    section(k('Palette', 'لوحة الألوان', 'Paleta'), '', palette) +
    section(k('Where teal and gold may appear', 'أين يظهر الأخضر المزرق والذهبي', 'Dónde pueden aparecer el verde azulado y el dorado'), '', rules) +
    section(k('Measured contrast', 'التباين المقاس', 'Contraste medido'), k('Relative luminance in sRGB. Text needs 4.5:1, control boundaries need 3:1.', 'اللمعان النسبي في sRGB. النص يحتاج ٤٫٥:١ وحدود عناصر التحكم تحتاج ٣:١.', 'Luminancia relativa en sRGB. El texto necesita 4,5:1 y los bordes de controles 3:1.'), table + col(12, borders));
  return { bodyHtml, w: 1440, h: 3350, title: 'Foundations · Colour' };
}

/* ---------- Board F2: type ---------- */
export function typeBoard(k) {
  const steps = [
    ['caption', 12, 12, '1.5', '1.7', 'Lato 400', 'lat', 'Nothing is charged before Pay.', 'لن يُحصَّل أي مبلغ قبل الدفع.'],
    ['label', 14, 14, '1.43', '1.63', 'Lato 400', 'lat', 'Continue to travelers', 'تابع إلى المسافرين'],
    ['body', 16, 16, '1.5', '1.7', 'Lato 400', 'lat', 'Add as many as you like.', 'أضف ما تشاء من الخدمات.'],
    ['title', 20, 20, '1.3', '1.5', 'Questa 400 · Lato 700 totals', 'dsp', 'Getsemaní Colonial House', 'بيت جتسيماني الاستعماري'],
    ['heading', 32, 24, '1.2', '1.4', 'Questa 400', 'dsp', 'Shape your journey', 'شكّل رحلتك'],
    ['display', 48, 32, '1.1', '1.3', 'Questa 400', 'dsp', 'Shape your journey', 'شكّل رحلتك'],
    ['hero', 64, 40, '1.05', '1.25', 'Questa 400', 'dsp', 'Where to?', 'إلى أين؟'],
  ];
  const latFam = (kind) => kind === 'dsp' ? "'Questa', Georgia, serif" : "'Lato', Arial, sans-serif";
  const arFam = (kind) => kind === 'dsp' ? "'Noto Naskh Arabic', serif" : "'Noto Sans Arabic', Arial, sans-serif";
  const trk = (n) => (n === 'display' || n === 'hero') ? 'letter-spacing:-0.02em;' : '';
  const color = (kind) => kind === 'dsp' ? C.teal : C.ink;
  const cols = 'grid-template-columns:220px minmax(0,1fr) minmax(0,1fr);column-gap:32px;align-items:baseline;';
  const desktop = `<div style="display:flex;flex-direction:column;background:${C.surface};border:1px solid ${C.line}">` +
    steps.map(([n, d, p, lhL, lhA, face, kind, lat, ar]) => `<div style="display:grid;${cols}padding:16px 24px;border-bottom:1px solid ${C.line}">
<div style="display:flex;flex-direction:column;gap:4px">${code(`text-${n}`, C.ink, 14)}${code(`${d}px · ${lhL} / ${lhA}`, C.muted)}${cap(face)}</div>
<div dir="ltr" style="font-family:${latFam(kind)};font-size:${d}px;line-height:${lhL};${trk(n)}color:${color(kind)}">${lat}</div>
<div dir="rtl" style="font-family:${arFam(kind)};font-size:${d}px;line-height:${lhA};color:${color(kind)}">${ar}</div></div>`).join('') + `</div>`;
  const phoneSteps = steps.filter((s) => ['heading', 'display', 'hero'].includes(s[0]));
  const phone = grid(3, 32, phoneSteps.map(([n, d, p, lhL, lhA, face, kind, lat, ar]) => `<div style="display:flex;flex-direction:column;gap:12px;background:${C.surface};border:1px solid ${C.line};padding:16px;box-sizing:border-box">
${code(`text-${n} · ${p}px`, C.ink, 14)}
<div dir="ltr" style="font-family:${latFam(kind)};font-size:${p}px;line-height:${lhL};${trk(n)}color:${C.teal}">${lat}</div>
<div dir="rtl" style="font-family:${arFam(kind)};font-size:${p}px;line-height:${lhA};color:${C.teal}">${ar}</div></div>`).join(''));
  const kickerDemo = grid(2, 24,
    panel(col(12, code('caption · uppercase · tracking-kicker 0.12em', C.ink) +
      `<div dir="ltr" style="font-size:12px;line-height:1.5;text-transform:uppercase;letter-spacing:0.12em;color:${C.muted}">Your journey · Cartagena</div>` +
      `<div dir="ltr" style="font-size:14px;line-height:1.43;text-transform:uppercase;letter-spacing:0.12em;color:${C.teal}">Search</div>`)) +
    panel(col(12, code('ar: normal-case · tracking-normal', C.ink) +
      `<div dir="rtl" style="font-family:'Noto Sans Arabic',Arial,sans-serif;font-size:12px;line-height:1.7;color:${C.muted}">رحلتك · قرطاجنة</div>` +
      `<div dir="rtl" style="font-family:'Noto Sans Arabic',Arial,sans-serif;font-size:14px;line-height:1.63;color:${C.teal}">بحث</div>`)));
  const weights = grid(2, 24,
    panel(col(8, code('400', C.ink, 14) + `<div style="font-size:16px;line-height:1.5">${k('Everything else: button labels, nav, chips, prices, StepRail.', 'كل ما عدا ذلك: تسميات الأزرار والتنقل والرقاقات والأسعار وسلم الخطوات.', 'Todo lo demás: botones, navegación, chips, precios, StepRail.')}</div>`)) +
    panel(col(8, code('700', C.ink, 14) + `<div style="font-size:16px;line-height:1.5;font-weight:700">${k('Only four uses:', 'أربعة استخدامات فقط:', 'Solo cuatro usos:')}</div>` +
      `<ol style="margin:0;padding-inline-start:24px;font-size:14px;line-height:1.6;color:${C.ink};display:flex;flex-direction:column;gap:4px">
<li>${k('Arrive and leave day numerals.', 'أرقام يومي الوصول والمغادرة.', 'Números de llegada y salida.')}</li>
<li>${k('The count between stepper buttons (pending answer B).', 'العدد بين زري العدّاد (بانتظار الإجابة ب).', 'El número entre los botones del contador (pendiente de respuesta B).')}</li>
<li>${k('The Total line.', 'سطر الإجمالي.', 'La línea Total.')}</li>
<li>${k('The one error line per view (pending answer B).', 'سطر الخطأ الوحيد في كل عرض (بانتظار الإجابة ب).', 'La única línea de error por vista (pendiente de respuesta B).')}</li></ol>` +
      cap(k('Questa is 400 only. Never a synthesized bold.', 'كويستا بوزن ٤٠٠ فقط. لا خط عريض مصطنع.', 'Questa solo en 400. Nunca negrita sintetizada.')))));
  const bodyHtml = header(k,
    k('ALMAR design system · Foundations · 2 of 3', 'نظام تصميم ألمار · الأسس · ٢ من ٣', 'Sistema de diseño ALMAR · Fundamentos · 2 de 3'),
    k('Type', 'الخطوط', 'Tipografía'),
    k('Seven named steps, 12px at the floor. Each step is shown in Latin and in Arabic. Hero, display and heading shrink on phones.', 'سبع خطوات مسماة، والحد الأدنى ١٢ بكسل. تظهر كل خطوة بالحروف اللاتينية والعربية. تصغر خطوات الغلاف والعرض والعنوان على الهواتف.', 'Siete pasos con nombre, con 12 px como mínimo. Cada paso se muestra en latino y en árabe. Hero, display y heading se reducen en el teléfono.')) +
    section(k('Steps at 768px and wider', 'الخطوات عند ٧٦٨ بكسل فأكثر', 'Pasos desde 768 px'), k('Left: token, size, line height Latin / Arabic, face. Latin on the left of each row, Arabic on the right.', 'اليسار: الرمز والحجم وارتفاع السطر لاتيني / عربي والخط.', 'Izquierda: token, tamaño, altura de línea latino / árabe, tipo.'), desktop) +
    section(k('Steps below 768px', 'الخطوات أقل من ٧٦٨ بكسل', 'Pasos bajo 768 px'), k('Only three steps change: hero 40, display 32, heading 24.', 'ثلاث خطوات فقط تتغير: غلاف ٤٠، عرض ٣٢، عنوان ٢٤.', 'Solo cambian tres pasos: hero 40, display 32, heading 24.'), phone) +
    section(k('Kicker and buttons', 'الكيكر والأزرار', 'Kicker y botones'), k('Latin is uppercase with 0.12em tracking. Arabic uses sentence form, no tracking.', 'اللاتينية بأحرف كبيرة وتباعد ٠٫١٢em. العربية بصيغة الجملة دون تباعد.', 'El latino va en mayúsculas con 0,12 em. El árabe usa forma de oración, sin espaciado.'), kickerDemo) +
    section(k('Weights', 'الأوزان', 'Pesos'), '', weights);
  return { bodyHtml, w: 1440, h: 3400, title: 'Foundations · Type' };
}

/* ---------- Board F3: space, shape, motion, dense ---------- */
export function spaceBoard(k) {
  const spaces = [['xs', 4, '1'], ['sm', 8, '2'], ['md', 16, '4'], ['lg', 24, '6'], ['xl', 32, '8'], ['2xl', 48, '12'], ['3xl', 64, '16']];
  const spacing = col(12, spaces.map(([n, v, u]) => row(16, `<span style="width:64px">${code(n, C.ink, 14)}</span><span style="width:120px">${code(`${v}px · step ${u}`)}</span><span style="height:16px;width:${v * 4}px;background:${C.teal};display:block"></span>`)).join('') +
    cap(k('Exceptions: step 3 (12px) inside controls, 0.5 (2px) for the chip hit area, 1px for hairlines.', 'استثناءات: الخطوة ٣ (١٢ بكسل) داخل عناصر التحكم، و٠٫٥ (٢ بكسل) لمنطقة لمس الرقاقة، و١ بكسل للخطوط الرفيعة.', 'Excepciones: paso 3 (12 px) dentro de controles, 0,5 (2 px) para el área táctil del chip, 1 px para líneas finas.')));
  const dims = [['control', 44], ['chip', 40], ['bar', 72], ['bar-docked', 56], ['summary', 64], ['entry', 64], ['action', 56], ['sheet-head', 60], ['dock', 88], ['mark', 28], ['row', 56], ['row-dense', 44], ['chip-dense', 24]];
  const dimGrid = grid(4, 24, dims.map(([n, v]) => `<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><span style="display:block;width:96px;height:${v}px;background:${C.tealTint};border:1px solid ${C.teal};box-sizing:border-box"></span>${code(`--spacing-${n}`, C.ink)}${code(`${v}px`)}</div>`).join(''));
  const conts = [['column', 1240], ['menu', 440], ['calendar', 760], ['rail', 400], ['dialog', 480], ['sidebar', 240]];
  const contGrid = col(12, conts.map(([n, v]) => row(16, `<span style="width:200px">${code(`--container-${n}`, C.ink)}</span><span style="width:60px">${code(`${v}px`)}</span><span style="height:12px;width:${Math.round(v * 0.5)}px;background:${C.teal};display:block"></span>`)).join('') +
    cap(k('Content column inset: 16px below md, 32px from md, 64px from lg.', 'هامش عمود المحتوى: ١٦ بكسل دون md، و٣٢ من md، و٦٤ من lg.', 'Margen de la columna: 16 px bajo md, 32 desde md, 64 desde lg.')));
  const radius = row(32, `<span style="width:96px;height:96px;background:${C.surface};border:1px solid ${C.ink};box-sizing:border-box;display:block"></span>` +
    col(8, code('--radius-control: 0 · --radius-overlay: 0', C.ink, 14) + `<span style="font-size:14px;line-height:{{lhL}}">${k('Square everywhere. No pills, no circles, no radio controls.', 'مربع في كل مكان. لا أقراص ولا دوائر ولا أزرار اختيار دائرية.', 'Cuadrado en todas partes. Sin píldoras, círculos ni radios.')}</span>`)) +
    row(16, `<span style="width:44px;height:44px;border:1px dashed ${C.muted};box-sizing:border-box;display:flex;align-items:center;justify-content:center">${icon('x', 20, C.teal)}</span><span style="font-size:14px;line-height:{{lhL}}">${k('Every control has a 44px hit target. Hit areas do not overlap.', 'لكل عنصر تحكم منطقة لمس ٤٤ بكسل. المناطق لا تتداخل.', 'Cada control tiene un área táctil de 44 px. Las áreas no se superponen.')}</span>`);
  const shadows = [
    ['float', '0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1)', 'bar'],
    ['lg', '0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12)', 'panel'],
    ['rule-primary', 'inset 0 -3px 0 #1f3b40', 'open'],
    ['rule-error', 'inset 0 -3px 0 #8f2d2d', 'missing'],
    ['rule-today', 'inset 0 -2px 0 #1f3b40', 'today'],
    ['selected', 'inset 0 0 0 2px #1f3b40', 'on'],
  ];
  const shadowGrid = grid(6, 24, shadows.map(([n, v]) => `<div style="display:flex;flex-direction:column;gap:12px"><span style="display:block;height:88px;background:${C.surface};box-shadow:${v}"></span>${code(`shadow-${n}`, C.ink)}</div>`).join(''));
  const motion = grid(2, 24,
    panel(col(8, code('duration-fast 150ms · duration-mid 250ms', C.ink, 14) + code('ease-standard cubic-bezier(0.2, 0, 0, 1)') +
      `<div style="font-size:14px;line-height:{{lhL}}">${k('Hover, press and colour: 150ms. Panels and sheets: 250ms, opacity and an 8px slide.', 'التمرير والضغط واللون: ١٥٠ مللي ثانية. اللوحات والصفحات المنزلقة: ٢٥٠ مللي ثانية بشفافية وانزلاق ٨ بكسل.', 'Hover, pulsación y color: 150 ms. Paneles y hojas: 250 ms, opacidad y desplazamiento de 8 px.')}</div>`)) +
    panel(col(8, code('motion-reduce:animate-fade-in', C.ink, 14) +
      `<div style="font-size:14px;line-height:{{lhL}}">${k('With reduced motion every animation becomes a 150ms fade. No bounce, no spring, no scale, no hover lift.', 'مع تقليل الحركة تصبح كل الحركات تلاشيًا بمدة ١٥٠ مللي ثانية. لا ارتداد ولا نابض ولا تكبير ولا رفع عند التمرير.', 'Con movimiento reducido, toda animación pasa a un fundido de 150 ms. Sin rebote, resorte, escala ni elevación.')}</div>`)));
  // dense samples
  const chipD = (t, gold) => `<span style="display:inline-flex;align-items:center;height:24px;padding:0 8px;box-sizing:border-box;border:1px solid ${gold ? C.gold : C.ink};font-size:12px;color:${C.ink};background:${C.ivory}">${t}</span>`;
  const tblRow = (h, sel) => `<div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1.6fr) 140px 140px;align-items:center;column-gap:16px;height:${h}px;padding:0 16px;box-sizing:border-box;border-bottom:1px solid ${C.line};background:${C.surface};font-size:14px"><span>${k('[Guest name]', '[اسم الضيف]', '[Nombre del huésped]')}</span><bdi style="font-variant-numeric:tabular-nums">12/10/2026 – 17/10/2026</bdi>${chipD('Confirmed', true)}<bdi style="font-variant-numeric:tabular-nums">ALMAR-000000</bdi></div>`;
  const dense = grid(2, 24,
    col(16, code('--spacing-row 56px', C.ink, 14) + `<div style="border-top:1px solid ${C.line}">${tblRow(56)}${tblRow(56)}</div>` + code('--spacing-row-dense 44px', C.ink, 14) + `<div style="border-top:1px solid ${C.line}">${tblRow(44)}${tblRow(44)}</div>`) +
    col(16, code('stat · sidebar · status chip 24px', C.ink, 14) +
      panel(col(4, `<div style="font-size:12px;line-height:{{lhC}};text-transform:{{tt}};letter-spacing:{{ls}};color:${C.muted}">${k('Bookings', 'الحجوزات', 'Reservas')}</div><div style="font-size:32px;line-height:1.2;font-variant-numeric:tabular-nums;color:${C.ink}">[00]</div>`)) +
      `<div style="width:240px;background:${C.surface};border:1px solid ${C.line};display:flex;flex-direction:column;padding:8px 0">
<div style="display:flex;align-items:center;min-height:44px;padding:0 8px;box-sizing:border-box;font-size:14px;background:${C.tealTint};color:${C.teal}">${k('Bookings', 'الحجوزات', 'Reservas')}</div>
<div style="display:flex;align-items:center;min-height:44px;padding:0 8px;box-sizing:border-box;font-size:14px;background:${C.ivory};color:${C.ink}">${k('Calendar', 'التقويم', 'Calendario')}</div>
<div style="display:flex;align-items:center;min-height:44px;padding:0 8px;box-sizing:border-box;font-size:14px;color:${C.ink}">${k('Catalog', 'الفهرس', 'Catálogo')}</div></div>` +
      row(8, chipD('Draft', false) + chipD('Confirmed', true)) +
      cap(k('Dense mode: padding drops one step (24→16, 16→8). Type steps and the 44px hit target stay.', 'الوضع الكثيف: يقل الحشو درجة واحدة (٢٤←١٦، ١٦←٨). تبقى الخطوط ومنطقة اللمس ٤٤ بكسل.', 'Modo denso: el relleno baja un paso (24→16, 16→8). Se mantienen la tipografía y el área táctil de 44 px.'))));
  const bodyHtml = header(k,
    k('ALMAR design system · Foundations · 3 of 3', 'نظام تصميم ألمار · الأسس · ٣ من ٣', 'Sistema de diseño ALMAR · Fundamentos · 3 de 3'),
    k('Space, shape and motion', 'المسافات والأشكال والحركة', 'Espacio, forma y movimiento'),
    k('Spacing steps, named sizes, radius 0, shadows, motion and the dense tokens for the dashboard.', 'درجات المسافات والأحجام المسماة وزوايا مستقيمة والظلال والحركة وقيم الوضع الكثيف للوحة التحكم.', 'Pasos de espacio, tamaños con nombre, radio 0, sombras, movimiento y tokens densos del panel.')) +
    section(k('Spacing scale', 'سلم المسافات', 'Escala de espacio'), '', spacing) +
    section(k('Dimension tokens', 'رموز الأبعاد', 'Tokens de dimensión'), k('Sizes, not spacing. They work as h-, w- and size- utilities.', 'أحجام وليست مسافات. تعمل مع h- وw- وsize-.', 'Tamaños, no espacio. Funcionan como utilidades h-, w- y size-.'), dimGrid) +
    section(k('Containers', 'الحاويات', 'Contenedores'), '', contGrid) +
    section(k('Radius and hit target', 'الزوايا ومنطقة اللمس', 'Radio y área táctil'), '', col(24, radius)) +
    section(k('Shadows', 'الظلال', 'Sombras'), k('Six tokens. Docked bar, sticky header and docks have a hairline and no shadow.', 'ستة رموز. الشريط الملتصق والترويسة والأشرطة السفلية بخط رفيع دون ظل.', 'Seis tokens. La barra acoplada, la cabecera fija y las barras inferiores llevan línea fina y sin sombra.'), shadowGrid) +
    section(k('Motion', 'الحركة', 'Movimiento'), '', motion) +
    section(k('Dense tokens', 'رموز الوضع الكثيف', 'Tokens densos'), '', dense);
  return { bodyHtml, w: 1440, h: 4200, title: 'Foundations · Space and shape' };
}
