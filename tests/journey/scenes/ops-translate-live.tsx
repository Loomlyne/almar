"use client";

import { TranslateScene } from "./ops-translate";
import type { Scenes } from "../scene-types";

/**
 * The real Translate button, wired (plan 03.2-10 Task 2), for tests/ops-translate.spec.ts's behaviour block. The spec
 * answers POST /api/ops/translate with page.route fixtures (200 / 502 / 429); nothing reaches a server or Workers AI.
 * Kept out of ops-translate.tsx so the signed pictures' state list does not change. No pictures of these states.
 */
export const scenes: Scenes = {
  live: (ctx) => <TranslateScene ctx={ctx} variant="live" />,
  "live-existing": (ctx) => <TranslateScene ctx={ctx} variant="live-existing" />,
};
