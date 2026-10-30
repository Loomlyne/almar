// Plan 06-04: the request validators of /api/ops/legal, in the style of validate-posts.ts. The caps are the plan's (tighter
// than migration 20261025120000's columns, which take the same text); ops_save_legal_page is the authority on what a kind
// may hold and refuses the banner columns on every other kind as well. No legal text is written anywhere (F-07).

import type { SaveLegalBody } from "./site-cms-api";
import { OpsInvalid } from "./route-core";
import { has, isRecord, onlyKeys, record, translations, type TextSpec } from "./validate";

export const LEGAL_KINDS = ["privacy", "terms", "booking_terms", "waiver", "disclaimer", "cookie_banner"] as const;
export type LegalKindName = (typeof LEGAL_KINDS)[number];

/** A legal page in three languages is longer than the default 64 KiB; the same cap as a post (route.ts bodyLimit). */
export const LEGAL_BODY_LIMIT = 256 * 1024;

export const LEGAL_CAPS = { title: 160, seo_title: 70, seo_description: 170, label: 160, body: 5000, block: 6000, blocks: 200 } as const;

/** The five page kinds: no banner column, so one sent is refused with its own field name. */
export const LEGAL_PAGE_TEXT: TextSpec = {
  required: ["title"],
  fields: {
    title: { kind: "text", max: LEGAL_CAPS.title },
    seo_title: { kind: "text", max: LEGAL_CAPS.seo_title },
    seo_description: { kind: "text", max: LEGAL_CAPS.seo_description },
  },
};

/** The banner is never a page: its title and the four category fields, no search engine fields. */
export const LEGAL_BANNER_TEXT: TextSpec = {
  required: ["title"],
  fields: {
    title: { kind: "text", max: LEGAL_CAPS.title },
    necessary_label: { kind: "text", max: LEGAL_CAPS.label },
    necessary_body: { kind: "text", max: LEGAL_CAPS.body },
    analytics_label: { kind: "text", max: LEGAL_CAPS.label },
    analytics_body: { kind: "text", max: LEGAL_CAPS.body },
  },
};

export const LEGAL_BLOCK_TEXT: TextSpec = { required: ["text"], fields: { text: { kind: "text", max: LEGAL_CAPS.block } } };

const BLOCK_KINDS = ["heading", "paragraph", "quote"] as const;
type LegalBlockBody = NonNullable<SaveLegalBody["blocks"]>[number];

function kindOf(value: unknown): LegalKindName {
  if (typeof value !== "string" || !(LEGAL_KINDS as readonly string[]).includes(value)) throw new OpsInvalid("kind");
  return value as LegalKindName;
}

export function parseLegalQuery(query: URLSearchParams): { kind: LegalKindName | null } {
  const kind = query.get("kind");
  return { kind: kind === null ? null : kindOf(kind) };
}

function block(value: unknown, path: string): LegalBlockBody {
  const b = record(value, path);
  onlyKeys(b, ["kind", "translations"], `${path}.`);
  if (typeof b.kind !== "string" || !(BLOCK_KINDS as readonly string[]).includes(b.kind)) throw new OpsInvalid(`${path}.kind`);
  try {
    // Every block is written whole: English is required (create rules), ar/es as sent.
    return { kind: b.kind as LegalBlockBody["kind"], translations: translations(b.translations, LEGAL_BLOCK_TEXT, { create: true }) as LegalBlockBody["translations"] };
  } catch (error) {
    if (error instanceof OpsInvalid) throw new OpsInvalid(`${path}.${error.field}`, error.locale);
    throw error;
  }
}

export function parseLegalSave(value: unknown): SaveLegalBody {
  if (!isRecord(value)) throw new OpsInvalid("body");
  onlyKeys(value, ["kind", "translations", "blocks"]);
  const kind = kindOf(value.kind);
  const out: SaveLegalBody = { kind };
  if (has(value, "translations")) {
    // The six rows exist, so nothing is a create here; a record that is new is the database's to refuse without a title.
    out.translations = translations(value.translations, kind === "cookie_banner" ? LEGAL_BANNER_TEXT : LEGAL_PAGE_TEXT, { create: false }) as SaveLegalBody["translations"];
  }
  if (has(value, "blocks")) {
    if (!Array.isArray(value.blocks) || value.blocks.length > LEGAL_CAPS.blocks) throw new OpsInvalid("blocks");
    out.blocks = value.blocks.map((b, i) => block(b, `blocks.${i}`));
  }
  return out;
}
