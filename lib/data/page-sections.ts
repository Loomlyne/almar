// lib/data/page-sections.ts (plan 06-01, Task 4)
//
// Pure, no imports: the one inventory of the editable public pages (F-09, CMS-07). Per page, its sections in their fixed
// code order (the owner shows or hides a section, he never moves it), the text columns each section uses, its photo
// slots, whether its hero takes a video URL, and where today's words and photos come from (a fixture block or a copy
// file). Read by lib/data/page-blocks.ts (build), scripts/import-site-content.mjs (the one-time import) and the 06-02
// Pages editor. The SQL copy of MEDIA_SLOTS lives in ops_save_page_section (migration 20261025120000_site_cms.sql,
// same commit): a slot added here and not there is refused on save, so change both together.
//
// Contact details (contact.json, SITE-13) are not a section: they stay fixed in code and are never imported.

export const PAGE_KEYS = ["home", "about", "destinations", "experiences", "contact"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/** Every text column of page_section_translations (one table for all sections; a section uses a subset). */
export const SECTION_TEXT_COLUMNS = [
  "kicker",
  "heading",
  "headline",
  "intro",
  "body",
  "statement",
  "salutation",
  "paragraphs",
  "sign_off",
  "signer",
  "signer_role",
  "cta_label",
] as const;
export type SectionTextColumn = (typeof SECTION_TEXT_COLUMNS)[number];

/** `paragraphs` is a list of strings; every other column is one string. */
export const LIST_TEXT_COLUMNS: readonly SectionTextColumn[] = ["paragraphs"];

/** One photo slot: `many` takes an ordered list, `decorative` photos are drawn with alt="" in every language. */
export type MediaSlot = { slot: string; many: boolean; decorative: boolean };

/**
 * Where a section's text comes from today. `fixture`: a block of lib/data/fixtures/<file>.json (records with locale and
 * status). `copy`: lib/copy/<module>.ts, export `name` (a Record of en/ar/es), one dotted path per text column; the status
 * is the copy's own `status` field when it has one, else published.
 */
export type TextSource =
  | { kind: "fixture"; file: string; block: string }
  | { kind: "copy"; module: string; name: string; paths: Partial<Record<SectionTextColumn, string>> };

/** Where a slot's photos come from today: a dotted path inside lib/data/fixtures/<file>.json (an image or a list). */
export type MediaSource = { file: string; path: string };

export type SectionSpec = {
  section: string;
  text: readonly SectionTextColumn[];
  media: readonly MediaSlot[];
  /** The section takes an https video URL (every hero, F-09). */
  video: boolean;
  textFrom: TextSource | null;
  mediaFrom: Readonly<Record<string, MediaSource>>;
  /** The section's cards are page_items (About's Our Story and Our Values). */
  items?: true;
};

const one = (slot: string, decorative = false): MediaSlot => ({ slot, many: false, decorative });
const many = (slot: string, decorative = false): MediaSlot => ({ slot, many: true, decorative });
const copy = (module: string, name: string, paths: Partial<Record<SectionTextColumn, string>>): TextSource => ({
  kind: "copy",
  module,
  name,
  paths,
});
const fixture = (file: string, block: string): TextSource => ({ kind: "fixture", file, block });

const HOME = "HOME_PAGE_COPY";
const ABOUT = "ABOUT_PAGE_COPY";

export const PAGE_SECTIONS: Readonly<Record<PageKey, readonly SectionSpec[]>> = {
  home: [
    {
      section: "hero",
      text: ["headline"],
      media: [one("poster")],
      video: true,
      textFrom: fixture("home-translations", "hero"),
      mediaFrom: { poster: { file: "home", path: "hero.poster" } },
    },
    {
      section: "stays",
      text: ["kicker", "heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { kicker: "stays.kicker", heading: "stays.heading", intro: "stays.intro" }),
      mediaFrom: {},
    },
    {
      section: "services",
      text: ["kicker", "heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { kicker: "services.kicker", heading: "services.heading", intro: "services.intro" }),
      mediaFrom: {},
    },
    {
      section: "moments",
      text: ["kicker", "heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { kicker: "moments.kicker", heading: "moments.heading", intro: "moments.intro" }),
      mediaFrom: {},
    },
    {
      section: "welcome",
      text: ["kicker", "heading", "salutation", "paragraphs", "sign_off", "signer", "signer_role"],
      media: [one("signature"), many("images")],
      video: false,
      textFrom: fixture("home-translations", "welcome"),
      mediaFrom: { signature: { file: "home", path: "welcome.signature" }, images: { file: "home", path: "welcome.images" } },
    },
    {
      section: "journeys",
      text: ["heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { heading: "journeys.heading", intro: "journeys.intro" }),
      mediaFrom: {},
    },
    {
      section: "stories",
      text: ["kicker", "heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { kicker: "stories.kicker", heading: "stories.heading", intro: "stories.intro" }),
      mediaFrom: {},
    },
    {
      section: "gallery",
      text: ["kicker", "heading"],
      media: [many("images")],
      video: false,
      textFrom: fixture("home-translations", "gallery"),
      mediaFrom: { images: { file: "home", path: "gallery.images" } },
    },
    {
      section: "begin",
      text: ["heading", "intro", "cta_label"],
      media: [one("poster")],
      video: true,
      textFrom: copy("home-page", HOME, { heading: "begin.heading", intro: "begin.intro", cta_label: "begin.cta" }),
      mediaFrom: { poster: { file: "home", path: "begin.poster" } },
    },
    {
      section: "team",
      text: ["kicker", "heading"],
      media: [],
      video: false,
      textFrom: copy("home-page", HOME, { kicker: "team.kicker", heading: "team.heading" }),
      mediaFrom: {},
    },
  ],
  about: [
    {
      section: "hero",
      text: ["kicker", "headline"],
      media: [one("image")],
      video: true,
      textFrom: fixture("about-translations", "hero"),
      mediaFrom: { image: { file: "about", path: "hero.image" } },
    },
    {
      section: "intro",
      text: ["statement"],
      media: [many("images", true), one("still", true)],
      video: false,
      textFrom: fixture("about-translations", "intro"),
      mediaFrom: { images: { file: "about", path: "intro.images" }, still: { file: "about", path: "intro.still" } },
    },
    {
      section: "story",
      text: ["heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("about-page", ABOUT, { heading: "story.heading", intro: "story.intro" }),
      mediaFrom: {},
      items: true,
    },
    {
      section: "values",
      text: ["heading", "intro"],
      media: [],
      video: false,
      textFrom: copy("about-page", ABOUT, { heading: "values.heading", intro: "values.intro" }),
      mediaFrom: {},
      items: true,
    },
    {
      section: "team",
      text: ["kicker", "heading"],
      media: [],
      video: false,
      textFrom: copy("about-page", ABOUT, { kicker: "team.kicker", heading: "team.heading" }),
      mediaFrom: {},
    },
    {
      section: "get_in_touch",
      text: ["heading", "intro", "cta_label"],
      media: [one("cta_image", true)],
      video: false,
      textFrom: copy("about-page", ABOUT, { heading: "getInTouch.heading", intro: "getInTouch.intro", cta_label: "getInTouch.cta" }),
      mediaFrom: { cta_image: { file: "about", path: "cta_image" } },
    },
  ],
  destinations: [
    {
      section: "hero",
      text: ["kicker", "heading"],
      media: [many("images")],
      video: true,
      textFrom: copy("destinations-page", "DESTINATIONS_PAGE_COPY", { kicker: "kicker", heading: "heading" }),
      mediaFrom: { images: { file: "destinations-page", path: "hero" } },
    },
  ],
  experiences: [
    {
      // Optional photo, empty today (the page has a plain heading); the slot and the video are there for the owner.
      section: "hero",
      text: ["heading"],
      media: [one("image")],
      video: true,
      textFrom: copy("experiences-page", "EXPERIENCES_PAGE_COPY", { heading: "heading" }),
      mediaFrom: {},
    },
  ],
  contact: [
    {
      // Optional photo, empty today, like the Experiences hero.
      section: "title",
      text: ["kicker", "heading", "intro"],
      media: [one("image")],
      video: true,
      textFrom: copy("contact-page", "CONTACT_PAGE_COPY", { kicker: "title.kicker", heading: "title.heading", intro: "title.intro" }),
      mediaFrom: {},
    },
    {
      section: "confidence",
      text: ["heading", "body"],
      media: [],
      video: false,
      textFrom: copy("contact-page", "CONTACT_PAGE_COPY", { heading: "confidence.heading", body: "confidence.body" }),
      mediaFrom: {},
    },
    {
      section: "team",
      text: ["heading"],
      media: [],
      video: false,
      textFrom: copy("contact-page", "CONTACT_PAGE_COPY", { heading: "team.title" }),
      mediaFrom: {},
    },
  ],
};

/** `${page}/${section}` -> its photo slots. The SQL list in ops_save_page_section is the same (see the header). */
export const MEDIA_SLOTS: Readonly<Record<string, readonly MediaSlot[]>> = Object.fromEntries(
  PAGE_KEYS.flatMap((page) => PAGE_SECTIONS[page].map((spec) => [`${page}/${spec.section}`, spec.media] as const)),
);

/** The section's spec, or undefined for a name the page does not have. */
export function sectionSpec(page: PageKey, section: string): SectionSpec | undefined {
  return PAGE_SECTIONS[page].find((spec) => spec.section === section);
}
