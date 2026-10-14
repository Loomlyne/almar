import { expect, type Page } from "@playwright/test";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import type { Locale } from "../../../lib/locale-path";

// Plan 03.3-27: the one assertion the held-control specs make about the footer now that the newsletter is live
// (design 11.2): exactly one form in the footer, one textbox (the Email box, named in the page's language) and one
// submit, named the page's `Join the List`. Every count of "no form / no textbox / no email / no submit" elsewhere is
// scoped to outside the footer. Not a spec itself: the build config matches *.spec.ts only.

/** CSS for "outside the footer": append to a selector. */
export const OUTSIDE_FOOTER = ":not(footer *)";

/**
 * `behindModal`: a modal dialog is open (the phone booking sheet, plan 03.3-29 landing check). The page behind it leaves
 * the accessibility tree, footer included, so the footer must be hidden from assistive tech (aria-hidden or inert on it
 * or an ancestor) while its form, Email box and submit still exist. The Email box is then found by role with
 * includeHidden, and the "one footer textbox" count is made by element: text-entry fields in the footer with no
 * aria-hidden ancestor inside the footer. That leaves out the 11 honeypot inputs, whose container in
 * components/ui/footer.tsx is `<div aria-hidden="true" className="sr-only">`, as the role count does with no modal.
 * Without the flag nothing changes: every count is by role, as before.
 */
export async function expectFooterNewsletter(page: Page, locale: Locale, where: string, { behindModal = false } = {}): Promise<void> {
  const copy = SITE_FOOTER_COPY[locale].newsletter;
  const footer = page.locator("footer");
  await expect(footer.locator("form"), `${where}: one footer form, the newsletter`).toHaveCount(1);
  if (behindModal) {
    const hidden = await footer.evaluate((el) => !!el.closest('[aria-hidden="true"], [inert]'));
    expect(hidden, `${where}: the footer is hidden from assistive tech behind the modal`).toBe(true);
    const visibleFields = await footer.evaluate(
      (el) =>
        [...el.querySelectorAll('textarea, input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])')].filter(
          (field) => {
            const trap = field.parentElement?.closest('[aria-hidden="true"]');
            // An aria-hidden on the footer itself or above it is the modal's; only one strictly inside is the traps'.
            return !trap || trap === el || !el.contains(trap);
          },
        ).length,
    );
    expect(visibleFields, `${where}: one footer text field outside the honeypot block`).toBe(1);
    await expect(footer.getByRole("textbox", { name: copy.email, exact: true, includeHidden: true }), `${where}: the footer Email box`).toHaveCount(1);
  } else {
    await expect(footer.getByRole("textbox"), `${where}: one footer textbox`).toHaveCount(1);
    await expect(footer.getByRole("textbox", { name: copy.email, exact: true }), `${where}: the footer Email box`).toHaveCount(1);
  }
  await expect(footer.locator('input[type="email"]'), `${where}: one email input`).toHaveCount(1);
  const submits = footer.locator('button[type="submit"], input[type="submit"]');
  await expect(submits, `${where}: one footer submit`).toHaveCount(1);
  await expect(submits, `${where}: named Join the List`).toHaveText(copy.subscribe);
}
