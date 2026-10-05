import { ProfileScreen } from "../../../app/dashboard/(ops)/profile/profile-screen";
import type { Scenes } from "../scene-types";

/** The ops Profile page (plan 02-25): Sign out posts to /auth/sign-out, Sign out everywhere calls the action. */
export const scenes: Scenes = {
  profile: () => <ProfileScreen />,
};
