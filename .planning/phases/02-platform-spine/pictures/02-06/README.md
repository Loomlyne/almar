# 02-06 pictures: Settings and the maintenance page (for the owner's signature)

Static mock (`index.html`, no app code), shot by `shoot.mjs` at 390, 834 and 1440 in EN, AR (RTL) and ES.
File names: `<view>-<width>-<lang>.png`. Colours, sizes and square corners come from `tokens.json`.
The small dashed tag in the corner of each picture ("DRAFT 02-06 …") is only on the mock.

| View | What it shows |
|------|---------------|
| `settings-*` | Ops host `/settings` as it opens: five brand colours (Teal, Charcoal, Gold, Ivory, White) as square swatches with their hex, Title face Questa, Body face Lato, VAT 5.00 and deposit 30.00, the daily FX rate as text (no input), the Maintenance checkbox off, the logo well with the current wordmark and Upload, her language and currency, Save disabled (nothing changed yet). |
| `settings-error-*` | She picked a pale teal (#9fb8bb) and typed VAT 5.125: `The contrast is too low.` under Teal, `Use two decimal places.` under VAT, Save stays disabled. |
| `settings-saved-*` | After Save: Maintenance is on, a saved square logo (the AM monogram, as an example) with `Remove logo`, and the line `Settings saved.`; Save is disabled again until the next change. |
| `maintenance-*` | Public site while maintenance is on (every public page, `/login` too): wordmark, language and currency, the locked line at heading size, gold hairline, the phone and email as real links. No form, no button, no WhatsApp, no Sign in, no link to the dashboard. |

## Text

From the 02-UI-SPEC string table or the shipped dashboard copy (unchanged): Settings, Maintenance is on, Save,
Settings saved., The contrast is too low., Use two decimal places., Remove logo, Upload, FX rate, the maintenance line
in EN/AR/ES (`ALMAR Private Journey is closed for a short time.` / `ALMAR Private Journey مغلقة لوقت قصير.` /
`ALMAR Private Journey está cerrado por un momento.`), the rail names.

**DRAFT, new, for the owner to correct** (EN / AR / ES):

| Where | EN | AR | ES |
|-------|----|----|----|
| Group | Brand colors | ألوان العلامة | Colores de marca |
| Colour names | Teal, Charcoal, Gold, Ivory, White | أخضر مزرق، فحمي، ذهبي، عاجي، أبيض | Verde azulado, Carbón, Dorado, Marfil, Blanco |
| Under Gold | Gold is used for lines only. | يُستخدم الذهبي للخطوط فقط. | El dorado se usa solo en líneas. |
| Group | Type | الخطوط | Tipografía |
| Fields | Title face / Body face | خط العناوين / خط النص | Fuente de títulos / Fuente de texto |
| Under faces | Arabic keeps Noto Naskh Arabic and Noto Sans Arabic. | تبقى العربية بخطَّي Noto Naskh Arabic وNoto Sans Arabic. | El árabe conserva Noto Naskh Arabic y Noto Sans Arabic. |
| Group | VAT and deposit | الضريبة والعربون | IVA y depósito |
| Fields | VAT percent / Deposit percent | نسبة ضريبة القيمة المضافة / نسبة العربون | Porcentaje de IVA / Porcentaje de depósito |
| Under FX | Updated daily. Not editable. | يُحدَّث يومياً. غير قابل للتعديل. | Se actualiza a diario. No se puede editar. |
| Under Maintenance | When saved, the public site shows the closed page. This dashboard stays open. | بعد الحفظ، يعرض الموقع العام صفحة الإغلاق. وتبقى لوحة التحكم هذه مفتوحة. | Al guardar, el sitio público muestra la página de cierre. Este panel sigue abierto. |
| Under Upload | PNG, JPEG or WebP, square, up to 1 MB | PNG أو JPEG أو WebP، مربع، حتى 1 ميغابايت | PNG, JPEG o WebP, cuadrado, hasta 1 MB |
| Group | Your language and currency | لغتك وعملتك | Su idioma y moneda |
| Fields | Language / Currency | اللغة / العملة | Idioma / Moneda |
| Spanish two-decimals line | (spec: `Usa dos decimales.`) | | `Use dos decimales.` (usted, like the media copy) |

No legal text, price or rate is invented. The FX numbers in the pictures are examples; the page shows the live daily feed.

## Differences from the 2026-09 plan (the pictures follow today's design system)

1. **Save is the teal primary button, not gold.** 02-UI-SPEC says gold fill; the design system since 3.1 says primary
   is teal and gold is lines only. The pictures use teal.
2. **Gold has no contrast check.** It is never text or a fill any more, so no required pair uses it. The pairs checked
   are: Teal and Charcoal as text on Ivory and White, Ivory text on Teal (button label) and on Charcoal (menu), and the
   fixed muted and error text on her Ivory and White.

## Sign-in email (round 3, owner answer 2026-10-13)

`email-default-{en,ar,es}.png` and `email-saved-teal-{en,ar,es}.png`: the real `lib/email/magic-link.ts` at 600 px, with
the design system's brand and with a saved Teal `#2b4f56`. The button is Teal fill, White text; no Gold fill anywhere.
The ops sign-in email uses the same renderer and copy. Run `node .planning/phases/02-platform-spine/pictures/02-06/shoot-email.mjs`.
