// lib/ops/site-cms-api.ts (plan 06-01, Task 4)
//
// Types only: the request bodies and replies of every endpoint 06-02…06-07 build on the SQL of migration
// 20261025120000_site_cms.sql. The names here are fixed; a later plan builds its route on them and never redefines them
// (a change goes through the controller). Replies reuse the client mirror in components/ops/api-types.ts.
//
// Endpoint -> SQL:
//   GET  /api/ops/pages?page=          ops_list_page(p_page)                    -> DetailReply<PageView>            06-02
//   POST /api/ops/pages                ops_save_page_section(p)                 -> WriteResult                      06-02
//   POST /api/ops/page-items           ops_save_page_item / ops_delete / ops_reorder('page_item')                   06-02
//   GET  /api/ops/nav?area=            ops_list('nav_link')                     -> DetailReply<NavView>             06-02
//   POST /api/ops/nav                  ops_save_nav(p_area, p_links)            -> ReorderResult                    06-02
//   GET  /api/ops/posts[?id=]          ops_list('post') / ops_get('post', id)   -> ListReply<PostSummary> | DetailReply<PostDetail>  06-03
//   POST /api/ops/posts                ops_save_post(p) / ops_delete('post')    -> WriteResult                      06-03
//   GET  /api/ops/legal[?kind=]        ops_list('legal_page') / ops_get          -> ListReply<LegalSummary> | DetailReply<LegalDetail> 06-04
//   POST /api/ops/legal                ops_save_legal_page(p)                   -> WriteResult                      06-04
//   POST /api/ops/publish              ops_publish(entity post | legal_page)    -> PublishResult                    06-03, 06-04
//   GET  /api/ops/requests?kind=&handled=  ops_list_requests(p_kind, p_handled) -> ListReply<SiteRequestSummary>   06-05
//   POST /api/ops/requests             ops_set_request_handled(p_id, p_handled, p_actor) -> WriteResult             06-05
//   GET  /api/ops/consult              ops_get_consult()                        -> DetailReply<ConsultSetup>        06-05
//   POST /api/ops/consult              ops_save_consult(p) / ops_cancel_consultation(p_id, p_actor) -> WriteResult  06-05
//   GET  /api/ops/journeys[?id=]       ops_get('journey_tier') now with legs and addon_ids -> JourneyDetailWithLegs 06-06
//   POST /api/ops/journeys             ops_save_journey_tier(p): create, legs, addon_ids -> WriteResult             06-06
//   POST /api/requests                 submit_site_request(kind, locale, payload) -> { id }   (almar, public)       06-05, 06-06
//   GET  /api/consult/slots?from=&to=  consult_slots(p_from, p_to)              -> ConsultSlotsReply  (almar)       06-05
//   POST /api/consult/book             book_consultation(locale, payload)       -> ConsultBookReply   (almar)       06-05
//   GET/POST/DELETE /api/saved-stays   saved_stays (authenticated, RLS)         -> SavedStaysReply    (almar)       06-07

import type {
  IsoDay,
  Locale3,
  NavArea,
  PageItemText,
  PageSectionText,
  PostBlockKind,
  PostText,
  JourneyText,
  LegalKind,
  LegalText,
  Translations,
} from "../../components/ops/api-types";
import type { SiteRequestKind, SiteRequestPayload } from "../site-requests/types";

/** A translations body as the save endpoints take it: absent locale untouched, null deletes (never en). */
export type TranslationsBody<T> = Partial<Translations<Partial<T>>>;

// ---- 06-02 Pages, About cards, header and footer -----------------------------------------------------------------

/** POST /api/ops/pages. `media`: slot -> media ids in order (replaced whole per slot sent); unknown slot -> invalid. */
export type SavePageSectionBody = {
  id: string;
  is_shown?: boolean;
  /** https only (CMS-06), on a hero section only; null clears it. */
  video_url?: string | null;
  media?: Record<string, string[]>;
  translations?: TranslationsBody<PageSectionText>;
};

/** POST /api/ops/page-items, one action per call. */
export type PageItemsBody =
  | { action: "save"; id?: string; section_id?: string; slug?: string; media_id?: string | null; is_shown?: boolean; translations?: TranslationsBody<PageItemText> }
  | { action: "delete"; id: string }
  | { action: "reorder"; section_id: string; ids: string[] };

/** One link as POST /api/ops/nav sends it; the area's list is replaced whole, in this order. Login is never sent. */
export type NavLinkBody = {
  id?: string;
  is_shown: boolean;
  link_kind: "internal" | "external";
  target: string;
  translations: TranslationsBody<{ label: string }>;
};
export type SaveNavBody = { area: NavArea; links: NavLinkBody[] };

// ---- 06-03 Blog ----------------------------------------------------------------------------------------------------

export type PostBlockBody = {
  kind: PostBlockKind;
  /** Photo blocks only. */
  media_id?: string | null;
  translations?: TranslationsBody<{ text: string }>;
};

/** POST /api/ops/posts: save (no id creates), or delete. `blocks` replaces the body whole when present. */
export type PostsBody =
  | {
      action: "save";
      id?: string;
      slug?: string;
      cover_media_id?: string | null;
      published_at?: string | null;
      destination_id?: string | null;
      featured_stay_id?: string | null;
      featured_experience_id?: string | null;
      blocks?: PostBlockBody[];
      translations?: TranslationsBody<PostText>;
    }
  | { action: "delete"; id: string };

// ---- 06-04 Legal and the cookie banner -----------------------------------------------------------------------------

/** POST /api/ops/legal. The six rows exist; banner columns only on kind cookie_banner. */
export type SaveLegalBody = {
  kind: LegalKind;
  translations?: TranslationsBody<LegalText>;
  blocks?: Array<{ kind: "heading" | "paragraph" | "quote"; translations?: TranslationsBody<{ text: string }> }>;
};

/** booking_terms_current() (service role only): what 06-04's bookingTermsGate reads. */
export type BookingTermsCurrent = { published: false } | { published: true; version: string };

// ---- 06-05 Requests and consultation -------------------------------------------------------------------------------

export type RequestsQuery = { kind: SiteRequestKind | "all"; handled: "yes" | "no" | "all" };
export type SetHandledBody = { id: string; handled: boolean };

/** POST /api/ops/consult: setup fields (each replaced when present) or a cancel. */
export type ConsultBody =
  | {
      action: "save";
      hours?: Array<{ weekday: number; starts: string; ends: string }>;
      days_off?: IsoDay[];
      notice_hours?: number | null;
      horizon_days?: number | null;
    }
  | { action: "cancel"; booking_id: string };

/** POST /api/requests (public). `website` is the honeypot (SITE-12): non-empty -> dropped as spam. */
export type SubmitRequestBody<K extends "plan" | "list" | "package" = "plan" | "list" | "package"> = {
  kind: K;
  locale: Locale3;
  website?: string;
} & SiteRequestPayload[K];
export type SubmitRequestReply = { id: string };

export type ConsultSlotsReply = { slots: string[]; time_zone: "Asia/Dubai" };
export type ConsultBookBody = { locale: Locale3; website?: string } & SiteRequestPayload["consultation"];
export type ConsultBookReply = { request_id: string; booking_id: string; slot_start: string };
/** The refusal codes of book_consultation (almar:<code>). */
export type ConsultRefusal = "consult_closed" | "slot_taken" | "slot_outside_hours" | "slot_too_soon" | "slot_too_far" | "invalid";

// ---- 06-06 Packages ------------------------------------------------------------------------------------------------

export type JourneyLegBody = {
  destination_id: string;
  stay_id?: string | null;
  translations?: TranslationsBody<{ nights_label: string }>;
};

/** POST /api/ops/journeys save: no id creates (slug required, locked once published); legs and addon_ids replaced whole. */
export type SaveJourneyBody = {
  id?: string;
  slug?: string;
  legs?: JourneyLegBody[];
  addon_ids?: string[];
  translations?: TranslationsBody<JourneyText>;
};

// ---- 06-07 Saved stays ---------------------------------------------------------------------------------------------

export type SavedStaysReply = { stay_ids: string[] };
export type SaveStayBody = { stay_id: string };
