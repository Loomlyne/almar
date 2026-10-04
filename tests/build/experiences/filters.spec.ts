import { filterCatalog } from "../../../lib/data/catalog-filter";
import { formatPlural } from "../../../lib/journey-format";
import {
  LG,
  LOCALES,
  LOCKED,
  LOCKED_EXPERIENCES,
  LOCKED_SANTA_FE,
  LOCKED_SERVICES,
  LOCKED_TOTAL,
  VIEWPORTS,
  cards,
  checkbox,
  checkboxGroup,
  chipButton,
  clearButtons,
  closeSheet,
  countLine,
  data,
  dialog,
  escapeRegExp,
  expect,
  expectedNames,
  filtersButton,
  groupHeads,
  openSheet,
  search,
  searchBox,
  test,
  titlesOf,
  typeButton,
  visit,
  withChecks,
  type Data,
} from "./_helpers";
import type { Page } from "@playwright/test";

// Phase 3.3 plan 14, task 7. Every filter control of the React /experiences page clicked on the assembled out/, in EN, AR and
// ES at 390, 834 and 1440, with the result asserted: the cards, their order, the count line, the group heads, the address.
// Expected values come from the data layer and the one filterCatalog, never from the page. Below 1024px the checkboxes live in
// the Filters sheet, so each change opens it, acts, reads "Show N options" and closes it; at 1440 they are in the rail.
//   node scripts/assemble-cloudflare.mjs --target=local
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/experiences/filters.spec.ts --workers=1

const SANTA_FE = "santa-fe-farm-antioquia";
const CARTAGENA_STAY = "getsemani-colonial-house";
type Filter = Parameters<typeof filterCatalog>[1];

/** The cards, their order and the count line all equal what the one rule leaves; returns how many that is. */
async function expectList(page: Page, d: Data, filter: Filter, why: string): Promise<number> {
  const want = expectedNames(d, filter);
  await expect.poll(() => titlesOf(page), { message: `card names ${why}` }).toEqual(want);
  await expect(countLine(page), `count line ${why}`).toHaveText(formatPlural(d.copy.count, want.length, d.locale));
  return want.length;
}

const kindCount = (d: Data, kind: "experience" | "service") => filterCatalog(d.items, { kind }).length;
const stayName = (d: Data, slug: string) => d.stayNames[slug];
const removePrefix = (d: Data) => d.copy.removeFilter.split("{name}")[0];
const anyChip = (page: Page, d: Data) => page.getByRole("button", { name: new RegExp(`^${escapeRegExp(removePrefix(d))}`) });

/** A word of the yacht item's own name in this language, so the live search has a real hit in AR and ES too. */
function searchWord(d: Data): string {
  if (d.locale === "en") return "yacht";
  const item = d.items.find((i) => i.slug === "yacht-island-charters");
  if (!item) throw new Error("yacht-island-charters is not in the catalogue");
  return item.name.split(/\s+/).sort((a, b) => b.length - a.length)[0];
}

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    const W = viewport.width;
    test.describe(`${locale} ${W}`, () => {
      test.use({ viewport });

      test("1. initial: 45 cards, group heads 35 and 10, count line, All pressed, no chip, no Clear, no query", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        expect(d.items).toHaveLength(LOCKED_TOTAL);
        await expect(cards(page)).toHaveCount(LOCKED_TOTAL);
        expect(await groupHeads(page)).toEqual([
          { name: d.copy.groups.experiences, count: String(LOCKED_EXPERIENCES) },
          { name: d.copy.groups.services, count: String(LOCKED_SERVICES) },
        ]);
        await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, LOCKED_TOTAL, locale));
        await expect(typeButton(page, d, "all")).toHaveAttribute("aria-pressed", "true");
        await expect(typeButton(page, d, "experience")).toHaveAttribute("aria-pressed", "false");
        await expect(typeButton(page, d, "service")).toHaveAttribute("aria-pressed", "false");
        await expect(anyChip(page, d)).toHaveCount(0);
        await expect(clearButtons(page, d)).toHaveCount(0);
        expect(search(page)).toBe("");
        expect(await titlesOf(page)).toEqual(expectedNames(d, {}));
      });

      test("2. search: live, accent- and case-folded, never in the address; no match shows the empty state and one Clear", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);

        const word = searchWord(d);
        await searchBox(page, d).fill(word);
        const n = await expectList(page, d, { query: word }, `for "${word}"`);
        expect(n).toBeGreaterThan(0);
        expect(search(page), "the search text is not in the address").toBe("");

        const folded = locale === "ar" ? d.destinationNames.medellin : "MEDELLIN";
        await searchBox(page, d).fill(folded);
        expect(await expectList(page, d, { query: folded }, `for "${folded}"`)).toBeGreaterThan(0);
        expect(search(page)).toBe("");

        await searchBox(page, d).fill("zzzz");
        await expect(cards(page)).toHaveCount(0);
        await expect(page.getByText(d.copy.empty, { exact: true })).toBeVisible();
        expect(await groupHeads(page), "both groups are gone").toEqual([]);
        await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, 0, locale));
        await expect(clearButtons(page, d), "exactly one Clear is visible").toHaveCount(1);
        expect(search(page)).toBe("");
      });

      test("3. type: Services 10, Experiences 35, All 45, each hiding the other group, with its address", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);

        await typeButton(page, d, "service").click();
        await expect(typeButton(page, d, "service")).toHaveAttribute("aria-pressed", "true");
        expect(await expectList(page, d, { kind: "service" }, "services")).toBe(LOCKED_SERVICES);
        expect(kindCount(d, "service")).toBe(LOCKED_SERVICES);
        expect(await groupHeads(page)).toEqual([{ name: d.copy.groups.services, count: String(LOCKED_SERVICES) }]);
        expect(search(page)).toBe("?type=service");

        await typeButton(page, d, "experience").click();
        await expect(typeButton(page, d, "experience")).toHaveAttribute("aria-pressed", "true");
        await expect(typeButton(page, d, "service")).toHaveAttribute("aria-pressed", "false");
        expect(await expectList(page, d, { kind: "experience" }, "experiences")).toBe(LOCKED_EXPERIENCES);
        expect(await groupHeads(page)).toEqual([{ name: d.copy.groups.experiences, count: String(LOCKED_EXPERIENCES) }]);
        expect(search(page)).toBe("?type=experience");

        // Pressing the pressed one does nothing; All is the way back.
        await typeButton(page, d, "experience").click();
        await expect(typeButton(page, d, "experience")).toHaveAttribute("aria-pressed", "true");
        await typeButton(page, d, "all").click();
        expect(await expectList(page, d, {}, "all")).toBe(LOCKED_TOTAL);
        expect(await groupHeads(page)).toHaveLength(2);
        expect(search(page)).toBe("");
      });

      test("4. destination: the five places one at a time (14, 11, 3, 1, 4), then two together", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);

        // The options are exactly the five locale names, in board order.
        await withChecks(page, d, W, () => LOCKED_TOTAL, async () => {
          const labels = await checkboxGroup(page, d, W, d.copy.destination.label).locator("label").allTextContents();
          expect(labels.map((t) => t.trim())).toEqual(d.destinations.map((x) => x.name));
          expect(d.destinations.map((x) => x.slug)).toEqual(Object.keys(LOCKED));
        });

        for (const [slug, want] of Object.entries(LOCKED)) {
          const name = d.destinationNames[slug];
          expect(filterCatalog(d.items, { destinations: [slug] }), `${slug} recomputed`).toHaveLength(want);
          await withChecks(page, d, W, () => want, async () => {
            await checkbox(page, d, W, name).check();
          });
          expect(await expectList(page, d, { destinations: [slug] }, `for ${slug}`)).toBe(want);
          expect(search(page)).toBe(`?destination=${slug}`);
          await withChecks(page, d, W, () => LOCKED_TOTAL, async () => {
            await checkbox(page, d, W, name).uncheck();
          });
          expect(await expectList(page, d, {}, `after ${slug} is unchecked`)).toBe(LOCKED_TOTAL);
          expect(search(page)).toBe("");
        }

        const both = ["cartagena", "medellin"];
        const bothCount = filterCatalog(d.items, { destinations: both }).length;
        await withChecks(page, d, W, () => bothCount, async () => {
          for (const slug of both) await checkbox(page, d, W, d.destinationNames[slug]).check();
        });
        expect(await expectList(page, d, { destinations: both }, "any of two places")).toBe(bothCount);
        expect(bothCount).toBeGreaterThan(LOCKED.cartagena);
        expect(search(page)).toBe("?destination=cartagena,medellin");
      });

      test("5. private stay: Santa Fe gives 6, a destination narrows the stay options and drops a stay it leaves out", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);

        await withChecks(page, d, W, () => LOCKED_SANTA_FE, async () => {
          await checkbox(page, d, W, stayName(d, SANTA_FE)).check();
        });
        expect(await expectList(page, d, { stays: [SANTA_FE] }, "Santa Fe")).toBe(LOCKED_SANTA_FE);
        expect(search(page)).toBe(`?stay=${SANTA_FE}`);

        // Checking Medellín narrows the stay options to the two Medellín stays, in order.
        const medellinStays = d.offeredStays.filter((s) => s.destination_slug === "medellin").map((s) => s.title);
        expect(medellinStays).toHaveLength(2);
        const narrowed = filterCatalog(d.items, { destinations: ["medellin"], stays: [SANTA_FE] }).length;
        await withChecks(page, d, W, () => narrowed, async () => {
          await checkbox(page, d, W, d.destinationNames.medellin).check();
          const labels = await checkboxGroup(page, d, W, d.copy.stay.label).locator("label").allTextContents();
          expect(labels.map((t) => t.trim())).toEqual(medellinStays);
        });
        expect(await expectList(page, d, { destinations: ["medellin"], stays: [SANTA_FE] }, "Medellín and Santa Fe")).toBe(narrowed);
        expect(search(page)).toBe(`?destination=medellin&stay=${SANTA_FE}`);

        // Back to nothing, then a Cartagena stay is dropped when only Medellín is checked.
        await withChecks(page, d, W, () => LOCKED_TOTAL, async () => {
          await checkbox(page, d, W, d.destinationNames.medellin).uncheck();
          await checkbox(page, d, W, stayName(d, SANTA_FE)).uncheck();
        });
        expect(await expectList(page, d, {}, "reset")).toBe(LOCKED_TOTAL);
        const medellinCount = filterCatalog(d.items, { destinations: ["medellin"] }).length;
        const withStay = filterCatalog(d.items, { stays: [CARTAGENA_STAY] }).length;
        await withChecks(page, d, W, () => medellinCount, async () => {
          await checkbox(page, d, W, stayName(d, CARTAGENA_STAY)).check();
          await expect(checkbox(page, d, W, stayName(d, CARTAGENA_STAY))).toBeChecked();
          expect(withStay).toBeGreaterThan(0);
          await checkbox(page, d, W, d.destinationNames.medellin).check();
          await expect(checkbox(page, d, W, stayName(d, CARTAGENA_STAY)), "a Cartagena stay is no longer offered").toHaveCount(0);
        });
        expect(await expectList(page, d, { destinations: ["medellin"] }, "only Medellín")).toBe(medellinCount);
        expect(search(page), "the dropped stay leaves the address").toBe("?destination=medellin");
      });

      test("6. chips: one per active filter; each × removes only its own", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const cartagena = d.destinationNames.cartagena;
        const stay = stayName(d, CARTAGENA_STAY);
        const full: Filter = { kind: "service", destinations: ["cartagena"], stays: [CARTAGENA_STAY] };

        await typeButton(page, d, "service").click();
        const fullCount = expectedNames(d, full).length;
        await withChecks(page, d, W, () => fullCount, async () => {
          await checkbox(page, d, W, cartagena).check();
          await checkbox(page, d, W, stay).check();
        });
        await expectList(page, d, full, "services + Cartagena + stay");
        await expect(anyChip(page, d)).toHaveCount(3);
        for (const name of [d.copy.type.services, cartagena, stay]) await expect(chipButton(page, d, name)).toBeVisible();
        expect(search(page)).toBe(`?type=service&destination=cartagena&stay=${CARTAGENA_STAY}`);

        await chipButton(page, d, d.copy.type.services).click();
        const noType: Filter = { destinations: ["cartagena"], stays: [CARTAGENA_STAY] };
        await expectList(page, d, noType, "the type chip removed");
        await expect(typeButton(page, d, "all")).toHaveAttribute("aria-pressed", "true");
        await expect(anyChip(page, d)).toHaveCount(2);
        expect(search(page)).toBe(`?destination=cartagena&stay=${CARTAGENA_STAY}`);

        await chipButton(page, d, cartagena).click();
        await expectList(page, d, { stays: [CARTAGENA_STAY] }, "the destination chip removed");
        await expect(anyChip(page, d)).toHaveCount(1);
        expect(search(page)).toBe(`?stay=${CARTAGENA_STAY}`);
        if (W >= LG) await expect(checkbox(page, d, W, cartagena), "the control follows the chip").not.toBeChecked();

        await chipButton(page, d, stay).click();
        expect(await expectList(page, d, {}, "the stay chip removed")).toBe(LOCKED_TOTAL);
        await expect(anyChip(page, d)).toHaveCount(0);
        expect(search(page)).toBe("");
        if (W >= LG) await expect(checkbox(page, d, W, stay)).not.toBeChecked();
      });

      test("7. Clear filters: search and filters reset, the address is the page path alone, focus on the search box", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await typeButton(page, d, "service").click();
        await searchBox(page, d).fill(searchWord(d));
        const cartagenaCount = filterCatalog(d.items, { kind: "service", destinations: ["cartagena"], query: searchWord(d) }).length;
        await withChecks(page, d, W, () => cartagenaCount, async () => {
          await checkbox(page, d, W, d.destinationNames.cartagena).check();
        });
        await expect(clearButtons(page, d), "exactly one Clear is visible").toHaveCount(1);
        expect(search(page)).toBe("?type=service&destination=cartagena");

        await clearButtons(page, d).click();
        expect(await expectList(page, d, {}, "after Clear")).toBe(LOCKED_TOTAL);
        expect(search(page)).toBe("");
        await expect(searchBox(page, d)).toHaveValue("");
        await expect(searchBox(page, d), "focus is on the search box").toBeFocused();
        await expect(typeButton(page, d, "all")).toHaveAttribute("aria-pressed", "true");
        await expect(clearButtons(page, d)).toHaveCount(0);
        await expect(anyChip(page, d)).toHaveCount(0);
      });

      test("8. the Filters sheet (below 1024) and the rail (from 1024)", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const rail = page.getByRole("complementary", { name: d.copy.filters.label, exact: true });

        if (W >= LG) {
          await expect(rail).toBeVisible();
          await expect(filtersButton(page, d), "no Filters button beside the rail").toHaveCount(0);
          await expect(searchBox(page, d)).toBeVisible();
          return;
        }

        await expect(rail, "the rail is hidden below 1024").toHaveCount(0);
        const plainButton = page.getByRole("button", { name: d.copy.filters.button, exact: true });
        await expect(plainButton, "no badge at 0").toBeVisible();

        await openSheet(page, d);
        const sheet = dialog(page, d.copy.filters.title);
        const cartagenaCount = LOCKED.cartagena;
        await checkbox(page, d, W, d.destinationNames.cartagena).check();
        await expect(sheet.getByRole("button", { name: formatPlural(d.copy.showResults, cartagenaCount, locale), exact: true })).toBeVisible();
        await closeSheet(page, d, cartagenaCount);
        await expect(filtersButton(page, d), "focus is back on the Filters button").toBeFocused();
        await expect(page.getByRole("button", { name: new RegExp(escapeRegExp(formatPlural(d.copy.badge, 1, locale))) }), "badge reads 1").toBeVisible();
        expect(await expectList(page, d, { destinations: ["cartagena"] }, "after Show")).toBe(cartagenaCount);

        await openSheet(page, d);
        await sheet.getByRole("button", { name: d.copy.clear, exact: true }).click();
        await expect(sheet, "the sheet stays open after Clear").toBeVisible();
        await expect(sheet.getByRole("button", { name: formatPlural(d.copy.showResults, LOCKED_TOTAL, locale), exact: true })).toBeVisible();
        await expect(checkbox(page, d, W, d.destinationNames.cartagena)).not.toBeChecked();
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
        await expect(filtersButton(page, d)).toBeFocused();
        await expect(plainButton, "badge gone again").toBeVisible();
        expect(await expectList(page, d, {}, "after Clear and Escape")).toBe(LOCKED_TOTAL);
        expect(search(page)).toBe("");
      });

      test("9. bad address input is ignored: Cartagena only, no error", async ({ page }) => {
        const d = await data(locale);
        await visit(page, `${d.path}?type=bogus&destination=nowhere,cartagena&stay=nope`);
        expect(await expectList(page, d, { destinations: ["cartagena"] }, "bad input")).toBe(LOCKED.cartagena);
        await expect(typeButton(page, d, "all")).toHaveAttribute("aria-pressed", "true");
        await expect(anyChip(page, d)).toHaveCount(1);
        await expect(chipButton(page, d, d.destinationNames.cartagena)).toBeVisible();
        await expect(page.getByText(d.copy.empty, { exact: true })).toHaveCount(0);
      });
    });
  }
}

// A literal check outside the loops, so the spec states the numbers once in plain view.
test("the locked counts are the ones the page was designed for", () => {
  expect(Object.values(LOCKED)).toEqual([14, 11, 3, 1, 4]);
  expect([LOCKED_SERVICES, LOCKED_EXPERIENCES, LOCKED_TOTAL, LOCKED_SANTA_FE]).toEqual([10, 35, 45, 6]);
});
