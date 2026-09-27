import { GET as homeGet } from "../../route";
import { homePriceScript } from "../../../lib/fx/rates";
import { injectHeroBooker } from "../inject-hero-booker";

export const dynamic = "force-dynamic";

/** Framer's fixed site nav (desktop, phone, tablet) lives in this container. */
const HIDE_FRAMER_NAV =
  '<style id="almar-hide-framer-nav">.framer-16ndy5u-container{display:none!important}</style>';

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const response = homeGet();
  const html = await response.text();
  const withNavHidden = html.includes("</head>")
    ? html.replace("</head>", `${HIDE_FRAMER_NAV}</head>`)
    : HIDE_FRAMER_NAV + html;
  // Comment 7. Real HeroBooker replaces the hero button. Header stays in FramerShell.
  const withBooker = injectHeroBooker(withNavHidden);
  const priceScript = `<script id="almar-fx-prices">${homePriceScript()}</script>`;
  const withPrices = withBooker.includes('id="almar-fx-prices"')
    ? withBooker
    : withBooker.includes("</body>")
      ? withBooker.replace("</body>", `${priceScript}</body>`)
      : `${withBooker}${priceScript}`;

  return new Response(withPrices, {
    status: response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
