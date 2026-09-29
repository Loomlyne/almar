import fs from 'node:fs';
import { chromium } from '/Users/koss/Developer/almarprod-Website-Code/node_modules/playwright/index.mjs';

const dir = '/private/tmp/claude-501/-Users-koss-Developer-almarprod-Website-Code/314e86c7-e446-4af1-86cd-2b34d8c37426/scratchpad/canvas-root/project';
const names = process.argv.slice(2);
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAMzMzAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 3100, height: 1000 } });
for (const n of names) {
  const s = fs.readFileSync(`${dir}/${n}.dc.html`, 'utf8');
  const dict = JSON.parse(s.match(/const DICT = (\{.*?\});\nconst FIXED/s)[1]);
  let body = s.split('<x-dc>')[1].split('</x-dc>')[0].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  body = body.replace(/\{\{t\.(k\d+)\}\}/g, (_, key) => (dict[key] ? dict[key].en : ''));
  const map = { dir: 'ltr', fd: 'Georgia, serif', fb: 'Arial, sans-serif', tt: 'uppercase', ls: '0.12em', tk: '-0.02em', flip: 'none', lhC: '1.5', lhL: '1.43', lhB: '1.5', lhT: '1.3', lh2: '1.2', lh1: '1.1', lh0: '1.05' };
  body = body.replace(/\s*(onClick|aria-pressed)="\{\{[^}]*\}\}"/g, '').replace(/\{\{(\w+)\}\}/g, (_, k2) => (map[k2] ?? '')).replace(/\{\{sw\.\w+\}\}/g, '').replace(/\/_blob\/[0-9a-f]+/g, GIF);
  await pg.setContent(`<!doctype html><html><body style="margin:0">${body}</body></html>`);
  await pg.waitForTimeout(200);
  const res = await pg.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('div,main,section,aside')) {
      const st = el.getAttribute('style') || '';
      const cs = getComputedStyle(el);
      if (!/overflow:hidden/.test(st)) continue;
      if (el.scrollHeight > el.clientHeight + 3) {
        // find frame label
        let p = el; while (p && !/position:relative;width:/.test(p.getAttribute('style') || '') && p.parentElement) p = p.parentElement;
        const lab = p && p.parentElement && p.parentElement.firstElementChild ? p.parentElement.firstElementChild.textContent : '';
        const fh = p ? parseFloat((p.getAttribute('style').match(/height:(\d+)px/) || [0, 0])[1]) : 0;
        out.push({ tag: el.tagName, h: el.clientHeight, sh: el.scrollHeight, lab, w: el.clientWidth, fh });
      }
    }
    return out;
  });
  const seen = new Set();
  console.log('==', n, 'overflows:', res.length);
  const OVF = '/private/tmp/claude-501/-Users-koss-Developer-almarprod-Website-Code/314e86c7-e446-4af1-86cd-2b34d8c37426/scratchpad/gen/heights.json';
  let ov = {}; try { ov = JSON.parse(fs.readFileSync(OVF, 'utf8')); } catch (e) { ov = {}; }
  const worst = {};
  for (const r of res) {
    if (/rail open/.test(r.lab) || r.sh - r.h < 6) continue;
    const key = r.lab.replace(/^\s+/, '');
    worst[key] = Math.max(worst[key] || 0, r.sh - r.h + r.fh);
  }
  for (const r of res) { const key = r.lab + r.h; if (seen.has(key)) continue; seen.add(key); console.log(`  ${r.lab} | box ${r.w}x${r.h} content ${r.sh} (+${r.sh - r.h}) frame ${r.fh}`); }
  for (const [key, need] of Object.entries(worst)) { const cur = ov[key] || 0; ov[key] = Math.max(cur, Math.ceil((need + 16) / 10) * 10); }
  fs.writeFileSync(OVF, JSON.stringify(ov, null, 1));
}
await b.close();
