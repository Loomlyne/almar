// Renders a React component of this repo to static HTML on the server, the way `next build` prerenders it, so a
// node test can assert on the markup. esbuild bundles the module with React; a brand SVG import becomes
// { src: "/_next/static/media/<file>" } as in the Next build, so the component's `.src` reads work.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const svgAsNextImage = {
  name: "svg-as-next-image",
  setup(b) {
    b.onLoad({ filter: /\.svg$/ }, (args) => ({
      contents: `export default { src: ${JSON.stringify(`/_next/static/media/${basename(args.path)}`)}, width: 1, height: 1 };`,
      loader: "js",
    }));
  },
};

// next/font/* only exists inside the Next compiler; a test gets the shape it returns, with no class names.
const nextFontStub = {
  name: "next-font-stub",
  setup(b) {
    b.onResolve({ filter: /^next\/font\// }, (args) => ({ path: args.path, namespace: "next-font-stub" }));
    b.onLoad({ filter: /.*/, namespace: "next-font-stub" }, () => ({
      contents:
        'const font = () => ({ className: "", variable: "", style: {} });' +
        "export default font; export const Noto_Naskh_Arabic = font; export const Noto_Sans_Arabic = font;",
      loader: "js",
    }));
  },
};

/**
 * @param {string} modulePath repo-relative path of the module, for example "components/ui/nav.tsx"
 * @param {string} exportName the exported component
 * @returns {Promise<(props: object) => string>} props to markup
 */
export async function loadRenderer(modulePath, exportName) {
  const out = await build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { ${exportName} as Component } from ${JSON.stringify(`./${modulePath}`)};
        export const render = (props) => renderToStaticMarkup(createElement(Component, props));
      `,
      resolveDir: resolve(process.cwd()),
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    logLevel: "silent",
    plugins: [svgAsNextImage, nextFontStub],
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-render-")), "render.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return createRequire(file)(file).render;
}
