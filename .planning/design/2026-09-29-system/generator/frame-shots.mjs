import fs from 'node:fs';
import { chromium } from '/Users/koss/Developer/almarprod-Website-Code/node_modules/playwright/index.mjs';

const dir = '/private/tmp/claude-501/-Users-koss-Developer-almarprod-Website-Code/314e86c7-e446-4af1-86cd-2b34d8c37426/scratchpad/canvas-root/project';
const out = '/private/tmp/claude-501/-Users-koss-Developer-almarprod-Website-Code/314e86c7-e446-4af1-86cd-2b34d8c37426/scratchpad/shots2';
fs.mkdirSync(out, { recursive: true });
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAMzMzAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
const [name, ...wanted] = process.argv.slice(2); // wanted: substrings of frame labels
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 3100, height: 1000 } });
const s = fs.readFileSync(`${dir}/${name}.dc.html`, 'utf8');
const dict = JSON.parse(s.match(/const DICT = (\{.*?\});\nconst FIXED/s)[1]);
let body = s.split('<x-dc>')[1].split('</x-dc>')[0].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
body = body.replace(/\{\{t\.(k\d+)\}\}/g, (_, key) => (dict[key] ? dict[key].en : ''));
const map = { dir: 'ltr', fd: 'Georgia, serif', fb: 'Arial, sans-serif', tt: 'uppercase', ls: '0.12em', tk: '-0.02em', flip: 'none', lhC: '1.5', lhL: '1.43', lhB: '1.5', lhT: '1.3', lh2: '1.2', lh1: '1.1', lh0: '1.05' };
body = body.replace(/\s*(onClick|aria-pressed)="\{\{[^}]*\}\}"/g, '').replace(/\{\{(\w+)\}\}/g, (_, k2) => (map[k2] ?? '')).replace(/\{\{sw\.\w+\}\}/g, '');
// keep real photos as neutral blocks
body = body.replace(/\/_blob\/[0-9a-f]+/g, GIF);
await pg.setContent(`<!doctype html><html><body style="margin:0;background:#eee">${body}</body></html>`);
await pg.waitForTimeout(300);
const frames = await pg.$$('div[style*="position:relative;width:"][style*="overflow:hidden"]');
let n = 0;
for (const f of frames) {
  const label = await f.evaluate((el) => (el.parentElement && el.parentElement.firstElementChild ? el.parentElement.firstElementChild.textContent : ''));
  if (wanted.length && !wanted.some((w) => label.includes(w))) continue;
  const safe = label.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  await f.screenshot({ path: `${out}/${name}-${safe}.png` });
  console.log(`${out}/${name}-${safe}.png`);
  if (++n >= 8) break;
}
await b.close();
