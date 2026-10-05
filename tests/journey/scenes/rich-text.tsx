"use client";

import type { ReactNode } from "react";
import { RichText, type RichTextBlock } from "../../../components/ui/rich-text";
import type { Scenes } from "../scene-types";

const wrap = (node: ReactNode) => (
  <div data-testid="harness-rich" className="mx-auto w-full max-w-column p-4">
    {node}
  </div>
);

const PARAGRAPHS: RichTextBlock[] = [
  { type: "paragraph", text: "[Body text one]" },
  { type: "paragraph", text: "[Body text two]" },
  { type: "paragraph", text: "[Body text three]" },
];

const FULL: RichTextBlock[] = [
  { type: "paragraph", text: "[Body text]" },
  { type: "heading", text: "[Section title one]", id: "section-1" },
  { type: "paragraph", text: "[Body text]" },
  { type: "quote", text: "[Pull quote]" },
  { type: "heading", text: "[Section title two]", id: "section-2" },
  { type: "paragraph", text: "[Body text]" },
];

const LONG_AR: RichTextBlock[] = [
  { type: "paragraph", text: "[نص الفقرة]" },
  { type: "heading", text: "[عنوان القسم الأول]", id: "section-1" },
  { type: "paragraph", text: "[نص الفقرة]" },
  { type: "quote", text: "[اقتباس]" },
  { type: "heading", text: "[عنوان القسم الثاني]", id: "section-2" },
  { type: "paragraph", text: "[نص الفقرة]" },
];

export const scenes: Scenes = {
  paragraphs: () => wrap(<RichText blocks={PARAGRAPHS} />),
  full: () => wrap(<RichText blocks={FULL} />),
  "long-ar": () => wrap(<RichText blocks={LONG_AR} />),
};
