import { readFileSync } from "node:fs";
import { join } from "node:path";

export const NOT_FOUND_TITLE = "Page not found | ALMAR";
export const NOT_FOUND_HEADING = "Page not found";
export const NOT_FOUND_LINK_LABEL = "Return home";
export const NOT_FOUND_HREF = "/";
export const MONOGRAM_FILE = "brand/Logo Monogram/Curves_black.svg";

export function renderStaticNotFound() {
  const svg = readFileSync(join(process.cwd(), MONOGRAM_FILE), "utf8")
    .replace(/<\?xml[\s\S]*?\?>/, "")
    .replace(/<!DOCTYPE[\s\S]*?>/, "");

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${NOT_FOUND_TITLE}</title>
<style>
  body { margin: 0; background: #fffaf0; color: #262626; font-family: Georgia, serif; }
  main { max-width: 40rem; margin-inline: auto; padding: 4rem 1rem; }
  svg { width: 8rem; height: auto; }
  h1 { font-weight: 400; font-size: 2rem; line-height: 1.1; }
  a { color: #1f3b40; text-decoration: none; }
</style>
</head>
<body>
<main>
<!-- ${MONOGRAM_FILE} -->
${svg}
<h1>${NOT_FOUND_HEADING}</h1>
<a href="${NOT_FOUND_HREF}">${NOT_FOUND_LINK_LABEL}</a>
</main>
</body>
</html>`;
}
