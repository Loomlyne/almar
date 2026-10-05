import { AccountScreen } from "../../../app/account/account-screen";
import { BookingsScreen } from "../../../app/bookings/bookings-screen";
import type { SessionProfile } from "../../../lib/supabase/clients";
import type { Scenes } from "../scene-types";

/** A signed-in guest, for the session-gated /account and /bookings screens. Saving has no Supabase here. */
const guest = (locale: SessionProfile["locale"]): SessionProfile => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: "guest@example.com",
  firstName: "Layla",
  lastName: "Haddad",
  phone: "+971500000000",
  locale,
  currency: "AED",
  role: "guest",
});

const account = { name: "Layla Haddad", email: "guest@example.com" };

export const scenes: Scenes = {
  hub: ({ locale }) => <AccountScreen profile={guest(locale)} account={account} />,
  bookings: ({ locale }) => <BookingsScreen initialLocale={locale} account={account} />,
};
