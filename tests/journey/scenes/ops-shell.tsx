import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import type { Scenes } from "../scene-types";

/** The ops host after the owner is in (plan 02-04): Not ready., the full rail, Sign out and Logout-all. */
export const scenes: Scenes = {
  owner: () => <OpsShell mode="ops">{null}</OpsShell>,
};
