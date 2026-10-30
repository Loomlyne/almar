# 06-04 Cookie settings on the booking pages (owner, 2026-10-30 13:08 +0100)

Answered by the owner in the controller session, question form, after a picture of both options.

**B, the link as signed:** the booking and trip pages keep Cookie settings in the Legal row, so the row matches every other page, and the banner and analytics run on those addresses too.

Stated to the owner before he chose: analytics may see the stay, the dates and the booking link in those addresses unless Cloudflare is confirmed to drop them first. Nothing runs until `CF_WEB_ANALYTICS_TOKEN` is set (the owner's Cloudflare step). The build at `e48ec50f` had left the link out; this replaces that.
