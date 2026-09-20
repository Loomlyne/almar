// Branded 404 catch-all. Every page in this app is a route handler
// (app/**/route.ts) with no root layout, so the framework's not-found
// boundary (app/not-found.tsx) is never entered for arbitrary paths. A
// catch-all route handler is therefore the only reliable way to return
// branded HTML with a real 404 status for unknown URLs.
export const dynamic = "force-dynamic";

const HTML = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="generator" content="Framer 089ff9b">
<meta name="robots" content="noindex, follow">
<title>Page not found | ALMAR</title>
<meta name="description" content="The page you're looking for has moved or never existed. Return to ALMAR — Colombia, Privately Yours.">
<link href="/assets/img/754fb6d4bd4d3e48.svg" rel="icon" media="(prefers-color-scheme: light)">
<link href="/assets/img/754fb6d4bd4d3e48.svg" rel="icon" media="(prefers-color-scheme: dark)">
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Page not found | ALMAR">
<meta property="og:description" content="The page you're looking for has moved or never existed. Return to ALMAR — Colombia, Privately Yours.">
<!-- X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page not found | ALMAR">
<meta name="twitter:description" content="The page you're looking for has moved or never existed. Return to ALMAR — Colombia, Privately Yours.">
<style>
@font-face { font-family: "Questa Regular"; src: url(/assets/fonts/f2a9e3735ebb9669.woff); font-display: swap; font-style: normal; font-weight: 400 }
@font-face { font-family: "Bricolage Grotesque"; src: url(/assets/fonts/1ed9594761d535c5.woff2) format('woff2'); font-display: swap; font-style: normal; font-weight: 400 }
@font-face { font-family: "Bricolage Grotesque"; src: url(/assets/fonts/1ed9594761d535c5.woff2) format('woff2'); font-display: swap; font-style: normal; font-weight: 600 }
@font-face { font-family: "Lato"; src: url(/assets/fonts/a4bbb840febca7ae.woff2); font-display: swap; font-style: normal; font-weight: 400 }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body { background: #f9f6f3; color: #1f3b40; font-family: 'Bricolage Grotesque', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; padding: 18px 32px; background: rgba(249,246,243,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid rgba(31,59,64,0.08); }
.nav-group { display: flex; gap: 20px; align-items: center; }
.nav-link { color: #1f3b40; text-decoration: none; font-size: 12px; letter-spacing: 0.12em; font-weight: 500; }
.nav-brand { color: #1f3b40; text-decoration: none; font-family: 'Questa Regular', Georgia, serif; font-size: 22px; letter-spacing: 0.18em; font-weight: 400; }
.nav-cta { color: #f9f6f3; background: #1f3b40; padding: 8px 16px; border-radius: 999px; text-decoration: none; font-size: 12px; letter-spacing: 0.08em; font-weight: 600; }
main { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 160px 24px 80px; }
.eyebrow { font-family: 'Bricolage Grotesque', sans-serif; font-size: 12px; letter-spacing: 0.28em; color: #0f677d; margin-bottom: 20px; text-transform: uppercase; }
h1 { font-family: 'Questa Regular', Georgia, serif; font-size: clamp(40px, 7vw, 72px); line-height: 1.04; color: #1f3b40; font-weight: 400; letter-spacing: -0.02em; margin: 0 0 24px; }
.sub { font-family: 'Bricolage Grotesque', sans-serif; font-size: 18px; line-height: 1.6; color: #1f3b40; opacity: 0.8; max-width: 520px; margin: 0 auto 40px; }
.links { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.link-primary { display: inline-block; background: #1f3b40; color: #fffaf0; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0.04em; }
.link-secondary { display: inline-block; color: #1f3b40; padding: 14px 24px; border-radius: 999px; border: 1px solid rgba(31,59,64,0.2); text-decoration: none; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 500; font-size: 14px; letter-spacing: 0.04em; }
footer { border-top: 1px solid rgba(31,59,64,0.08); padding: 32px 24px; text-align: center; }
footer p { font-family: 'Bricolage Grotesque', sans-serif; font-size: 12px; color: #1f3b40; opacity: 0.6; }
footer a { color: #0f677d; text-decoration: none; }
</style>
</head>
<body>
<nav>
<div class="nav-group">
<a class="nav-link" href="/destinations">DESTINATIONS</a>
<a class="nav-link" href="/experiences">EXPERIENCES</a>
<a class="nav-link" href="/services">SERVICES</a>
</div>
<a class="nav-brand" href="/">ALMAR</a>
<div class="nav-group">
<a class="nav-link" href="/about">ABOUT</a>
<a class="nav-cta" href="/contact">CONTACT</a>
</div>
</nav>
<main>
<div>
<p class="eyebrow">404 — Not Found</p>
<h1>Page not found</h1>
<p class="sub">Let's get you back to Colombia, Privately Yours.</p>
<div class="links">
<a class="link-primary" href="/">Return Home</a>
<a class="link-secondary" href="/destinations">Destinations</a>
<a class="link-secondary" href="/contact">Contact</a>
</div>
</div>
</main>
<footer>
<p>© 2026 ALMAR Private Journeys — Colombia, Privately Yours · <a href="/">Home</a> · <a href="/destinations">Destinations</a> · <a href="/contact">Contact</a></p>
</footer>
</body>
</html>`;

export function GET() {
  return new Response(HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
