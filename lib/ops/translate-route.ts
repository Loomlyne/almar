// Plan 03.2-10: the one place the Workers AI binding is reached. Server only. It lives here, not in
// app/api/ops/translate/route.ts, because tests/ops-route.test.mjs lets an ops route import only lib/ops/* modules.
// The binding `AI` exists only on Worker almar-ops (wrangler.ops.toml [ai]). Anywhere else (next dev, the public
// Worker, the preview Worker) getCloudflareContext() or env.AI is missing, `run` throws, and the answer is 502
// translate_failed: it fails closed. No test reaches this file's `run`: node tests pass a fake to translateHandler.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { TRANSLATE_MODEL, translateHandler, type AiRun } from "./translate";

type AiBinding = { run: (model: string, input: unknown) => Promise<unknown> };

function bindingRun(): AiRun {
  return async (input) => {
    const ai = (getCloudflareContext().env as { AI?: AiBinding }).AI;
    if (!ai) throw new Error("binding missing");
    return ai.run(TRANSLATE_MODEL, input);
  };
}

export const postTranslate = translateHandler(bindingRun);
