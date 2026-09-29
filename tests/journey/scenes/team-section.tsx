import { TeamSection } from "../../../components/journey/team-section";
import type { TeamMember } from "../../../components/journey/types";
import { copy } from "../../../lib/copy";
import type { Scenes, SceneContext } from "../scene-types";

const title = (ctx: SceneContext) => copy[ctx.locale].home.teamTitle;
const three: TeamMember[] = [
  { id: "p1", name: "[Name]", role: "[Role]" },
  { id: "p2", name: "[Name]", role: "[Role]" },
  { id: "p3", name: "[Name]", role: "[Role]" },
];

export const scenes: Scenes = {
  none: (ctx) => (
    <div data-testid="harness-team">
      <TeamSection members={ctx.fixtures.teamNone} title={title(ctx)} placeholder />
    </div>
  ),
  "one-placeholder": (ctx) => (
    <div data-testid="harness-team">
      <TeamSection members={ctx.fixtures.teamOne} title={title(ctx)} placeholder />
    </div>
  ),
  "three-placeholder": (ctx) => (
    <div data-testid="harness-team" className="w-column max-w-full">
      <TeamSection members={three} title={title(ctx)} placeholder />
    </div>
  ),
  "with-email": (ctx) => (
    <div data-testid="harness-team">
      <TeamSection
        members={[{ id: "p1", name: "[Name]", role: "[Role]", email: "[email]@example.com" }]}
        title={title(ctx)}
        placeholder
      />
    </div>
  ),
};
