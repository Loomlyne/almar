import type { Scenes } from "../scene-types";

export const scenes: Scenes = {
  ok: ({ locale }) => (
    <div data-testid="harness-smoke">
      <h1 className="text-display">Smoke heading</h1>
      <h2>Plain heading</h2>
      <p data-testid="harness-locale">{locale}</p>
    </div>
  ),
};
