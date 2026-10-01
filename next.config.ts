import type { NextConfig } from "next";

// Curves_black.svg and Poly_Black.svg are imported as markup strings
// (status-frame, stay-row, design-kit build a data: URL from them), so they use
// asset/source. Next's own static-image rule also matches .svg, so it is
// excluded for these two files. Every other brand SVG (Stacked_Charcoal.svg,
// Poly_White.svg, Curves_White.svg) stays a static-image object: use `.src`.
// FALLBACK if the exclude ever stops working: drop this rule and readFileSync
// the file in the server component, as lib/not-found-document.ts does.
const MARKUP_SVG = /(Curves_black|Poly_Black)\.svg$/;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    const rules: Array<{ test?: unknown; exclude?: unknown }> = config.module.rules;
    const imageRule = rules.find(
      (rule) => rule.test instanceof RegExp && rule.test.test(".svg"),
    );
    if (imageRule) imageRule.exclude = MARKUP_SVG;
    config.module.rules.push({ test: MARKUP_SVG, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
