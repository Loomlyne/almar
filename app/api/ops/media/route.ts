// Owner API, contract 5.10 (plan 03.2-09): the photo library. GET lists one page of it (ops_list_media, searched and
// paged in SQL; job 03.2-09b), PUT uploads one photo to R2 through the ops Worker's MEDIA binding (never Supabase
// Storage), POST saves alt text or deletes a library row (the R2 object is kept). Every method is wrapped:
// requireOwner() runs first, then the Origin check (PUT, POST).
import { mediaBucket } from "../../../../lib/ops/media-env";
import { listMedia, postMedia, uploadCore } from "../../../../lib/ops/media-upload";
import { opsGet, opsPost, opsPut } from "../../../../lib/ops/route";
import { parseMediaPost } from "../../../../lib/ops/validate-media";

export const dynamic = "force-dynamic";

export const GET = opsGet(({ owner, url }) =>
  listMedia({
    listPage: ({ q, after, limit }) => owner.admin.rpc("ops_list_media", { p_q: q, p_after: after, p_limit: limit }),
    url,
  }),
);

export const PUT = opsPut(({ owner, request }) =>
  uploadCore({
    headers: request.headers,
    body: request.body,
    media: mediaBucket(),
    saveMedia: (p) => owner.admin.rpc("ops_save_media", { p }),
    makeLengthStream: (length) => new FixedLengthStream(length),
  }),
);

export const POST = opsPost(parseMediaPost, ({ owner, body }) =>
  postMedia({
    body,
    saveAlts: (p) => owner.admin.rpc("ops_save_image_alts", { p }),
    deleteMedia: (id) => owner.admin.rpc("ops_delete_media", { p_id: id }),
  }),
);
