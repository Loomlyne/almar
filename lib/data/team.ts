// lib/data/team.ts
//
// Server only. Published members only. Returns [] today, by design: the three invented members were removed
// on 2026-09-28 and 2026-10-02, and the public section renders nothing until Dashboard > Content > Team
// publishes someone (D-55, D-57). team.json is [] and never holds an invented person.

import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { Locale, TeamMember } from "./types";

type TeamBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  photo: RawImage | null;
  links: Array<{ label: string; url: string }>;
  is_published: boolean;
  position: number;
};
type TeamTranslation = {
  member_id: string;
  locale: Locale;
  status: StoredStatus;
  name: string;
  role: string | null;
  bio: string | null;
};

export async function getTeam(locale: Locale): Promise<TeamMember[]> {
  const translations = readFixture<TeamTranslation[]>("team-translations");
  return readFixture<TeamBase[]>("team")
    .filter((m) => m.is_published)
    .sort((a, b) => a.position - b.position)
    .map((m) => {
      const own = translations.filter((t) => t.member_id === m.id);
      return { ...resolveRow(m, own, locale), photo: image(m.photo, locale) } as TeamMember;
    });
}
