// Plan 03.2-15: the three owner routes behind the stay editor's Rates, Availability and Access cards, faked for specs
// that open a saved stay but are not about those cards (tests/ops-stays.spec.ts, 03.2-07). GET only, bracket values
// (the owner types every rate: no real amount), no blocks; every other request goes on. The cards' own spec,
// tests/ops-stay-tabs.spec.ts, has the full fixtures and the POST answers.
import type { Page, Route } from "@playwright/test";

type Locale = "en" | "ar" | "es";

const BRACKET: Record<Locale, { price: string; address: string; wifi: string; password: string; door: string; notes: string }> = {
  en: { price: "[PRICE]", address: "[Address]", wifi: "[Wi-Fi name]", password: "[Wi-Fi password]", door: "[Door code]", notes: "[Notes]" },
  ar: { price: "[السعر]", address: "[العنوان]", wifi: "[اسم شبكة Wi-Fi]", password: "[كلمة المرور]", door: "[رمز الباب]", notes: "[ملاحظات]" },
  es: { price: "[PRECIO]", address: "[Dirección]", wifi: "[Nombre del Wi-Fi]", password: "[Contraseña]", door: "[Código]", notes: "[Notas]" },
};

const reply = (route: Route, json: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

const stayIdOf = (route: Route) => new URL(route.request().url()).searchParams.get("stay_id");

/** Answers GET /api/ops/stay-rates, /api/ops/blocks and /api/ops/stay-access for any stay. */
export async function routeStayTabs(page: Page, locale: Locale) {
  const b = BRACKET[locale];
  await page.route(/\/api\/ops\/stay-rates(\?.*)?$/, (route) =>
    route.request().method() === "GET" ? reply(route, { ok: true, stay_id: stayIdOf(route), base_nightly_rate_aed: b.price, ranges: [] }) : route.fallback(),
  );
  await page.route(/\/api\/ops\/blocks(\?.*)?$/, (route) => (route.request().method() === "GET" ? reply(route, { ok: true, blocks: [] }) : route.fallback()));
  await page.route(/\/api\/ops\/stay-access(\?.*)?$/, (route) =>
    route.request().method() === "GET"
      ? reply(route, {
          ok: true,
          stay_id: stayIdOf(route),
          access: { address: b.address, wifi_name: b.wifi, wifi_password: b.password, door_code: b.door, notes: b.notes, notes_ar: null, notes_es: null, updated_at: "2026-10-01T00:00:00Z" },
        })
      : route.fallback(),
  );
}
