import { C, MONO, HERO_IMG, icon, code, cap, lab, body, h3, col, row, grid, panel, section, header } from './lib.mjs';

const FOCUS = `outline:2px solid ${C.teal};outline-offset:2px;`;
const UPPER = 'text-transform:{{tt}};letter-spacing:{{ls}};';

// A button specimen. variant: primary | secondary | ghost | danger. state: rest | hover | press | focus | disabled | busy
function btn(label, variant, state, size = 'md', withIcon = null) {
  const h = { md: 44, lg: 56, bar: 72, docked: 56 }[size];
  const w = { md: '', lg: '', bar: 'width:200px;', docked: 'width:160px;' }[size];
  const px = size === 'lg' ? 32 : size === 'md' ? 24 : 16;
  let bg = 'transparent', fg = C.teal, bd = '1px solid transparent', extra = '';
  if (variant === 'primary') { bg = C.teal; fg = C.ivory; bd = `1px solid ${C.teal}`; }
  if (variant === 'secondary') { bd = `1px solid ${C.teal}`; }
  if (variant === 'danger') { fg = C.ink; bd = `1px solid ${C.error}`; }
  if (state === 'hover') {
    if (variant === 'primary') { bg = C.tealHover; bd = `1px solid ${C.tealHover}`; }
    if (variant === 'secondary') bg = C.tealTint;
    if (variant === 'ghost') extra = `text-decoration:underline;text-decoration-color:${C.gold};text-decoration-thickness:1px;text-underline-offset:4px;`;
    if (variant === 'danger') bg = C.ivory;
  }
  if (state === 'press') {
    if (variant === 'primary') { bg = C.tealPress; bd = `1px solid ${C.tealPress}`; }
    if (variant === 'secondary') { bg = C.tealTint; bd = `1px solid ${C.tealPress}`; }
    if (variant === 'ghost') extra = `text-decoration:underline;text-decoration-color:${C.gold};text-decoration-thickness:1px;text-underline-offset:4px;`;
    if (variant === 'danger') bg = C.line;
  }
  if (state === 'focus') extra = FOCUS;
  if (state === 'disabled') { bg = C.ivory; fg = C.muted; bd = `1px solid ${C.line}`; }
  const upper = variant === 'ghost' || variant === 'danger' ? '' : UPPER;
  const lead = state === 'busy' ? icon('spinner', 20, 'currentColor') : (withIcon ? icon(withIcon, 20, 'currentColor', withIcon === 'search' || withIcon === 'arrow-right' ? false : false) : '');
  return `<button type="button"${state === 'disabled' || state === 'busy' ? ' disabled' : ''} style="display:inline-flex;align-items:center;justify-content:center;gap:12px;height:${h}px;${w}padding:0 ${px}px;box-sizing:border-box;background:${bg};color:${fg};border:${bd};border-radius:0;font:400 14px/1.43 {{fb}};${upper}${extra}cursor:pointer">${lead}<span>${label}</span></button>`;
}

export function controlsBoard(k) {
  const V = { Continue: k('Continue', 'متابعة', 'Continuar'), Search: k('Search', 'بحث', 'Buscar'), Done: k('Done', 'تم', 'Listo') };
  const stCols = 'grid-template-columns:120px repeat(6,minmax(0,1fr));column-gap:16px;align-items:center;';
  const states = ['rest', 'hover', 'press', 'focus', 'disabled', 'busy'];
  const stNames = { rest: k('Rest', 'عادي', 'Reposo'), hover: k('Hover', 'تمرير', 'Hover'), press: k('Press', 'ضغط', 'Pulsar'), focus: k('Focus', 'تركيز', 'Foco'), disabled: k('Disabled', 'معطّل', 'Deshabilitado'), busy: k('Busy', 'قيد التنفيذ', 'Ocupado') };
  const head = `<div style="display:grid;${stCols}"><span></span>${states.map((s) => cap(stNames[s])).join('')}</div>`;
  const variants = [['primary', k('Primary', 'أساسي', 'Primario')], ['secondary', k('Secondary', 'ثانوي', 'Secundario')], ['ghost', k('Ghost', 'شفاف', 'Fantasma')], ['danger', k('Danger', 'خطر', 'Peligro')]];
  const btnMatrix = panel(col(20, head + variants.map(([v, n]) => `<div style="display:grid;${stCols}"><span style="font-size:14px">${n}</span>${states.map((s) => `<div>${btn(V.Continue, v, s)}</div>`).join('')}</div>`).join('')));
  const sizes = panel(row(32, `<div style="display:flex;flex-direction:column;gap:8px">${cap('md · h-control 44')}${btn(V.Continue, 'primary', 'rest', 'md')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap('lg · h-action 56')}${btn(k('Continue to travelers', 'تابع إلى المسافرين', 'Continuar a viajeros'), 'primary', 'rest', 'lg')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap('bar · 72 × 200')}${btn(V.Search, 'primary', 'rest', 'bar', 'search')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap('docked · 56 × 160')}${btn(V.Search, 'primary', 'rest', 'docked', 'search')}</div>`, 'align-items:flex-end;flex-wrap:wrap'));

  // Links
  const lnk = (t, hover) => `<a href="#" style="font-size:16px;line-height:{{lhB}};color:${C.teal};text-decoration:${hover ? 'underline' : 'none'};text-decoration-color:${C.gold};text-decoration-thickness:1px;text-underline-offset:4px">${t}</a>`;
  const inl = (t, hover) => `<a href="#" style="color:${C.teal};text-decoration:underline;text-decoration-color:${hover ? C.gold : C.teal};text-decoration-thickness:1px;text-underline-offset:4px">${t}</a>`;
  const links = grid(2, 24,
    panel(col(16, cap(k('Standalone link', 'رابط مستقل', 'Enlace independiente')) + row(32, `<div style="display:flex;flex-direction:column;gap:4px">${cap(k('Rest', 'عادي', 'Reposo'))}${lnk(k('Back to stay', 'العودة إلى الإقامة', 'Volver a la estancia'), false)}</div><div style="display:flex;flex-direction:column;gap:4px">${cap(k('Hover: 1px gold underline', 'تمرير: تسطير ذهبي ١ بكسل', 'Hover: subrayado dorado de 1 px'))}${lnk(k('Back to stay', 'العودة إلى الإقامة', 'Volver a la estancia'), true)}</div>`))) +
    panel(col(16, cap(k('Link in a sentence', 'رابط داخل جملة', 'Enlace en una frase')) + `<p style="margin:0;font-size:16px;line-height:{{lhB}}">${k('Need a change? ', 'هل تحتاج إلى تغيير؟ ', '¿Necesitas un cambio? ')}${inl(k('Edit search', 'عدّل البحث', 'Editar búsqueda'), false)}</p><p style="margin:0;font-size:16px;line-height:{{lhB}}">${k('Need a change? ', 'هل تحتاج إلى تغيير؟ ', '¿Necesitas un cambio? ')}${inl(k('Edit search', 'عدّل البحث', 'Editar búsqueda'), true)} ${cap(k('(hover)', '(تمرير)', '(hover)'))}</p>`)));

  // Fields
  const field = (label, value, state, extraRight = '', ph = false) => {
    const bd = state === 'error' ? C.error : state === 'disabled' ? C.line : C.ink;
    const bg = state === 'disabled' ? C.ivory : C.surface;
    const fg = state === 'disabled' ? C.muted : ph ? C.muted : C.ink;
    const focus = state === 'focus' ? FOCUS : '';
    return `<div style="display:flex;flex-direction:column;gap:8px">${lab(label)}
<div style="display:flex;align-items:center;height:44px;box-sizing:border-box;background:${bg};border:1px solid ${bd};${focus}"><span style="flex:1;min-width:0;padding:0 16px;font-size:14px;color:${fg}">${value}</span>${extraRight}</div>
${state === 'error' ? `<div role="alert" style="display:flex;align-items:center;gap:8px;color:${C.error};font-size:14px;line-height:{{lhL}}">${icon('alert-circle', 20, C.error)}<span>${k('Enter a date as DD/MM/YYYY.', 'أدخل التاريخ بصيغة يوم/شهر/سنة.', 'Escribe la fecha como DD/MM/AAAA.')}</span></div>` : ''}</div>`;
  };
  const eye = (off) => `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.teal}">${icon(off ? 'eye-off' : 'eye', 20, C.teal)}</span>`;
  const NAME = k('Name', 'الاسم', 'Nombre');
  const GUEST = k('[Guest name]', '[اسم الضيف]', '[Nombre del huésped]');
  const fields = grid(4, 24,
    field(NAME, GUEST, 'rest') + field(NAME, GUEST, 'focus') + field(k('Arrival date', 'تاريخ الوصول', 'Fecha de llegada'), '32/13/2026', 'error') + field(NAME, GUEST, 'disabled') +
    field(k('Password', 'كلمة المرور', 'Contraseña'), '••••••••', 'rest', eye(false)) + field(k('Password', 'كلمة المرور', 'Contraseña'), '[Password]', 'rest', eye(true)) +
    `<div style="grid-column: span 2;display:flex;align-items:flex-end">${cap(k('Password: the show and hide eye sits at the inline end and flips with the language. Inputs are 16px below md and 14px from md.', 'كلمة المرور: عين الإظهار والإخفاء عند نهاية السطر وتنقلب مع اللغة. حجم الحقول ١٦ بكسل دون md و١٤ من md.', 'Contraseña: el ojo de mostrar y ocultar va al final de la línea y se invierte con el idioma. Campos de 16 px bajo md y 14 px desde md.'))}</div>`);

  // LocaleSelect
  const trig = (code_, style = '', tone) => `<span style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${tone === 'image' ? 'rgba(255,250,240,0.7)' : C.muted};color:${tone === 'image' ? C.ivory : C.ink};font-size:12px;${UPPER}${style}"><bdi>${code_}</bdi>${icon('chevron-down', 12, 'currentColor')}</span>`;
  const opt = (t, sel) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;padding:0 16px;box-sizing:border-box;font-size:14px;background:${sel ? C.tealTint : C.surface};color:${sel ? C.teal : C.ink}"><span>${t}</span>${sel ? icon('check', 20, C.teal) : ''}</div>`;
  const locale = panel(row(48, `<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Rest', 'عادي', 'Reposo'))}${trig('EN')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Hover: border-ink', 'تمرير: حد داكن', 'Hover: borde tinta'))}${trig('EN', `border-color:${C.ink};`)}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Focus', 'تركيز', 'Foco'))}${trig('EN', FOCUS)}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Currency', 'العملة', 'Moneda'))}${trig('AED')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Open, selected', 'مفتوح، محدد', 'Abierto, seleccionado'))}${trig('AR')}<div style="width:220px;background:${C.surface};box-shadow:0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12)">${opt('English', false)}${opt('العربية', true)}${opt('Español', false)}</div></div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('On image', 'فوق صورة', 'Sobre imagen'))}<div style="position:relative;width:220px;height:88px;overflow:hidden"><img src="${HERO_IMG}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"><div style="position:relative;padding:22px 16px">${trig('EN', '', 'image')}</div></div></div>`, 'align-items:flex-start;flex-wrap:wrap'));

  // Checkbox and switch
  const box = (state, on) => {
    const bg = on ? C.teal : C.surface; const bd = state === 'disabled' ? C.line : on ? C.teal : C.ink;
    return `<span style="display:flex;align-items:center;gap:12px;min-height:44px"><span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;box-sizing:border-box;background:${state === 'disabled' ? C.ivory : bg};border:1px solid ${bd};${state === 'focus' ? FOCUS : ''}">${on ? icon('check', 16, state === 'disabled' ? C.muted : C.ivory) : ''}</span><span style="font-size:14px;color:${state === 'disabled' ? C.muted : C.ink}">${k('[Option label]', '[تسمية الخيار]', '[Etiqueta de la opción]')}</span></span>`;
  };
  const sw = (state, on) => {
    const trackBg = on ? C.teal : C.surface; const bd = state === 'disabled' ? C.line : on ? C.teal : C.ink;
    const thumb = state === 'disabled' ? C.line : on ? C.ivory : C.ink;
    return `<span style="display:flex;align-items:center;gap:12px;min-height:44px"><span style="display:flex;align-items:center;justify-content:${on ? 'flex-end' : 'flex-start'};width:44px;height:24px;padding:3px;box-sizing:border-box;background:${state === 'disabled' ? C.ivory : trackBg};border:1px solid ${bd};${state === 'focus' ? FOCUS : ''}"><span style="width:16px;height:16px;background:${thumb};display:block"></span></span><span style="font-size:14px;color:${state === 'disabled' ? C.muted : C.ink}">${k('[Option label]', '[تسمية الخيار]', '[Etiqueta de la opción]')}</span></span>`;
  };
  const checks = grid(2, 24,
    panel(col(4, cap('Checkbox · off, hover, focus, on, disabled') + `<div style="display:flex;flex-wrap:wrap;gap:8px 32px">${box('rest', false)}${box('focus', false)}${box('rest', true)}${box('disabled', false)}</div>`)) +
    panel(col(4, cap('Switch · off, focus, on, disabled') + `<div style="display:flex;flex-wrap:wrap;gap:8px 32px">${sw('rest', false)}${sw('focus', false)}${sw('rest', true)}${sw('disabled', false)}</div>`)));

  // ToggleCard
  const tc = (title, detail, amount, state) => {
    const on = state === 'on';
    const bg = state === 'hover' ? C.ivory : C.surface;
    const bd = on ? C.teal : state === 'disabled' ? C.line : C.muted;
    return `<button type="button" aria-pressed="${on ? 'true' : 'false'}"${state === 'disabled' ? ' disabled' : ''} style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;text-align:start;min-height:44px;padding:16px;box-sizing:border-box;background:${bg};border:1px solid ${bd};${on ? `box-shadow:inset 0 0 0 2px ${C.teal};` : ''}${state === 'focus' ? FOCUS : ''}font-family:inherit;cursor:pointer;width:100%">
<span style="display:flex;flex-direction:column;gap:4px"><span style="font-family:{{fd}};font-size:20px;line-height:{{lhT}};color:${state === 'disabled' ? C.muted : C.teal}">${title}</span><span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${detail}</span>${amount ? `<span style="font-size:16px;font-variant-numeric:tabular-nums;color:${C.ink}"><bdi>AED [AMOUNT]</bdi></span>` : ''}</span>${on ? icon('check', 20, C.teal) : ''}</button>`;
  };
  const DEP = k('Deposit', 'دفعة مقدّمة', 'Depósito'); const FULL = k('Full payment', 'دفع كامل', 'Pago completo'); const DET = k('[Detail line]', '[سطر التفاصيل]', '[Línea de detalle]');
  const err = (t) => `<div role="alert" style="display:flex;align-items:center;gap:8px;color:${C.error};font-size:14px;line-height:{{lhL}}">${icon('alert-circle', 20, C.error)}<span>${t}</span></div>`;
  const toggles = grid(3, 24,
    col(12, cap(k('Group · none on, then Continue pressed', 'مجموعة · لا شيء مفعّل ثم الضغط على متابعة', 'Grupo · ninguna activa, tras pulsar Continuar')) + `<div role="group" aria-label="${k('Payment', 'الدفع', 'Pago')}" style="display:flex;flex-direction:column;gap:12px">${tc(DEP, DET, true, 'off')}${tc(FULL, DET, true, 'off')}</div>` + err(k('Choose deposit or full payment to continue.', 'اختر دفعة مقدّمة أو دفعًا كاملًا للمتابعة.', 'Elige depósito o pago completo para continuar.'))) +
    col(12, cap(k('Group · one on', 'مجموعة · واحد مفعّل', 'Grupo · una activa')) + `<div role="group" aria-label="${k('Payment', 'الدفع', 'Pago')}" style="display:flex;flex-direction:column;gap:12px">${tc(DEP, DET, true, 'on')}${tc(FULL, DET, true, 'off')}</div>`) +
    col(12, cap(k('UAE airport · one at a time', 'مطار الإمارات · واحد في كل مرة', 'Aeropuerto EAU · uno a la vez')) + `<div role="group" aria-label="${k('UAE airport', 'مطار الإمارات', 'Aeropuerto EAU')}" style="display:flex;flex-direction:column;gap:12px">${tc('Dubai · DXB', '', false, 'on')}${tc('Abu Dhabi · AUH', '', false, 'off')}</div>` + err(k('Choose your UAE airport to continue.', 'اختر مطارك في الإمارات للمتابعة.', 'Elige tu aeropuerto de los EAU para continuar.'))) +
    col(12, cap(k('Single card states', 'حالات البطاقة الواحدة', 'Estados de una tarjeta')) + `<div style="display:flex;flex-direction:column;gap:12px">${tc(DEP, '', false, 'hover')}${tc(DEP, '', false, 'focus')}${tc(DEP, '', false, 'disabled')}</div>`));

  // FilterChip
  const chip = (t, on, hover, focus, first) => `<button type="button" aria-pressed="${on ? 'true' : 'false'}" style="height:40px;padding:0 16px;box-sizing:border-box;margin-inline-start:${first ? 0 : -1}px;background:${on ? (hover ? C.tealHover : C.teal) : hover ? C.ivory : 'transparent'};color:${on ? C.ivory : C.ink};border:1px solid ${on ? C.teal : C.muted};font:400 14px {{fb}};${focus ? FOCUS : ''}cursor:pointer;position:relative">${t}</button>`;
  const ALL = k('All', 'الكل', 'Todo'); const EXP = k('Experiences', 'التجارب', 'Experiencias'); const SRV = k('Services', 'الخدمات', 'Servicios');
  const chips = panel(row(48, `<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Joined row · All on', 'صف متصل · «الكل» مفعّل', 'Fila unida · «Todo» activo'))}<div role="group" aria-label="${k('Filter', 'تصفية', 'Filtro')}" style="display:flex">${chip(ALL, true, false, false, true)}${chip(EXP, false)}${chip(SRV, false)}</div></div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Hover off · hover on · focus', 'تمرير مفعّل · تمرير غير مفعّل · تركيز', 'Hover apagado · hover activo · foco'))}<div style="display:flex;gap:16px">${chip(EXP, false, true, false, true)}${chip(ALL, true, true, false, true)}${chip(SRV, false, false, true, true)}</div></div>
${cap(k('40px visible, 44px hit area.', 'ارتفاع ٤٠ بكسل ظاهر ومنطقة لمس ٤٤.', '40 px visibles, área táctil de 44 px.'))}`, 'align-items:flex-end;flex-wrap:wrap'));

  // Stepper
  const sb = (glyph, state) => `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;box-sizing:border-box;background:${state === 'hover' ? C.ivory : C.surface};border:1px solid ${state === 'disabled' ? C.line : C.teal};color:${state === 'disabled' ? C.muted : C.teal};${state === 'focus' ? FOCUS : ''}">${icon(glyph, 16, 'currentColor')}</span>`;
  const stepper = (n, minusState, plusState) => `<span style="display:inline-flex;align-items:center">${sb('minus', minusState)}<span aria-live="polite" style="width:28px;text-align:center;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:${C.ink}">${n}</span>${sb('plus', plusState)}</span>`;
  const steppers = panel(row(48, `<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Rest', 'عادي', 'Reposo'))}${stepper(2, 'rest', 'rest')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Hover plus', 'تمرير على زائد', 'Hover en más'))}${stepper(2, 'rest', 'hover')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('Focus', 'تركيز', 'Foco'))}${stepper(2, 'rest', 'focus')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('At floor: minus disabled', 'عند الحد الأدنى: ناقص معطّل', 'En el mínimo: menos deshabilitado'))}${stepper(1, 'disabled', 'rest')}</div>
<div style="display:flex;flex-direction:column;gap:8px">${cap(k('At max: plus disabled and a reason', 'عند الحد الأقصى: زائد معطّل مع السبب', 'En el máximo: más deshabilitado y motivo'))}<div style="display:flex;align-items:center;gap:12px">${stepper(4, 'rest', 'disabled')}${cap(k('One per guest', 'واحد لكل ضيف', 'Uno por huésped'))}</div></div>`, 'align-items:flex-start;flex-wrap:wrap'));

  // DayCell
  const day = (n, style, label) => `<div style="display:flex;flex-direction:column;gap:8px;align-items:stretch"><span style="display:flex;align-items:center;justify-content:center;height:44px;box-sizing:border-box;font-size:14px;font-variant-numeric:tabular-nums;${style}">${n}</span>${cap(label)}</div>`;
  const days = panel(grid(9, 4,
    day(12, `background:${C.surface};color:${C.ink};`, k('Default', 'عادي', 'Normal')) +
    day(13, `background:${C.surface};color:${C.ink};box-shadow:inset 0 0 0 1px ${C.teal};`, k('Hover', 'تمرير', 'Hover')) +
    day(14, `background:${C.teal};color:${C.ivory};font-weight:700;`, k('Arrive', 'وصول', 'Llegada')) +
    day(15, `background:${C.tealTint};color:${C.ink};`, k('In range', 'ضمن المدة', 'En rango')) +
    day(16, `background:${C.tealTint};color:${C.ink};`, k('In range', 'ضمن المدة', 'En rango')) +
    day(17, `background:${C.teal};color:${C.ivory};font-weight:700;`, k('Leave', 'مغادرة', 'Salida')) +
    day(9, `background:${C.surface};color:${C.muted};`, k('Past', 'ماضٍ', 'Pasado')) +
    day(10, `background:${C.surface};color:${C.ink};box-shadow:inset 0 -2px 0 ${C.teal};`, k('Today', 'اليوم', 'Hoy')) +
    day(11, `background:${C.surface};color:${C.ink};${FOCUS}`, k('Focus', 'تركيز', 'Foco'))));

  const bodyHtml = header(k,
    k('ALMAR design system · Components · 1 of 2', 'نظام تصميم ألمار · المكوّنات · ١ من ٢', 'Sistema de diseño ALMAR · Componentes · 1 de 2'),
    k('Controls', 'عناصر التحكم', 'Controles'),
    k('Every control in every state that can apply. Square corners, teal primary, gold only as lines. Hover darkens, press darkens more, nothing lifts.', 'كل عنصر تحكم في كل حالة ممكنة. زوايا مستقيمة وأخضر مزرق أساسي والذهبي خطوط فقط. التمرير يُغمّق والضغط يُغمّق أكثر ولا شيء يرتفع.', 'Cada control en cada estado posible. Esquinas cuadradas, primario verde azulado, dorado solo en líneas. Hover oscurece, pulsar oscurece más y nada se eleva.')) +
    section(k('Button', 'الزر', 'Botón'), k('Labels are uppercase with tracking in Latin and sentence case in Arabic. The journey Search button is never disabled.', 'التسميات بأحرف كبيرة في اللاتينية وبصيغة الجملة في العربية. زر البحث في الرحلة لا يُعطّل أبدًا.', 'Las etiquetas van en mayúsculas en latino y en forma de oración en árabe. El botón Buscar del viaje nunca se deshabilita.'), btnMatrix + sizes) +
    section(k('Link', 'الرابط', 'Enlace'), '', links) +
    section(k('Field and password', 'الحقل وكلمة المرور', 'Campo y contraseña'), '', fields) +
    section(k('Language and currency select', 'محدد اللغة والعملة', 'Selector de idioma y moneda'), k('One component, two instances. It works in the header, /account and dashboard Settings.', 'مكوّن واحد بنسختين. يعمل في الترويسة وصفحة الحساب وإعدادات لوحة التحكم.', 'Un componente, dos instancias. Funciona en la cabecera, /account y los ajustes del panel.'), locale) +
    section(k('Checkbox and switch', 'مربع الاختيار والمفتاح', 'Casilla e interruptor'), '', checks) +
    section(k('Toggle card', 'بطاقة التبديل', 'Tarjeta conmutable'), k('A square button with aria-pressed. One on at a time. There is no radio control anywhere.', 'زر مربع مع aria-pressed. واحد فقط مفعّل في كل مرة. لا توجد أزرار اختيار دائرية في أي مكان.', 'Botón cuadrado con aria-pressed. Solo una activa a la vez. No hay radios en ningún sitio.'), toggles) +
    section(k('Filter chip', 'رقاقة التصفية', 'Chip de filtro'), '', chips) +
    section(k('Stepper', 'عدّاد الأعداد', 'Contador'), '', steppers) +
    section(k('Calendar day', 'يوم التقويم', 'Día del calendario'), k('Arrive and leave are solid teal. Nights between are teal tint. No rings.', 'الوصول والمغادرة أخضر مزرق كامل، والليالي بينهما بلون فاتح. بلا حلقات.', 'Llegada y salida en verde azulado sólido. Las noches intermedias en tinte. Sin anillos.'), days);
  return { bodyHtml, w: 1440, h: 6000, title: 'Components · Controls' };
}
