import type { ReactNode } from "react";
import type { JourneyCopy, Locale } from "../../components/journey/types";
import type * as fixtures from "./fixtures";

export type SceneContext = {
  locale: Locale;
  copy: JourneyCopy;
  fixtures: typeof fixtures;
};

/** One state of one component, rendered by /__harness?c={component}&s={state}&l={locale}. */
export type Scene = (ctx: SceneContext) => ReactNode;

/** A scene file exports `scenes`: state name to scene. */
export type Scenes = Record<string, Scene>;
