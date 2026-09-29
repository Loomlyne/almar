import { InclusionsList } from "../../../components/journey/inclusions-list";
import type { Scenes } from "../scene-types";

export const scenes: Scenes = {
  panel: (ctx) => (
    <div data-testid="harness-inclusions" className="w-column max-w-full">
      <InclusionsList items={ctx.fixtures.inclusions} locale={ctx.locale} copy={ctx.copy} />
    </div>
  ),
  compact: (ctx) => (
    <div data-testid="harness-inclusions" className="w-menu max-w-full">
      <InclusionsList
        items={ctx.fixtures.inclusions}
        variant="compact"
        locale={ctx.locale}
        copy={ctx.copy}
      />
    </div>
  ),
  empty: (ctx) => (
    <div data-testid="harness-inclusions">
      <InclusionsList items={[]} locale={ctx.locale} copy={ctx.copy} />
    </div>
  ),
};
