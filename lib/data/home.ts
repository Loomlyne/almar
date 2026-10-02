// lib/data/home.ts
//
// Server only. The home page's own blocks: hero, welcome letter, gallery, the three journey tiers and the
// ALMAR Stories cards. They are not catalogue entities, but they sit behind the same door so Phase 3.2 can
// move them into the CMS (CMS-04, Content > Pages) without touching the page.

import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { HomeBlocks, HomeStory, JourneyTier, Locale } from "./types";

type RowBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  image: RawImage | null;
  is_published: boolean;
  position: number;
};
type TierBase = RowBase & {
  price_from: JourneyTier["price_from"];
  price_estimate: JourneyTier["price_estimate"];
  is_featured: boolean;
};
type HomeFixture = {
  hero: { poster: RawImage | null; video_url: string | null };
  welcome: { signature: RawImage | null };
  gallery: { images: RawImage[] };
  tiers: TierBase[];
  stories: RowBase[];
};
type Rec = { locale: Locale; status: StoredStatus };
type HomeTranslations = {
  hero: Array<Rec & { headline: string }>;
  welcome: Array<
    Rec & {
      kicker: string;
      heading: string;
      salutation: string;
      paragraphs: string[];
      sign_off: string;
      signer: string;
      signer_role: string;
    }
  >;
  gallery: Array<Rec & { kicker: string; heading: string }>;
  tiers: Array<
    Rec & {
      tier_id: string;
      name: string;
      price_label: string;
      tagline: string | null;
      duration_label: string | null;
      ideal_for_label: string | null;
      ideal_for: string | null;
      body: string | null;
    }
  >;
  stories: Array<Rec & { story_id: string; title: string; excerpt: string; date_label: string }>;
};

const home = () => readFixture<HomeFixture>("home");
const homeT = () => readFixture<HomeTranslations>("home-translations");

/** A block's text for one locale, falling back to English. */
function block<T extends Rec>(records: readonly T[], locale: Locale): T {
  const r = records.find((x) => x.locale === locale) ?? records.find((x) => x.locale === "en");
  if (!r) throw new Error(`home block has no "${locale}" or "en" record`);
  return r;
}

export async function getJourneyTiers(locale: Locale): Promise<JourneyTier[]> {
  const records = homeT().tiers;
  return home()
    .tiers.filter((t) => t.is_published)
    .sort((a, b) => a.position - b.position)
    .map((t) => {
      const row = resolveRow(
        t,
        records.filter((r) => r.tier_id === t.id),
        locale,
      );
      return { ...row, image: image(t.image, locale) } as JourneyTier;
    });
}

async function getHomeStories(locale: Locale): Promise<HomeStory[]> {
  const records = homeT().stories;
  return home()
    .stories.filter((s) => s.is_published)
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const row = resolveRow(
        s,
        records.filter((r) => r.story_id === s.id),
        locale,
      );
      return { ...row, image: image(s.image, locale) } as HomeStory;
    });
}

export async function getHomeBlocks(locale: Locale): Promise<HomeBlocks> {
  const h = home();
  const t = homeT();
  const welcome = block(t.welcome, locale);
  const gallery = block(t.gallery, locale);
  return {
    hero: {
      headline: block(t.hero, locale).headline,
      poster: image(h.hero.poster, locale),
      video_url: h.hero.video_url,
    },
    welcome: {
      kicker: welcome.kicker,
      heading: welcome.heading,
      salutation: welcome.salutation,
      paragraphs: welcome.paragraphs,
      sign_off: welcome.sign_off,
      signer: welcome.signer,
      signer_role: welcome.signer_role,
      signature: image(h.welcome.signature, locale),
    },
    gallery: {
      kicker: gallery.kicker,
      heading: gallery.heading,
      images: h.gallery.images.map((i) => image(i, locale)!).sort((a, b) => a.position - b.position),
    },
    tiers: await getJourneyTiers(locale),
    stories: await getHomeStories(locale),
  };
}
