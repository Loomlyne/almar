"use client";

import { useLayoutEffect, useEffect, useState, type ReactNode } from "react";
import { copy } from "../../lib/copy";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";
import * as fixtures from "../../tests/journey/fixtures";
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
      let scenes: Scenes | undefined;
      try {
        const mod = await import(`../../tests/journey/scenes/${c}`);
        scenes = mod.scenes as Scenes;
      } catch {
        scenes = undefined;
      }
      const scene = scenes?.[s];
      if (!live) return;
      setContent(
        scene ? scene({ locale: l, copy: copy[l].journey, fixtures }) : <p data-testid="harness-unknown">unknown scene</p>,
      );
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
