import { GET as homeGet } from "../../route";
import { homePriceScript } from "../../../lib/fx/rates";
import { injectHeroBooker } from "../inject-hero-booker";
import { FRAMER_SOURCE_COPY } from "../../../lib/framer-source-copy";
import { notoNaskh, notoSans } from "../../../lib/fonts";

export const dynamic = "force-dynamic";

/** Framer's fixed site nav (desktop, phone, tablet) lives in this container. */
const HIDE_FRAMER_NAV =
  '<style id="almar-hide-framer-nav">.framer-16ndy5u-container{display:none!important}</style>';

const NOTO_CLASS_NAMES = `${notoNaskh.variable} ${notoSans.variable}`.split(" ");

/** Accepts only en, ar, or es. Writes textContent from the repo table. Never innerHTML. */
function localeScript() {
  const table = JSON.stringify({
    en: FRAMER_SOURCE_COPY.en,
    ar: FRAMER_SOURCE_COPY.ar,
    es: FRAMER_SOURCE_COPY.es,
  });
  const noto = JSON.stringify(NOTO_CLASS_NAMES);
  return `(function () {
  var table = ${table};
  var notoNames = ${noto};
  var allowed = { en: 1, ar: 1, es: 1 };
  var locale = "en";
  var originals = new WeakMap();
  function isLocale(value) {
    return value === "en" || value === "ar" || value === "es";
  }
  function englishOf(current) {
    if (Object.prototype.hasOwnProperty.call(table.en, current)) return current;
    if (Object.prototype.hasOwnProperty.call(table.ar, current)) {
      for (var key in table.en) {
        if (table.ar[key] === current) return key;
      }
    }
    if (Object.prototype.hasOwnProperty.call(table.es, current)) {
      for (var key2 in table.en) {
        if (table.es[key2] === current) return key2;
      }
    }
    return "";
  }
  function apply(next) {
    if (!isLocale(next)) return;
    locale = next;
    var root = document.documentElement;
    root.lang = next;
    root.dir = next === "ar" ? "rtl" : "ltr";
    for (var i = 0; i < notoNames.length; i++) root.classList.remove(notoNames[i]);
    if (next === "ar") {
      for (var j = 0; j < notoNames.length; j++) root.classList.add(notoNames[j]);
    }
    var column = table[next];
    if (!column) return;
    var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (parent.closest("#almar-hero-booker, .framer-16ndy5u-container")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var stored = originals.get(node);
      var current = stored || node.textContent;
      if (!current || !current.trim()) continue;
      var english = stored || englishOf(current);
      if (!english || !Object.prototype.hasOwnProperty.call(table.en, english)) continue;
      if (!stored) originals.set(node, english);
      var translated = column[english];
      if (typeof translated !== "string" || node.textContent === translated) continue;
      node.textContent = translated;
    }
    var images = document.querySelectorAll("img[alt]");
    for (var k = 0; k < images.length; k++) {
      var image = images[k];
      var storedAlt = image.getAttribute("data-almar-alt-en");
      var alt = storedAlt || image.getAttribute("alt");
      if (!alt) continue;
      var englishAlt = storedAlt || englishOf(alt);
      if (!englishAlt || !Object.prototype.hasOwnProperty.call(table.en, englishAlt)) continue;
      if (!storedAlt) image.setAttribute("data-almar-alt-en", englishAlt);
      var nextAlt = column[englishAlt];
      if (typeof nextAlt !== "string" || image.getAttribute("alt") === nextAlt) continue;
      image.setAttribute("alt", nextAlt);
    }
  }
  window.addEventListener("message", function (event) {
    if (event.origin !== location.origin) return;
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (!allowed[data.locale]) return;
    if (Array.isArray(data.noto)) {
      notoNames = data.noto.filter(function (name) { return typeof name === "string" && name.length > 0 && name.length < 80; });
    }
    apply(data.locale);
  });
})();`;
}

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
  const localeTag = `<script id="almar-locale">${localeScript()}</script>`;
  const injected = `${priceScript}${localeTag}`;
  const withPrices = withBooker.includes('id="almar-fx-prices"')
    ? withBooker
    : withBooker.includes("</body>")
      ? withBooker.replace("</body>", `${injected}</body>`)
      : `${withBooker}${injected}`;

  return new Response(withPrices, {
    status: response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
