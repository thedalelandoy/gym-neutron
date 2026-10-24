// Exports the pitch deck: one 1920×1080 JPEG per slide (every build shown)
// and a 16:9 PDF of all slides, for submitting alongside the live deck.
// Usage (with a local server on 5180): node tools/deck-export.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openPage, sleep } from './cdp.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5180/pitch/';
const outDir = resolve('docs/pitch-slides');
const pdfPath = resolve('docs/Gym-Neutron-Pitch.pdf');
const SLIDES = 7;

mkdirSync(outDir, { recursive: true });

// A fresh headless page per slide: reusing one page across navigations let
// a browser indicator icon creep into later screenshots.
const files = [];
const problems = [];
for (let n = 1; n <= SLIDES; n += 1) {
  const shotPage = await openPage({ width: 1920, height: 1080 });
  try {
    await shotPage.send('Page.navigate', { url: `${base}?slide=${n}&step=all&static` });
    await sleep(5000);
    const ready = await shotPage.evaluate("document.documentElement.classList.contains('stage-ready')");
    const shot = await shotPage.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
    const file = join(outDir, `slide-${n}.jpg`);
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    files.push(file);
    problems.push(...shotPage.problems.filter((p) => !p.includes('Tracking Prevention')));
    console.log(`slide ${n} saved${ready ? '' : ' (3D not ready)'}`);
  } finally {
    await shotPage.close();
  }
}

const page = await openPage({ width: 1920, height: 1080 });
try {

  // Lay the screenshots out one per 16:9 page and print to PDF.
  const html = `<!doctype html><html><head><style>
    @page { size: 13.333in 7.5in; margin: 0; }
    html, body { margin: 0; background: #06070b; }
    img { display: block; width: 13.333in; height: 7.5in; page-break-after: always; }
  </style></head><body>${files.map((f) => `<img src="${pathToFileURL(f).href}">`).join('')}</body></html>`;
  const htmlPath = join(outDir, 'print.html');
  writeFileSync(htmlPath, html);
  await page.send('Page.navigate', { url: pathToFileURL(htmlPath).href });
  await sleep(2500);
  const pdf = await page.send('Page.printToPDF', {
    paperWidth: 13.333, paperHeight: 7.5, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    printBackground: true, preferCSSPageSize: true,
  });
  writeFileSync(pdfPath, Buffer.from(pdf.result.data, 'base64'));
  console.log(`PDF saved to ${pdfPath}`);
  console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no console errors');
} finally {
  await page.close();
}
