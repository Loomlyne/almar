import { expect, type Page } from "@playwright/test";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import type { Locale } from "../../../lib/locale-path";

// Plan 03.3-27: the one assertion the held-control specs make about the footer now that the newsletter is live
// (design 11.2): exactly one form in the footer, one textbox (the Email box, named in the page's language) and one
// submit, named the page's `Join the List`. Every count of "no form / no textbox / no email / no submit" elsewhere is
// scoped to outside the footer. Not a spec itself: the build config matches *.spec.ts only.

/** CSS for "outside the footer": append to a selector. */
export const OUTSIDE_FOOTER = ":not(footer *)";

export async function expectFooterNewsletter(page: Page, locale: Locale, where: string): Promise<void> {
  const copy = SITE_FOOTER_COPY[locale].newsletter;
  const footer = page.locator("footer");
  await expect(footer.locator("form"), `${where}: one footer form, the newsletter`).toHaveCount(1);
  await expect(footer.getByRole("textbox"), `${where}: one footer textbox`).toHaveCount(1);
  await expect(footer.getByRole("textbox", { name: copy.email, exact: true }), `${where}: the footer Email box`).toHaveCount(1);
  await expect(footer.locator('input[type="email"]'), `${where}: one email input`).toHaveCount(1);
  const submits = footer.locator('button[type="submit"], input[type="submit"]');
  await expect(submits, `${where}: one footer submit`).toHaveCount(1);
  await expect(submits, `${where}: named Join the List`).toHaveText(copy.subscribe);
}
