// Client mirror of the owner API (03.2-API-CONTRACT.md sections 1.2, 5.1 to 5.9 and 6). Types only: no runtime, no
// import. Every ops screen imports its shapes from here; nobody redefines MediaRef. If the contract changes, the
// contract wins: change both in the same commit.

export type Locale3 = "en" | "ar" | "es";
export type TranslationState = "published" | "draft" | "missing";
export type TextStatus = "published" | "draft";

/** The error envelope of contract 1.1: `{ ok: false, error }`. ops-client.ts re-exports this type. */
export type OpsError = { code: string; field: string | null; locale: Locale3 | null; detail: unknown };

/** Money is an AED decimal string with at most two decimals ("1250.00"), both ways. null = not set. */
export type Aed = string;
/** "YYYY-MM-DD", a calendar day (UAE business meaning), no time. */
export type IsoDay = string;

export type MediaRef = {
  id: string;
  key: string;
  url: string;
  width: number | null;
  height: number | null;
  alt_en: string;
};

/**
 * One record per language. A locale with no record is null; a record always carries its status. `locked_fields` (I18N-04,
 * plan 06-01): on ar/es only, the fields the owner fixed by hand; Save leaves them alone when the English changes. The
 * server sets the list it is sent (it never merges) and refuses it on en or with a field the entity does not have.
 */
export type Translations<T> = Record<Locale3, (T & { status: TextStatus; locked_fields?: string[] }) | null>;
export type TranslationStates = Record<Locale3, TranslationState>;

// 5.1 Destinations
export type DestinationText = {
  name: string;
  short_line: string | null;
  region: string | null;
  summary: string | null;
  nights_label: string | null;
};

export type DestinationSummary = {
  id: string;
  slug: string;
  name_en: string;
  /** The Arabic and Spanish names (04-09: the dashboard draws the destination in its own language); null when unnamed. */
  name_ar: string | null;
  name_es: string | null;
  is_published: boolean;
  position: number;
  stay_count: number;
  published_stay_count: number;
  hero: MediaRef | null;
  translation_state: TranslationStates;
  updated_at: string;
};

export type DestinationDetail = {
  id: string;
  slug: string;
  is_published: boolean;
  position: number;
  hero_media_id: string | null;
  inset_media_id: string | null;
  hero: MediaRef | null;
  inset: MediaRef | null;
  translations: Translations<DestinationText>;
  translation_state: TranslationStates;
  updated_at: string;
};

// 5.2 Stays
export type StayText = {
  title: string;
  tagline: string | null;
  neighborhood: string | null;
  guests_label: string | null;
  bathrooms_label: string | null;
  beds_label: string | null;
  price_label: string | null;
  price_note: string | null;
  description: string[];
  amenities: string[];
  inclusions: string[];
  policy_headings: string[];
};

export type PetsRule = "allowed" | "not_allowed" | "fee";

export type StaySummary = {
  id: string;
  slug: string;
  title_en: string;
  destination_id: string;
  destination_name_en: string;
  is_published: boolean;
  position: number;
  base_nightly_rate_aed: Aed | null;
  /** Published and a base rate set. */
  bookable: boolean;
  hero: MediaRef | null;
  translation_state: TranslationStates;
  updated_at: string;
};

export type StayDetail = {
  id: string;
  slug: string;
  destination_id: string;
  is_published: boolean;
  position: number;
  max_guests: number | null;
  min_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  min_nights: number;
  pets_rule: PetsRule | null;
  pets_fee_aed: Aed | null;
  infants_count: boolean | null;
  /** Read-only here: rates have their own endpoint. */
  base_nightly_rate_aed: Aed | null;
  hero_media_id: string | null;
  hero: MediaRef | null;
  /** Ordered. */
  gallery: MediaRef[];
  experience_ids: string[];
  service_ids: string[];
  has_access: boolean;
  translations: Translations<StayText>;
  translation_state: TranslationStates;
  updated_at: string;
};

// 5.3 Rates
export type RateRange = {
  id: string;
  first_night: IsoDay;
  last_night: IsoDay;
  nights: number;
  nightly_rate_aed: Aed;
};

export type RateNight = { night: IsoDay; nightly_rate_aed: Aed | null; source: "range" | "base" | null };

export type RatesView = {
  stay_id: string;
  base_nightly_rate_aed: Aed | null;
  ranges: RateRange[];
  /** Present only when the request carried from and to. */
  nights?: RateNight[];
};

// 5.4 Availability blocks
export type BlockScope = "all" | "destination" | "stay";

export type Block = {
  id: string;
  scope: BlockScope;
  destination_id: string | null;
  stay_id: string | null;
  starts_on: IsoDay;
  ends_on: IsoDay;
  reason: string | null;
  created_at: string;
};

// 5.5 Stay access (never logged)
export type StayAccess = {
  address: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  door_code: string | null;
  notes: string | null;
  /** The Arabic and Spanish of `notes`, filled by the AI on Save (03.2-15); private like the rest. */
  notes_ar: string | null;
  notes_es: string | null;
  /** The languages of `notes` the owner fixed by hand (I18N-04, plan 06-01): a subset of ar, es. */
  notes_locked?: Array<"ar" | "es">;
  updated_at: string;
};

// 5.6 Experiences and services
export type CatalogKind = "experience" | "service";
export type CatalogUnit = "person" | "night" | "trip";

export type CatalogText = {
  name: string;
  summary: string | null;
  duration_label: string | null;
};

export type CatalogSummary = {
  id: string;
  slug: string;
  kind: CatalogKind;
  unit: CatalogUnit;
  price_aed: Aed | null;
  is_uae: boolean;
  is_home_pickup: boolean;
  name_en: string;
  is_published: boolean;
  position: number;
  image: MediaRef | null;
  destination_ids: string[];
  stay_count: number;
  translation_state: TranslationStates;
  updated_at: string;
};

export type CatalogDetail = {
  id: string;
  slug: string;
  kind: CatalogKind;
  unit: CatalogUnit;
  price_aed: Aed | null;
  is_uae: boolean;
  is_home_pickup: boolean;
  media_id: string | null;
  image: MediaRef | null;
  destination_ids: string[];
  stay_ids: string[];
  is_published: boolean;
  position: number;
  translations: Translations<CatalogText>;
  translation_state: TranslationStates;
  updated_at: string;
};

// 5.7 Team
export type TeamLink = { label: string; url: string };

export type TeamText = {
  name: string;
  role: string | null;
  bio: string | null;
};

export type TeamSummary = {
  id: string;
  slug: string;
  name_en: string;
  role_en: string | null;
  is_published: boolean;
  position: number;
  photo: MediaRef | null;
  translation_state: TranslationStates;
  updated_at: string;
};

export type TeamDetail = {
  id: string;
  slug: string;
  photo_media_id: string | null;
  photo: MediaRef | null;
  email: string | null;
  links: TeamLink[];
  is_published: boolean;
  position: number;
  translations: Translations<TeamText>;
  translation_state: TranslationStates;
  updated_at: string;
};

// 5.8 Journeys (Packages)
export type JourneyText = {
  name: string;
  price_label: string;
  tagline: string | null;
  duration_label: string | null;
  ideal_for_label: string | null;
  ideal_for: string | null;
  body: string | null;
};

export type JourneySummary = {
  id: string;
  slug: string;
  name_en: string;
  price_label_en: string;
  is_featured: boolean;
  is_published: boolean;
  position: number;
  image: MediaRef | null;
  translation_state: TranslationStates;
  updated_at: string;
};

export type JourneyDetail = {
  id: string;
  slug: string;
  is_featured: boolean;
  media_id: string | null;
  image: MediaRef | null;
  price_from: { amount: Aed; currency: "USD" | "AED" } | null;
  price_estimate: { low: Aed | null; high: Aed | null; currency: "AED"; open_ended: boolean } | null;
  is_published: boolean;
  position: number;
  translations: Translations<JourneyText>;
  translation_state: TranslationStates;
  updated_at: string;
};

// 5.8 (plan 06-01, built by 06-06): a package's cities and included add-ons, and package creation.
export type JourneyLegText = { nights_label: string | null };

export type JourneyLeg = {
  id: string;
  position: number;
  destination_id: string;
  /** A suggested stay of that destination, or null. */
  stay_id: string | null;
  translations: Translations<JourneyLegText>;
};

/** JourneyDetail as ops_get('journey_tier') answers it once 06-01's migration is applied. */
export type JourneyDetailWithLegs = JourneyDetail & { legs: JourneyLeg[]; addon_ids: string[] };

// Phase 6 content (plan 06-01 names the shapes; 06-02…06-05 build the screens and routes).
export type PageKey = "home" | "about" | "destinations" | "experiences" | "contact";

/** Every text column a page section can use (lib/data/page-sections.ts SECTION_TEXT_COLUMNS); a section uses a subset. */
export type PageSectionText = {
  kicker: string | null;
  heading: string | null;
  headline: string | null;
  intro: string | null;
  body: string | null;
  statement: string | null;
  salutation: string | null;
  paragraphs: string[] | null;
  sign_off: string | null;
  signer: string | null;
  signer_role: string | null;
  cta_label: string | null;
};

export type PageSectionDetail = {
  id: string;
  page: PageKey;
  section: string;
  is_shown: boolean;
  video_url: string | null;
  /** Slot -> photos in order (one at most on a single slot). */
  media: Record<string, MediaRef[]>;
  translations: Translations<Partial<PageSectionText>>;
  translation_state: TranslationStates;
  updated_at: string;
};

/** ops_list_page(page): the page's sections in code order, each with its About cards when it holds them. */
export type PageView = { page: PageKey; sections: Array<PageSectionDetail & { items?: PageItemDetail[] }> };

export type PageItemText = { title: string; body: string | null };

export type PageItemDetail = {
  id: string;
  section_id: string;
  slug: string;
  media_id: string | null;
  image: MediaRef | null;
  is_shown: boolean;
  position: number;
  translations: Translations<PageItemText>;
  translation_state: TranslationStates;
  updated_at: string;
};

export type NavArea = "header" | "footer";
export type NavLinkText = { label: string };

export type NavLinkDetail = {
  id: string;
  area: NavArea;
  position: number;
  is_shown: boolean;
  link_kind: "internal" | "external";
  /** A page key (internal) or an https URL (external). Never "login": Login is drawn by the header itself. */
  target: string;
  translations: Translations<NavLinkText>;
  translation_state: TranslationStates;
};

export type NavView = { area: NavArea; links: NavLinkDetail[] };

export type PostText = { title: string; excerpt: string; seo_title: string | null; seo_description: string | null };
export type PostBlockKind = "heading" | "paragraph" | "photo" | "quote";

export type PostBlockDetail = {
  id: string;
  position: number;
  kind: PostBlockKind;
  /** The photo of a photo block; null otherwise. */
  media_id: string | null;
  image: MediaRef | null;
  translations: Translations<{ text: string | null }>;
};

export type PostSummary = {
  id: string;
  slug: string;
  title_en: string;
  published_at: string | null;
  is_published: boolean;
  cover: MediaRef | null;
  translation_state: TranslationStates;
  updated_at: string;
};

export type PostDetail = {
  id: string;
  slug: string;
  cover_media_id: string | null;
  cover: MediaRef | null;
  published_at: string | null;
  destination_id: string | null;
  featured_stay_id: string | null;
  featured_experience_id: string | null;
  is_published: boolean;
  blocks: PostBlockDetail[];
  translations: Translations<PostText>;
  translation_state: TranslationStates;
  updated_at: string;
};

export type LegalKind = "privacy" | "terms" | "booking_terms" | "waiver" | "disclaimer" | "cookie_banner";

/** The four banner columns are present on kind cookie_banner only. */
export type LegalText = {
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  necessary_label?: string | null;
  necessary_body?: string | null;
  analytics_label?: string | null;
  analytics_body?: string | null;
};

export type LegalBlockDetail = {
  id: string;
  position: number;
  kind: "heading" | "paragraph" | "quote";
  translations: Translations<{ text: string | null }>;
};

export type LegalSummary = { id: string; kind: LegalKind; is_published: boolean; translation_state: TranslationStates; updated_at: string };

export type LegalDetail = {
  id: string;
  kind: LegalKind;
  is_published: boolean;
  blocks: LegalBlockDetail[];
  translations: Translations<LegalText>;
  translation_state: TranslationStates;
  updated_at: string;
};

export type SiteRequestKind = "plan" | "list" | "package" | "consultation";

export type SiteRequestSummary = {
  id: string;
  kind: SiteRequestKind;
  locale: Locale3;
  name: string;
  email: string;
  /** The guest's fields of that kind (lib/site-requests/types.ts), as sent. */
  payload: Record<string, unknown>;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  /** Kind consultation: the booked slot and whether it is still booked. */
  consultation?: { booking_id: string; slot_start: string; status: "booked" | "cancelled" } | null;
};

/** Weekly hours in Asia/Dubai: ISO weekday (1 = Monday … 7), "HH:MM" on :00 or :30. */
export type ConsultHours = { weekday: number; starts: string; ends: string };

export type ConsultSetup = {
  hours: ConsultHours[];
  days_off: IsoDay[];
  /** Null until the owner types them (F-04); while either is null the calendar is closed. */
  notice_hours: number | null;
  horizon_days: number | null;
  slot_minutes: 30;
  /** Booked slots from today on. */
  upcoming: Array<{ booking_id: string; request_id: string; slot_start: string; name: string }>;
};

// Write replies (03.2-04). Every save and delete answers `{ ok, id, affects_site }`; a reorder `{ ok, affects_site }`.
// After 03.2-05 a reply whose affects_site is true also carries `site: SiteStatus`.
export type WriteResult = { id: string; affects_site: boolean; site?: SiteStatus };
export type ReorderResult = { affects_site: boolean; site?: SiteStatus };
/** 5.4 add: overlapping_bookings is 0 until Phase 4 (plan 04-02); the screen shows the D-87 warning when above 0. */
export type BlockAddResult = WriteResult & { overlapping_bookings: number };
/** 5.3 set_base. */
export type BaseRateResult = WriteResult & { stay_id: string; base_nightly_rate_aed: Aed | null };
/** 5.4 GET. */
export type BlocksView = { blocks: Block[] };
/** 5.5 GET (and the save reply carries stay_id). */
export type StayAccessView = { stay_id: string; access: StayAccess | null };
/** The list and detail replies of 5.1, 5.2, 5.6, 5.7, 5.8. */
export type ListReply<T> = { items: T[] };
export type DetailReply<T> = { item: T };

// 5.9 Publish
export type PublishWarningCode = "no_base_rate" | "no_price";

export type PublishResult = {
  id: string;
  is_published: boolean;
  affects_site: true;
  warnings: { code: PublishWarningCode }[];
};

// 6 Site status (03.2-05 fills it; the client reads it from `site` in a write reply and from the almar:site event)
export type SiteStatus = {
  // "unavailable": the live site-version.json could not be read (not a 404), so no state is guessed (PR #13 finding 2).
  state: "up_to_date" | "updating" | "failed" | "unavailable";
  requested_seq: number;
  live_seq: number;
  requested_at: string | null;
  built_at: string | null;
  last_hook_at: string | null;
  last_hook_result: string | null;
};
