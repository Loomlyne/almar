// Type-only, checked by `tsc --noEmit`: RichTextBlock (components/ui) and PostBlock (lib/data) must stay mutually assignable.
import type { RichTextBlock } from "../../components/ui/rich-text";
import type { PostBlock } from "../../lib/data/types";

export const toPost = (block: RichTextBlock): PostBlock => block;
export const toRich = (block: PostBlock): RichTextBlock => block;
