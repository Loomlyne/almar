// lib/data/about.ts
//
// Server only. The About page's own blocks: hero, intro (statement, the collage's five photos, the wide
// still), the Get In Touch band's still, and the six Our Story / Our Values cards. Phase 3.2/6 swap
// readFixture for Supabase (Content > Pages) and touch nothing else. Section headings and intro lines are
// copy (lib/copy/about-page.ts), not data.

import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { AboutBlocks, AboutCard, Locale } from "./types";

type CardBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  section: AboutCard["section"];
  image: RawImage | null;
  is_published: boolean;
  position: number;
};
type AboutFixture = {
  hero: { image: RawImage | null };
  intro: { images: RawImage[]; still: RawImage | null };
  cta_image?: RawImage | null;
  cards: CardBase[];
};
type Rec = { locale: Locale; status: StoredStatus };
type AboutTranslations = {
  hero: Array<Rec & { kicker: string; headline: string }>;
  intro: Array<Rec & { statement: string }>;
  cards: Array<Rec & { card_id: string; title: string; body: string }>;
};

const about = () => readFixture<AboutFixture>("about");
const aboutT = () => readFixture<AboutTranslations>("about-translations");

/** A block's text for one locale, falling back to English. */
function block<T extends Rec>(records: readonly T[], locale: Locale): T {
  const r = records.find((x) => x.locale === locale) ?? records.find((x) => x.locale === "en");
  if (!r) throw new Error(`about block has no "${locale}" or "en" record`);
  return r;
}

function cardsFor(section: AboutCard["section"], locale: Locale): AboutCard[] {
  const records = aboutT().cards;
  return about()
    .cards.filter((c) => c.is_published && c.section === section)
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      const row = resolveRow(
        c,
        records.filter((r) => r.card_id === c.id),
        locale,
      );
      return { ...row, image: image(c.image, locale) } as AboutCard;
    });
}

export async function getAboutBlocks(locale: Locale): Promise<AboutBlocks> {
  const a = about();
  const t = aboutT();
  const hero = block(t.hero, locale);
  const intro = block(t.intro, locale);
  return {
    hero: { kicker: hero.kicker, headline: hero.headline, image: image(a.hero.image, locale) },
    intro: {
      statement: intro.statement,
      images: [...a.intro.images].sort((x, y) => x.position - y.position).map((i) => image(i, locale)!),
      still: image(a.intro.still, locale),
    },
    cta_image: image(a.cta_image, locale),
    story: cardsFor("story", locale),
    values: cardsFor("values", locale),
  };
}
