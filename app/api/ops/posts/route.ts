// Owner API, plan 06-03: blog posts (SITE-10, F-08). GET list | ?id=; POST save | delete. Publish: /api/ops/publish.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getPosts, postPosts } from "../../../../lib/ops/posts-handlers";
import { parsePostAction } from "../../../../lib/ops/validate-posts";

export const dynamic = "force-dynamic";
export const GET = opsGet(getPosts);
export const POST = opsPost(parsePostAction, postPosts);
