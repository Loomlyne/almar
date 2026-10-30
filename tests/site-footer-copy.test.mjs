import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { FRAMER_SOURCE_COPY } from "../lib/copy/framer-source.ts";
import { HOME_COPY } from "../lib/copy/home.ts";
import { HOME_PAGE_COPY } from "../lib/copy/home-page.ts";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer.ts";
import { STAYS_LIST_COPY } from "../lib/copy/stays-list.ts";
import { STAY_DETAIL_COPY } from "../lib/copy/stay-detail.ts";

// 3.3 integration fix f: the footer's strings live in ONE table (lib/copy/site-footer.ts) that the home, the
// stays list and the stay page all read. Before, each page file carried its own copy and the Arabic drifted.

const LOCALES = ["en", "ar", "es"];
const KEYS = ["brand", "contact", "cookieSettings", "copyright", "instagram", "language", "legal", "madeBy", "newTab", "pages"];
// Plan 27: the newsletter block, an object of nine strings.
const NEWSLETTER_KEYS = ["description", "dismiss", "email", "failed", "invalid", "sending", "subscribe", "success", "title"];
const LIVE_COPYRIGHT = "© 2026 ALMAR Private Journeys. All rights reserved.";
const SIGNED = JSON.parse(readFileSync(".planning/phases/03.3-public-site-in-react/s3-pictures/partb-states.json", "utf8"));

test("one table, three locales, the same ten non-empty strings and the newsletter block in each", () => {
  assert.deepEqual(Object.keys(SITE_FOOTER_COPY).sort(), ["ar", "en", "es"]);
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(SITE_FOOTER_COPY[locale]).sort(), [...KEYS, "newsletter"].sort(), locale);
    for (const key of KEYS) assert.ok(SITE_FOOTER_COPY[locale][key].trim() !== "", `${locale}.${key}`);
    const news = SITE_FOOTER_COPY[locale].newsletter;
    assert.deepEqual(Object.keys(news).sort(), NEWSLETTER_KEYS, `${locale}.newsletter`);
    for (const key of NEWSLETTER_KEYS) {
      assert.equal(typeof news[key], "string", `${locale}.newsletter.${key}`);
      assert.ok(news[key].trim() !== "", `${locale}.newsletter.${key}`);
    }
  }
});

test("plan 27: the newsletter lines are the owner's signed set (partb-states.json), and the reused ones equal their sources", () => {
  for (const locale of LOCALES) {
    const news = SITE_FOOTER_COPY[locale].newsletter;
    const signed = SIGNED[locale];
    // Signed 2026-10-14, verbatim.
    assert.equal(news.title, signed.n_title, `${locale} title`);
    assert.equal(news.description, signed.n_line, `${locale} description`);
    assert.equal(news.email, signed.n_email, `${locale} email`);
    assert.equal(news.subscribe, signed.n_join, `${locale} subscribe`);
    assert.equal(news.sending, signed.sending, `${locale} sending`);
    assert.equal(news.invalid, signed.n_invalid, `${locale} invalid`);
    assert.equal(news.success, signed.n_success, `${locale} success`);
    assert.equal(news.failed, signed.n_failed, `${locale} failed`);
    // The lines that already existed, where they are the same words.
    assert.equal(news.title, HOME_COPY[locale].newsletter, `${locale} title = HOME_COPY.newsletter`);
    assert.equal(news.email, HOME_COPY[locale].email, `${locale} email = HOME_COPY.email`);
    assert.equal(news.subscribe, FRAMER_SOURCE_COPY[locale]["Join the List"], `${locale} subscribe = the live button`);
    assert.equal(news.dismiss, FRAMER_SOURCE_COPY[locale].Close, `${locale} dismiss = the canvas dictionary's Close`);
    if (locale !== "es") {
      assert.equal(news.invalid, HOME_COPY[locale].emailError, `${locale} invalid = HOME_COPY.emailError`);
      assert.equal(news.description, FRAMER_SOURCE_COPY[locale]["Private Colombia inspiration, delivered to your inbox."], `${locale} description = the live line`);
    }
  }
  // Public Spanish is tú (I18N review 2026-10-05, item 3): the two older ES sources are ustedes / su, the signed lines are not.
  assert.equal(SITE_FOOTER_COPY.es.newsletter.description, "Inspiración privada sobre Colombia, en tu bandeja de entrada.");
  assert.equal(SITE_FOOTER_COPY.es.newsletter.invalid, "Escribe un correo como name@example.com.");
  for (const locale of LOCALES) {
    const news = SITE_FOOTER_COPY[locale].newsletter;
    // No email is sent, so no line promises one; the failed line names the one inbox and no other address.
    assert.equal(/inbox|بريدكم|bandeja/i.test(news.success), false, `${locale} success`);
    assert.equal(/check your/i.test(Object.values(news).join(" ")), false, locale);
    assert.equal(news.failed.match(/[^\s@]+@[^\s@]+/g)?.join(), "inquiries@almarprivatejourney.com.", `${locale} failed`);
    const others = Object.entries(news).filter(([k]) => k !== "failed" && k !== "invalid").map(([, v]) => v).join(" ");
    assert.equal(/@/.test(others), false, `${locale}: no other address`);
    assert.equal(/\d{2,}|AED|USD|EUR|COP|partnerships@/.test(Object.values(news).join(" ")), false, `${locale}: no number, currency or other inbox`);
  }
  assert.equal(SITE_FOOTER_COPY.en.newsletter.success, "You're on the list.");
  // Literal strings, no value import (checker finding 12): the footer is a client component.
  const source = readFileSync("lib/copy/site-footer.ts", "utf8");
  assert.equal(source.split("\n").filter((l) => /^import\b/.test(l) && !/^import type\b/.test(l)).length, 0);
});

test("the words are the approved lines: pages, contact and language from lib/copy/home.ts, the copyright from the live footer", () => {
  for (const locale of LOCALES) {
    const footer = SITE_FOOTER_COPY[locale];
    assert.equal(footer.pages, HOME_COPY[locale].pages, `${locale} pages`);
    assert.equal(footer.contact, HOME_COPY[locale].nav.contact, `${locale} contact`);
    assert.equal(footer.language, HOME_COPY[locale].nav.language, `${locale} language`);
    assert.equal(footer.copyright, FRAMER_SOURCE_COPY[locale][LIVE_COPYRIGHT], `${locale} copyright`);
    assert.equal(footer.instagram, "Instagram", `${locale} instagram: the brand name, as the live footer prints it`);
  }
  assert.equal(SITE_FOOTER_COPY.en.copyright, LIVE_COPYRIGHT);
});

test("plan 41 keys: brand (the wordmark's alt) and madeBy; the English is the live footer's, AR and ES are marked drafts", () => {
  assert.equal(SITE_FOOTER_COPY.en.brand, "ALMAR Private Journeys");
  assert.equal(SITE_FOOTER_COPY.en.madeBy, "Made by");
  assert.equal(SITE_FOOTER_COPY.ar.madeBy, "صُمّم بواسطة");
  assert.equal(SITE_FOOTER_COPY.es.madeBy, "Hecho por");
  const header = readFileSync("lib/copy/site-footer.ts", "utf8").split("export type")[0];
  assert.match(header, /brand/);
  assert.match(header, /madeBy/);
  assert.match(header, /draft/i);
});

test("plan 06-04 keys: legal and cookieSettings are the signed words (drafted UI copy, pictures 06-04)", () => {
  assert.deepEqual(LOCALES.map((l) => SITE_FOOTER_COPY[l].legal), ["Legal", "قانوني", "Legal"]);
  assert.deepEqual(LOCALES.map((l) => SITE_FOOTER_COPY[l].cookieSettings), ["Cookie settings", "إعدادات ملفات الارتباط", "Ajustes de cookies"]);
  const header = readFileSync("lib/copy/site-footer.ts", "utf8").split("export type")[0];
  assert.match(header, /legal, cookieSettings\s+DRAFTED UI COPY, signed with the 06-04 pictures/);
});

test("no page copy file has a footer of its own any more", () => {
  for (const [name, table] of [["home-page", HOME_PAGE_COPY], ["stays-list", STAYS_LIST_COPY], ["stay-detail", STAY_DETAIL_COPY]]) {
    for (const locale of LOCALES) {
      assert.equal("footer" in table[locale] || "frame" in table[locale], false, `lib/copy/${name}.ts [${locale}] still has a footer`);
    }
    const source = readFileSync(`lib/copy/${name}.ts`, "utf8");
    assert.equal(/\bcopyright\b|rights reserved|opens in a new tab/i.test(source), false, `lib/copy/${name}.ts still names a footer string`);
  }
});

test("every React page reads the table for its footer, and none writes a footer string itself", () => {
  const pages = {
    "components/pages/home-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
    "components/pages/private-stays-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
    "components/pages/stay-detail-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
  };
  for (const [file, reads] of Object.entries(pages)) {
    const source = readFileSync(file, "utf8");
    assert.match(source, reads, file);
    assert.match(source, /from "\.\.\/\.\.\/lib\/copy\/site-footer"/, file);
  }
  // Under components/pages and components/site, only the table and the UI footer know these strings.
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (/\.tsx?$/.test(name)) out.push(path);
    }
    return out;
  };
  for (const file of [...walk("components/pages"), ...walk("components/site")]) {
    const source = readFileSync(file, "utf8");
    assert.equal(/newTab:|copyright:|All rights reserved|Todos los derechos/.test(source), false, `${file} writes a footer string`);
  }
});
