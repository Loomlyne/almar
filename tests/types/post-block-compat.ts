// Type-only, checked by `tsc --noEmit`: RichTextBlock's text blocks (components/ui) and PostBlock (lib/data) must stay
// mutually assignable. The photo block (plan 06-03) differs on purpose: lib/data holds an ImageRef, RichText takes its
// address and alt, so a post page maps one to the other.
import type { RichTextBlock } from "../../components/ui/rich-text";
import type { PostBlock } from "../../lib/data/types";

type RichTextBlockText = Exclude<RichTextBlock, { type: "photo" }>;

export const toPost = (block: RichTextBlockText): PostBlock => block;
export const toRich = (block: PostBlock): RichTextBlock => block;
