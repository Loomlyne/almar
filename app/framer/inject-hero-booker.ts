import { heroBookerStyle } from "./hero-booker-style";

const SCRIPT = `
(function () {
  var tries = 0;
  function hideJourney() {
    document.querySelectorAll('[data-framer-name="Hero Section"] a.framer-1wdb5js').forEach(function (node) {
      if (node.getAttribute("hidden") === "true") return;
      node.setAttribute("hidden", "true");
      node.style.setProperty("display", "none", "important");
    });
    var crude = document.getElementById("almar-booker");
    if (crude) crude.remove();
  }
  function place() {
    hideJourney();
    var hero = document.querySelector('[data-framer-name="Hero Section"] [data-framer-name="Content"]');
    if (!hero || !window.AlmarMountHeroBooker) return false;
    var host = document.getElementById("almar-hero-booker");
    if (!host) {
      host = document.createElement("div");
      host.id = "almar-hero-booker";
      var inner = document.createElement("div");
      inner.className = "kit-section";
      inner.id = "almar-hero-booker-root";
      host.appendChild(inner);
    }
    if (host.parentElement !== hero) hero.appendChild(host);
    var root = document.getElementById("almar-hero-booker-root");
    if (root && root.getAttribute("data-mounted") !== "1") {
      window.AlmarMountHeroBooker(root);
      root.setAttribute("data-mounted", "1");
    }
    return Boolean(root && root.getAttribute("data-mounted") === "1");
  }
  function tick() {
    tries += 1;
    if (!place() && tries < 80) window.setTimeout(tick, 50);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();
  window.addEventListener("load", place);
  var observer = new MutationObserver(function () {
    var hero = document.querySelector('[data-framer-name="Hero Section"] [data-framer-name="Content"]');
    var host = document.getElementById("almar-hero-booker");
    if (!hero) return;
    if (!host || host.parentElement !== hero || host.querySelector("[data-mounted]") == null) place();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () { observer.disconnect(); }, 8000);
})();
`;

export function injectHeroBooker(html: string) {
  if (html.includes('id="almar-hero-booker-style"')) return html;

  const style = `<style id="almar-hero-booker-style">${heroBookerStyle()}</style>`;
  const boot = `<script src="/embed/hero-booker" defer></script><script id="almar-hero-booker-boot">${SCRIPT}</script>`;
  let next = html.replace("</head>", `${style}</head>`);
  if (!next.includes('id="almar-hero-booker-style"')) next = `${style}${next}`;
  if (next.includes("</body>")) next = next.replace("</body>", `${boot}</body>`);
  else next = `${next}${boot}`;
  return next;
}
