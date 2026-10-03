// Six local pictures for the public-component scenes: no media routing needed in the harness.
const FILES = [
  "01b7e3d407f3fb73",
  "024fb422e76dd53f",
  "055308b91c43eecc",
  "05c5854491d0153e",
  "07443a754d3d155a",
  "0787c0615a96af62",
];

export const IMAGES = FILES.map((name, i) => ({
  src: `/assets/img/${name}.webp`,
  alt: `[Photo ${i + 1}]`,
}));

/** A harness URL in the same locale, used as a link target a test can click and read back. */
export const harnessHref = (locale: string, state = "ok") => `/__harness?c=_smoke&s=${state}&l=${locale}`;
