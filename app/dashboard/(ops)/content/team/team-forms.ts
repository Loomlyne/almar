// The pure side of Content -> Team (plan 03.2-08): form state, the link and email rules, and the live Arabic and Spanish
// fields for the kit editor. No React, no fetch, no directive. The save payload (teamPayload) joins this file in Task 2,
// after the owner signs the pictures.

import type { Locale3, MediaRef, TeamDetail, TeamLink, TextStatus } from "../../../../../components/ops/api-types";
import type { LiveFields } from "../../../../../components/ops/auto-translate";

/** The platforms a member's link may be (contract 5.7 stores the name as the link's label). */
export const LINK_PLATFORMS = ["Instagram", "LinkedIn", "Facebook", "X"] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

/** The most links a member has (contract 5.7) and the longest address the server takes. */
export const MAX_LINKS = 8;
export const MAX_LINK_URL = 300;

export const TEAM_TEXT_FIELDS = ["name", "role", "bio"] as const;
export type TeamTextField = (typeof TEAM_TEXT_FIELDS)[number];
/** The text of one language. Empty string = not set. */
export type TeamText = Record<TeamTextField, string>;

/** One link row as typed. `key` keeps the row's identity in the list while rows are added and removed. */
export type LinkRow = { key: string; label: LinkPlatform; url: string };

export type TeamForm = {
  id: string | null;
  slug: string;
  published: boolean;
  photo: MediaRef | null;
  /** As typed; "" = none (sent as null). Never shown on the public site. */
  email: string;
  links: LinkRow[];
  text: Record<Locale3, TeamText>;
  /** Arabic and Spanish go live with the English on Publish (owner, 2026-10-14). */
  status: Record<Locale3, TextStatus>;
};

const blankText = (): TeamText => ({ name: "", role: "", bio: "" });

export function emptyTeamForm(): TeamForm {
  return {
    id: null,
    slug: "",
    published: false,
    photo: null,
    email: "",
    links: [],
    text: { en: blankText(), ar: blankText(), es: blankText() },
    status: { en: "published", ar: "draft", es: "draft" },
  };
}

let rowCount = 0;
/** A new row key. */
export const linkKey = () => `link-${++rowCount}`;

const isPlatform = (label: string): label is LinkPlatform => (LINK_PLATFORMS as readonly string[]).includes(label);

/** The form for a member as the server returns it. A stored label outside the list reads as the first platform. */
export function teamForm(detail: TeamDetail): TeamForm {
  const text = (locale: Locale3): TeamText => {
    const record = detail.translations[locale];
    return { name: record?.name ?? "", role: record?.role ?? "", bio: record?.bio ?? "" };
  };
  const status = (locale: Locale3): TextStatus => (locale === "en" ? "published" : (detail.translations[locale]?.status ?? "draft"));
  return {
    id: detail.id,
    slug: detail.slug,
    published: detail.is_published,
    photo: detail.photo,
    email: detail.email ?? "",
    links: detail.links.map((link) => ({ key: linkKey(), label: isPlatform(link.label) ? link.label : LINK_PLATFORMS[0], url: link.url })),
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    status: { en: status("en"), ar: status("ar"), es: status("es") },
  };
}

export type LinkProblem = "https" | "too_long" | "label";
export type LinkCheck = {
  /** The rows to send: empty addresses dropped, the rest trimmed. */
  links: TeamLink[];
  /** By row key. */
  problems: Record<string, LinkProblem>;
  /** More than eight rows with an address. */
  tooMany: boolean;
  ok: boolean;
};

/**
 * The link rule of contract 5.7 as the screen shows it: a platform from the list and an https address of at most 300
 * characters, at most eight. A row with no address is dropped, not refused. The server checks again.
 */
export function validateLinks(rows: readonly LinkRow[]): LinkCheck {
  const problems: Record<string, LinkProblem> = {};
  const links: TeamLink[] = [];
  for (const row of rows) {
    const url = row.url.trim();
    if (url === "") continue;
    if (!isPlatform(row.label)) problems[row.key] = "label";
    else if (url.length > MAX_LINK_URL) problems[row.key] = "too_long";
    else if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) problems[row.key] = "https";
    links.push({ label: row.label, url });
  }
  const tooMany = links.length > MAX_LINKS;
  return { links, problems, tooMany, ok: !tooMany && Object.keys(problems).length === 0 };
}

/** "" is no email; anything else must look like an address (one @, a dot in the domain, no space). */
export function emailOk(email: string): boolean {
  const value = email.trim();
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// The server's web-address rule (lib/ops/validate.ts SLUG and the 80 cap; the team_members check is the same).
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "needed": a member that is not published has no address yet; "pattern": not lowercase letters, numbers and dashes. */
export type SlugProblem = "needed" | "pattern";

/**
 * The web address as the screen checks it, the same as on stays: the owner types it (owner, 2026-10-17: shown, never
 * filled in silently). A published member's address cannot change, so it is not checked and not sent.
 */
export function slugProblem(form: Pick<TeamForm, "slug" | "published">): SlugProblem | null {
  if (form.published) return null;
  const slug = form.slug.trim();
  if (slug === "") return "needed";
  return slug.length > 80 || !SLUG.test(slug) ? "pattern" : null;
}

/** What Save sends for the address: as typed (trimmed) while the member is not published; nothing once it is. */
export function slugToSend(form: Pick<TeamForm, "slug" | "published">): { slug: string } | Record<string, never> {
  return form.published ? {} : { slug: form.slug.trim() };
}

/**
 * The Arabic and Spanish fields on the site now, for the kit editor's `liveTranslations`: only a published member is on
 * the site, and in it only a language published with text. `saved` is the text as last saved, not as typed.
 */
export function liveTeamFields(published: boolean, status: Record<Locale3, TextStatus>, saved: Record<Locale3, TeamText>): LiveFields {
  if (!published) return {};
  const live: LiveFields = {};
  for (const target of ["ar", "es"] as const) {
    if (status[target] !== "published") continue;
    live[target] = TEAM_TEXT_FIELDS.filter((field) => saved[target][field].trim() !== "");
  }
  return live;
}
