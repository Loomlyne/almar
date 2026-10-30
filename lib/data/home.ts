// lib/data/home.ts
//
// Server only. The home page's own blocks: hero, welcome letter, gallery, the three journey tiers and the
// ALMAR Stories cards. Since plan 03.2-02 the three journey tiers (C-15) are read through ./source (fixtures or the
// Supabase views); since plan 06-01 hero, begin, welcome and gallery come from ./page-blocks (the same fixture files, or
// the page-section views in supabase mode), in the same shapes.

import { mediaUrl } from "./media";
import { getPosts } from "./posts";
import { pageFixture, pageFixtureTranslations } from "./page-blocks";
import { image, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import { loadSource, readSource } from "./source";
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
  /**
   * `video_key` is a media key (the owner's upload) or null; the data layer turns it into a URL. `video_url` is the hero
   * video the owner stored in the Pages editor (supabase mode only); it wins when set.
   */
  hero: { poster: RawImage | null; video_key: string | null; video_url?: string | null };
  begin: { poster: RawImage | null; video_key: string | null; video_url?: string | null };
  welcome: { signature: RawImage | null; images: RawImage[] };
  gallery: { images: RawImage[] };
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
};

/** A media key becomes the media-host URL; null stays null (the owner's videos are not uploaded yet). */
const videoUrl = (key: string | null): string | null => (key ? mediaUrl(key) : null);

const home = () => pageFixture<HomeFixture>("home");
const homeT = () => pageFixtureTranslations<Omit<HomeTranslations, "tiers">>("home");

/** A block's text for one locale, falling back to English. */
function block<T extends Rec>(records: readonly T[], locale: Locale): T {
  const r = records.find((x) => x.locale === locale) ?? records.find((x) => x.locale === "en");
  if (!r) throw new Error(`home block has no "${locale}" or "en" record`);
  return r;
}

/**
 * A block the owner may hide (Welcome, Gallery; plan 06-02): hidden, it has no records in supabase mode, and its words
 * come back empty (the page does not draw the section). The hero is always shown, so it keeps the strict read.
 */
function hideable<T extends Rec>(records: readonly T[], locale: Locale, empty: Omit<T, keyof Rec>): Omit<T, keyof Rec> {
  return records.length === 0 ? empty : block(records, locale);
}

export async function getJourneyTiers(locale: Locale): Promise<JourneyTier[]> {
  await loadSource();
  const records = readSource<HomeTranslations["tiers"]>("journey-tier-translations");
  return readSource<TierBase[]>("journey-tiers")
    .filter((t) => t.is_published)
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

/** The three newest posts, as the home cards. The posts module is the one source (plan 03.3-30). */
async function getHomeStories(locale: Locale): Promise<HomeStory[]> {
  const posts = await getPosts(locale, { limit: 3 });
  return posts.map((p, index) => ({
    id: p.id,
    created_at: p.created_at,
    updated_at: p.updated_at,
    locale: p.locale,
    translation_status: p.translation_status,
    is_sample: p.is_sample,
    sample_fields: p.sample_fields,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date_label: p.date_label,
    image: p.cover_image,
    is_published: p.is_published,
    position: index + 1,
  }));
}

export async function getHomeBlocks(locale: Locale): Promise<HomeBlocks> {
  await loadSource(); // the blocks' pictures take their alt texts from the same source as every other picture
  const h = home();
  const t = homeT();
  const welcome = hideable(t.welcome, locale, { kicker: "", heading: "", salutation: "", paragraphs: [], sign_off: "", signer: "", signer_role: "" });
  const gallery = hideable(t.gallery, locale, { kicker: "", heading: "" });
  return {
    hero: {
      headline: block(t.hero, locale).headline,
      poster: image(h.hero.poster, locale),
      video_url: h.hero.video_url ?? videoUrl(h.hero.video_key),
    },
    begin: {
      poster: image(h.begin.poster, locale),
      video_url: h.begin.video_url ?? videoUrl(h.begin.video_key),
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
      images: h.welcome.images.map((i) => image(i, locale)!).sort((a, b) => a.position - b.position),
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
