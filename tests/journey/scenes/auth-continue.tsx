import { ContinueScreen } from "../../../app/auth/confirm/continue-screen";
import type { Scenes } from "../scene-types";

/**
 * Plan 02-24: the page the sign-in link opens. `signed` shows the masked email; `no-email` the plain line.
 * Plan 02-26: `email-ask` (link opened in another browser) adds the email field; `email-wrong` shows the error line.
 */
export const scenes: Scenes = {
  signed: ({ locale }) => (
    <ContinueScreen initialLocale={locale} maskedEmail="l•••@gmail.com" tokenHash="harness-token" type="magiclink" />
  ),
  "no-email": ({ locale }) => <ContinueScreen initialLocale={locale} tokenHash="harness-token" type="magiclink" />,
  "email-ask": ({ locale }) => (
    <ContinueScreen initialLocale={locale} maskedEmail="l•••@gmail.com" tokenHash="harness-token" type="magiclink" askEmail />
  ),
  "email-wrong": ({ locale }) => (
    <ContinueScreen
      initialLocale={locale}
      maskedEmail="l•••@gmail.com"
      tokenHash="harness-token"
      type="magiclink"
      askEmail
      initialWrong
      initialEmail="lina@example.com"
    />
  ),
};
