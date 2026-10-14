"use client";

import { useLayoutEffect, useEffect, useState, type ReactNode } from "react";
import { copy } from "../../lib/copy";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";
import type { Scenes } from "../../tests/journey/scene-types";

export function HarnessClient({ c, s, l }: { c: string; s: string; l: DocumentLocale }) {
  const [ready, setReady] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);

  useLayoutEffect(() => {
    setDocumentLocale(l);
    setReady(true);
  }, [l]);

  useEffect(() => {
    let live = true;
    (async () => {
      // Plan 03.2-12: the fixtures and the scene files are test code. Next inlines NODE_ENV, so a production build drops
      // this whole branch and its chunks (tests/harness-gate.test.mjs checks .next/ after a build); next dev keeps it.
      let node: ReactNode = <p data-testid="harness-unknown">unknown scene</p>;
      if (process.env.NODE_ENV !== "production") {
        const fixtures = await import("../../tests/journey/fixtures");
        let scenes: Scenes | undefined;
        try {
          const mod = await import(`../../tests/journey/scenes/${c}`);
          scenes = mod.scenes as Scenes;
        } catch {
          scenes = undefined;
        }
        const scene = scenes?.[s];
        if (scene) node = scene({ locale: l, copy: copy[l].journey, fixtures });
      }
      if (!live) return;
      setContent(node);
    })();
    return () => {
      live = false;
    };
  }, [c, s, l]);

  return (
    <main id="harness-root" style={{ visibility: ready && content ? "visible" : "hidden" }}>
      {content}
    </main>
  );
}
