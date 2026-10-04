// lib/data/types.ts
//
// The shapes every lib/data read returns (design 3.1.3 - 3.6). Types only: no import, no runtime.
//
// Boundary (design 3.1.2): nothing here carries a locale-keyed map, a per-language field suffix or a
// member holding all languages. A component receives `title: string` and `amenities: string[]` and
// cannot depend on how the three languages are stored.

export type Locale = "en" | "ar" | "es";

/** Supabase uuid. */
export type Uuid = string;
/** Supabase timestamptz, ISO 8601 with offset: "2026-10-02T11:00:00+00:00". */
export type Timestamp = string;
/** Supabase date, ISO 8601 calendar date: "2026-10-19". */
export type IsoDate = string;

/**
 * The state of the text on this row, for the locale that was asked for.
 * "published" - a translation record exists and the owner has reviewed it (status = 'published').
 * "draft"     - a translation record exists but is a machine draft (status = 'draft').
 * "fallback"  - no translation record for that locale; the English text was returned instead.
 */
export type TranslationStatus = "published" | "draft" | "fallback";

/** Every row the data layer returns carries these. */
export type RowMeta = {
  id: Uuid;
  created_at: Timestamp;
  updated_at: Timestamp;
  /**
   * The locale this row's text is actually in. Equals the locale asked for unless
   * translation_status is "fallback", in which case it is "en".
   */
  locale: Locale;
  translation_status: TranslationStatus;
  /**
   * True while any value on this row is sample data rather than published content.
   * A real boolean column in Supabase, default false, so a seeded demo row stays
   * identifiable after the fixtures are swapped out (design 3.9).
   */
  is_sample: boolean;
  /**
   * Exactly which fields on this row hold sample values. Empty on a fully published row.
   * A money field may never appear here (asserted in tests/data-sample.test.mjs).
   */
  sample_fields: string[];
};

/**
 * Media. In Supabase this is an https URL only (R2 / Cloudflare, never Supabase Storage, which is off).
 * `url` is built by mediaUrl(key) in lib/data/media.ts, the only file that knows the image host.
 */
export type ImageRef = {
  id: Uuid;
  url: string;
  /** Resolved for the requested locale. An image with text in it needs three files; others share one. */
  alt: string;
  width: number | null;
  height: number | null;
  position: number;
};

// ---------------------------------------------------------------------------------------------
// Destinations (design 3.2)
// ---------------------------------------------------------------------------------------------

/** The icon drawn beside a stay amenity. Derived from the English label by amenityIcon() (lib/data/amenity-icon.ts). */
export type AmenityIcon =
  | "pool"
  | "wifi"
  | "water"
  | "tv"
  | "air"
  | "kitchen"
  | "grill"
  | "security"
  | "parking"
  | "outdoor"
  | "lounge"
  | "service"
  | "check";

export type Destination = RowMeta & {
  slug: string;
  /** "Cartagena" */
  name: string;
  /** D-39: the one-line description the owner writes per destination, per locale. Null until written. */
  short_line: string | null;
  /** "Caribbean coast" - drawn on the Hero board's destination menu. */
  region: string | null;
  /** The longer published paragraph from the home page's destination card. */
  summary: string | null;
  /** "3-7 nights" - published text, not a computed range. */
  nights_label: string | null;
  hero_image: ImageRef | null;
  /** The small photo inside the home Moments panel. Null when the destination has none. */
  inset_image: ImageRef | null;
  is_published: boolean;
  /** The owner's own order in Dashboard > Catalog > Destinations. */
  position: number;
};

// ---------------------------------------------------------------------------------------------
// Stays (design 3.3)
// ---------------------------------------------------------------------------------------------

export type Stay = RowMeta & {
  slug: string;
  destination_id: Uuid;
  /** Joined for convenience; the detail page's locked bar needs the name, not another round trip. */
  destination_slug: string;
  destination_name: string;

  /** "Getsemani Colonial House" */
  title: string;
  /** "Getsemani heritage living" - the line under the h1. */
  tagline: string | null;
  /** "Casa Centro Getsemani" - the published Neighborhood stat. */
  neighborhood: string | null;

  /** The published Guests text, verbatim: "Up to 10 Guests", "16-20 Guests", "20-30 Guests". */
  guests_label: string | null;
  /** Derived from guests_label for the capacity filter and the bar. Upper bound of a range. */
  max_guests: number | null;
  /** Lower bound when the published text is a range ("16-20 Guests" -> 16), else null. */
  min_guests: number | null;

  bedrooms: number | null;
  /** The published Bathrooms text; not always a number ("8, 1 social"). */
  bathrooms_label: string | null;
  /** Numeric part of bathrooms_label when it is a plain count, else null. */
  bathrooms: number | null;
  /** The published Beds text: "5 double", "1 KING, 2 double, 6 QUEEN", or a bare count "9". */
  beds_label: string | null;

  /** "On request" - the list card's price slot. */
  price_label: string | null;
  /**
   * "Public rates are quoted on request. ALMAR confirms availability, staffing, and final pricing
   * before you travel." Published, identical on all 12.
   */
  price_note: string | null;
  /**
   * NO SOURCE EXISTS ANYWHERE IN THE REPO. Null in every fixture row and never a sample number: money
   * is never invented (3.9). STAY-03 - a stay with no rate is not bookable.
   */
  nightly_rate_aed: number | null;

  /** The About paragraphs, in order. */
  description: string[];
  amenities: string[];
  /** One icon per amenity, same order and length as `amenities`; computed from the English amenity at the same index. */
  amenity_icons: AmenityIcon[];
  /** "Included with the stay:" - present on 7 of 12, so this is often empty. */
  inclusions: string[];
  /** The four published policy headings. */
  policy_headings: string[];
  /**
   * The text each policy row will open, same order and length as policy_headings, once real text is written in the
   * dashboard. Null until then: the owner decided on 2026-10-04 that Policies show headings only and nothing opens
   * (Framer's bodies were one CMS placeholder, identical on all 12 stays). The data layer returns null today.
   */
  policy_bodies: string[] | null;

  /** NO SOURCE EXISTS. Null means "not set" (STAY-06). */
  min_nights: number | null;
  /**
   * D-63: booked or blocked days, set per stay in Dashboard > Catalog > Stays.
   * NO SOURCE EXISTS: the fixture values are sample data, listed in `sample_fields`.
   */
  blocked_dates: IsoDate[];

  hero_image: ImageRef | null;
  gallery: ImageRef[];

  /** Which catalogue items this stay offers (D-45). */
  experience_ids: Uuid[];
  service_ids: Uuid[];

  is_published: boolean;
  position: number;
};

export type StayFilter = {
  /** Destination slug, from the chip row or the hero bar's handoff. */
  destination?: string;
  /** Keeps stays whose max_guests is at least this. */
  guests?: number;
  /** Inclusive bedroom range from the chip row. */
  bedroomsMin?: number;
  bedroomsMax?: number;
  /** Matches title, neighborhood and destination_name, case- and accent-insensitive. */
  query?: string;
  /**
   * Arrival and departure, as a pair (from < to). Keeps a stay only when none of its blocked_dates d
   * satisfies from <= d < to: the departure day itself may be blocked. Ignored unless both are set.
   */
  from?: IsoDate;
  to?: IsoDate;
};

// ---------------------------------------------------------------------------------------------
// Catalogue: experiences and services (design 3.4)
// ---------------------------------------------------------------------------------------------

export type CatalogKind = "experience" | "service";
/** D-46. Drives the add control's maximum in Phase 4. */
export type CatalogUnit = "person" | "night" | "trip";

export type CatalogItem = RowMeta & {
  slug: string;
  kind: CatalogKind;
  /** "24/7 Private Concierge" */
  name: string;
  /** The published paragraph on the card. */
  summary: string | null;
  /** "3 Hours", "Evening", "Half, Full Day" - published text, not a duration in minutes. */
  duration_label: string | null;
  unit: CatalogUnit;
  /** Null until Phase 3.2 brings rates in. Never a sample number. */
  price_aed: number | null;
  /** D-48: a UAE-side service, which starts added in the Phase 4 add-ons step. */
  is_uae: boolean;
  /** Every experience and service must have an image (ROADMAP 3.2 SC2). */
  image: ImageRef | null;

  destination_ids: Uuid[];
  stay_ids: Uuid[];

  is_published: boolean;
  position: number;
};

// ---------------------------------------------------------------------------------------------
// Team (design 3.5)
// ---------------------------------------------------------------------------------------------

export type TeamMember = RowMeta & {
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo: ImageRef | null;
  /** D-91: social links per member. https only. */
  links: Array<{ label: string; url: string }>;
  is_published: boolean;
  position: number;
};

// ---------------------------------------------------------------------------------------------
// Home blocks (design 3.6; stories added by the controller reconcile, item R-7)
// ---------------------------------------------------------------------------------------------

/** One of the three journeys on the home page. Prices are the owner's own, accepted 2026-10-02. */
export type JourneyTier = RowMeta & {
  slug: string;
  /** "The Explorer" */
  name: string;
  /** "From USD $3,000/person - Est. AED 80,000-90,000" - published verbatim, never recomputed. */
  price_label: string;
  /** The structured form, for the currency control. Null when the label cannot be parsed. */
  price_from: { amount: number; currency: "USD" | "AED" } | null;
  price_estimate: { low: number; high: number | null; currency: "AED"; open_ended: boolean } | null;
  /** "A considered introduction to Colombia, shaped around your group" */
  tagline: string | null;
  /** "5-7 nights - 1-2 cities" */
  duration_label: string | null;
  /** "Ideal For" */
  ideal_for_label: string | null;
  /** The desktop string. The live tablet and phone copies are stale (design 7.8). */
  ideal_for: string | null;
  body: string | null;
  /** True on The Resident only: the published "Most Popular" badge. */
  is_featured: boolean;
  image: ImageRef | null;
  is_published: boolean;
  position: number;
};

/** One of the three ALMAR Stories cards on the home page (R-7). */
export type HomeStory = RowMeta & {
  slug: string;
  title: string;
  /** The published one-sentence teaser on the card. */
  excerpt: string;
  /** Published date text: "Jun 1, 2025". Not a computed date. */
  date_label: string;
  image: ImageRef | null;
  is_published: boolean;
  position: number;
};

export type HomeBlocks = {
  hero: {
    headline: string;
    /** The poster image. See design 7.6 on the third-party background video. */
    poster: ImageRef | null;
    /** The media-host URL of the owner's video, or null until it is uploaded. Components play it when present. */
    video_url: string | null;
  };
  /** The Begin section: its still photo (Framer's poster of the Begin video) and the video, null until uploaded. */
  begin: { poster: ImageRef | null; video_url: string | null };
  welcome: {
    kicker: string;
    heading: string;
    salutation: string;
    paragraphs: string[];
    sign_off: string;
    signer: string;
    signer_role: string;
    signature: ImageRef | null;
    /** The five Welcome photos, in order. */
    images: ImageRef[];
  };
  gallery: { kicker: string; heading: string; images: ImageRef[] };
  tiers: JourneyTier[];
  /** Published stories, in order. An empty array hides the section (SITE-02). */
  stories: HomeStory[];
};

/** One block of a blog post body (design S4 3.2). Stored without ids; heading ids are assigned at read time. */
export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; id: string }
  | { type: "quote"; text: string };

/** A blog post, one language (design S4 3.2). */
export type Post = RowMeta & {
  slug: string;
  title: string;
  excerpt: string;
  body: PostBlock[];
  seo_title: string | null;
  seo_description: string | null;
  published_at: Timestamp;
  date_label: string;
  reading_minutes: number;
  destination_id: Uuid | null;
  destination_slug: string | null;
  destination_name: string | null;
  featured_stay_slug: string | null;
  featured_experience_slug: string | null;
  cover_image: ImageRef | null;
  is_published: boolean;
};
