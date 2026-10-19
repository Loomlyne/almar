# 2026-10-19: sign-in form, option A

Owner's choice in work session `local_0187ed55` (Claude Code chat), 2026-10-19 at about 13:00 +0100: "Go with option A for the
sign-in redesign". He picked from three pictures drawn in that chat:
- A: aligned and anchored (the recommended one)
- B: white card on ivory
- C: editorial, underline field

Written on the branch at the controller's request.

1. **Option A: signed.** It changes only the sign-in form, on both hosts: the public `/login` and the dashboard `/sign-in`.
   - A small uppercase kicker sits above the heading. The heading is unchanged.
   - A 40px gold rule sits under the heading. Gold is a line only, as decided on 2026-09-28.
   - The email field is as wide as the button. Before, the field was 384px against a 432px button.
   - Under the button: "The link works once, for one hour." This matches live Supabase `mailer_otp_exp` = 3600 s and the
     single-use link.
2. **Kicker words.** The picture said "Owner dashboard". It is built as "Owner access", because
   `tests/phase-03-guest.test.mjs` keeps the word "dashboard" out of the public sign-in sources, which both hosts share.
   - Ops host: "Owner access" / "دخول المالك" / "Acceso del propietario".
   - Public host: "Your account" / "حسابك" / "Tu cuenta".
   - Link note: "The link works once, for one hour." / "يعمل الرابط مرة واحدة، لمدة ساعة." / "El enlace funciona una vez,
     durante una hora."
   - The guest-side Spanish uses tú, like the lines around it.
3. **Unchanged:** the "Check your email" state, the frame (picture, logo, language, contact line), and the button.

Built at `ffcb8d6` on `claude/sign-in-option-a`. The pictures of the built screens are for the owner to sign after the
controller's Mac run.
