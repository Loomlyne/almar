// Owner API, plan 06-03: blog posts (SITE-10, F-08). GET list | ?id=; POST save | delete. Publish: /api/ops/publish.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getPosts, postPosts } from "../../../../lib/ops/posts-handlers";
import { POSTS_BODY_LIMIT, parsePostAction } from "../../../../lib/ops/validate-posts";

export const dynamic = "force-dynamic";
export const GET = opsGet(getPosts);
// A post's body blocks need more than the 64 KiB default; the cap is read after the owner and Origin checks.
export const POST = opsPost(parsePostAction, postPosts, { bodyLimit: POSTS_BODY_LIMIT });
