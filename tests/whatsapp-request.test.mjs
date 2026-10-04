// Plan 03.3-45 task 1: the Request on WhatsApp message (11-DESIGN section 2) is one pure, tested function.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { buildStayRequestMessage, stayRequestHref, ALMAR_WHATSAPP_NUMBER } = await loadTs("lib/whatsapp-request.ts");
const { STAY_DETAIL_COPY } = await loadTs("lib/copy/stay-detail.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
const { absoluteLocaleUrl } = await loadTs("lib/locale-path.ts");
const { getStay } = await loadTs("lib/data/stays.ts");

const SLUG = "casa-jardin-san-diego";
const START = { year: 2026, month: 10, day: 12 };
const END = { year: 2026, month: 10, day: 15 };

async function build(locale, patch = {}) {
  const stay = await getStay(locale, SLUG);
  return buildStayRequestMessage(
    {
      locale,
      title: stay.title,
      destinationName: stay.destination_name,
      start: START,
      end: END,
      adults: 2,
      children: 1,
      infants: 0,
      pageUrl: absoluteLocaleUrl(locale, `/private-stays/${SLUG}`),
      ...patch,
    },
    STAY_DETAIL_COPY[locale].whatsapp,
    { nights: JOURNEY_COPY[locale].dates.nights, guests: JOURNEY_COPY[locale].guests.summary },
  );
}

const GOLDEN = {
  en: "Hello ALMAR, I would like to request Casa Jardín San Diego (Cartagena).\nDates: 12/10/2026 to 15/10/2026 (3 nights)\nGuests: 2 adults, 1 child\nhttps://almarprivatejourney.com/private-stays/casa-jardin-san-diego",
  ar: "مرحباً المار، أودّ طلب كاسا خاردين سان دييغو (كارتاخينا).\nالتواريخ: من 12/10/2026 إلى 15/10/2026 (3 ليالٍ)\nالضيوف: بالغان، طفل واحد\nhttps://almarprivatejourney.com/ar/private-stays/casa-jardin-san-diego",
  es: "Hola ALMAR, me gustaría solicitar Casa Jardín San Diego (Cartagena).\nFechas: del 12/10/2026 al 15/10/2026 (3 noches)\nHuéspedes: 2 adultos, 1 niño\nhttps://almarprivatejourney.com/es/private-stays/casa-jardin-san-diego",
};

const NO_DATES = {
  en: "Hello ALMAR, I would like to request Casa Jardín San Diego (Cartagena).\nDates: not chosen yet\nGuests: 1 adult\nhttps://almarprivatejourney.com/private-stays/casa-jardin-san-diego",
  ar: "مرحباً المار، أودّ طلب كاسا خاردين سان دييغو (كارتاخينا).\nالتواريخ: لم تُحدَّد بعد\nالضيوف: بالغ واحد\nhttps://almarprivatejourney.com/ar/private-stays/casa-jardin-san-diego",
  es: "Hola ALMAR, me gustaría solicitar Casa Jardín San Diego (Cartagena).\nFechas: aún sin elegir\nHuéspedes: 1 adulto\nhttps://almarprivatejourney.com/es/private-stays/casa-jardin-san-diego",
};

for (const locale of ["en", "ar", "es"]) {
  test(`golden message with dates (${locale})`, async () => {
    assert.equal(await build(locale), GOLDEN[locale]);
  });
  test(`golden message without dates, 1 adult (${locale})`, async () => {
    assert.equal(await build(locale, { start: null, end: null, adults: 1, children: 0 }), NO_DATES[locale]);
  });
}

test("one night uses the one form; three groups give three parts; one group gives one part", async () => {
  const one = await build("en", { end: { year: 2026, month: 10, day: 13 } });
  assert.match(one, /\(1 night\)/);
  const three = await build("en", { adults: 2, children: 1, infants: 1 });
  assert.match(three, /Guests: 2 adults, 1 child, 1 infant\n/);
  const single = await build("en", { adults: 1, children: 0, infants: 0 });
  assert.match(single, /Guests: 1 adult\n/);
});

test("a window that crosses a month end counts its nights", async () => {
  const m = await build("en", { start: { year: 2026, month: 10, day: 30 }, end: { year: 2026, month: 11, day: 2 } });
  assert.match(m, /30\/10\/2026 to 02\/11\/2026 \(3 nights\)/);
});

test("stayRequestHref: number, encoding, newline, and escaped & # ?", async () => {
  assert.equal(ALMAR_WHATSAPP_NUMBER, "971563883302");
  const message = await build("en", { title: "A & B #1 ?" });
  const href = stayRequestHref(message);
  assert.ok(href.startsWith("https://wa.me/971563883302?text="));
  const text = href.slice("https://wa.me/971563883302?text=".length);
  assert.equal(decodeURIComponent(text), message);
  assert.ok(text.includes("%0A"));
  assert.ok(!/[&#? ]/.test(text), "no raw & # ? or space in the text parameter");
  assert.ok(text.includes("%26") && text.includes("%23") && text.includes("%3F"));
});

test("the module imports nothing from lib/data, React or the browser", () => {
  const source = readFileSync("lib/whatsapp-request.ts", "utf8");
  const imports = [...source.matchAll(/^import .* from "(.*)";/gm)].map((m) => m[1]);
  for (const from of imports) assert.match(from, /^\.\/(format|journey-format)$/, from);
  assert.doesNotMatch(source, /\b(window|document|navigator|localStorage)\b/);
});
