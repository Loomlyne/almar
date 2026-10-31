import { ProfileView } from "../../../app/dashboard/(ops)/profile/profile-screen";
import { DASHBOARD_COPY } from "../../../lib/copy/dashboard";
import { OPS_HOME_COPY } from "../../../lib/copy/ops-home";
import type { Scenes } from "../scene-types";

/** The ops Profile page (plan 05-04): the session's name and email, read-only, no sign-out (the rail has both). A fixture, so the scene never fetches. */
export const scenes: Scenes = {
  profile: ({ locale }) => (
    <ProfileView name="Owner Example" email="owner@example.com" copy={OPS_HOME_COPY[locale].profile} title={DASHBOARD_COPY[locale].rail.profile} />
  ),
};
