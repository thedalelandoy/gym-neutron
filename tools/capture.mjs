// Headless capture for visual checks and the test report.
// Drives Microsoft Edge (or Chrome) over the DevTools protocol, so the page
// renders real WebGL frames at an exact viewport size, then scrolls to each
// section and saves a PNG. Also reports console errors and horizontal overflow.
//
// Usage: node tools/capture.mjs --url http://127.0.0.1:5180/ --out captures/desktop --width 1440 --height 900
//        add --mobile for a phone viewport, --shots top,fear,offer@0.5 to pick sections.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => {
  if (arg.startsWith('--')) acc.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const url = args.url || 'http://127.0.0.1:5180/';
const out = args.out || 'captures';
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const mobile = Boolean(args.mobile);
const settle = Number(args.settle || 2200);
const shots = String(args.shots || 'top,fear,offer@0.15,offer@0.45,offer@0.8,how,element,claim,faq')
  .split(',').map((s) => { const [id, f] = s.split('@'); return { id, fraction: f ? Number(f) : 0 }; });

const browserPaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const browserPath = browserPaths.find((p) => existsSync(p));
if (!browserPath) throw new Error('No Edge or Chrome found');

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'gn-capture-'));
const browser = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
  `--window-size=${width},${height}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageSocketUrl() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* browser still starting */ }
    await sleep(200);
  }
  throw new Error('Browser did not open a debugging port');
}

const ws = new WebSocket(await pageSocketUrl());
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
const problems = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    problems.push(`exception: ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    problems.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
    problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return res.result?.result?.value;
};

try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  // Headless pages report themselves hidden after a while, which pauses the
  // scene's render loop; keep the page focused and active for the capture.
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.setWebLifecycleState', { state: 'active' });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (args.reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url });
  await sleep(settle + 2500);

  // --eval runs a snippet after load, e.g. to fill the form before a shot.
  if (args.eval) {
    await evaluate(`(async () => { ${args.eval} })()`);
    await sleep(600);
  }

  mkdirSync(out, { recursive: true });
  const status = await evaluate(`({
    classes: document.documentElement.className,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    docHeight: document.documentElement.scrollHeight,
    webgl: (() => { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'yes') : 'none'; } catch (e) { return 'error'; } })(),
  })`);
  console.log(JSON.stringify(status));

  for (const shot of shots) {
    const y = await evaluate(`(() => {
      const el = document.getElementById(${JSON.stringify(shot.id)});
      if (!el) return -1;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const travel = Math.max(0, el.offsetHeight - window.innerHeight);
      const y = Math.max(0, top + travel * ${shot.fraction} - (${shot.fraction} === 0 && ${JSON.stringify(shot.id)} !== 'top' ? 0 : 0));
      if (window.__gnLenis) window.__gnLenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      return y;
    })()`);
    if (y < 0) { problems.push(`missing section #${shot.id}`); continue; }
    await sleep(settle);
    const shotRes = await send('Page.captureScreenshot', { format: 'png' });
    const name = `${shot.id}${shot.fraction ? `-${Math.round(shot.fraction * 100)}` : ''}.png`;
    writeFileSync(join(out, name), Buffer.from(shotRes.result.data, 'base64'));
    const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    if (overflow > 0) problems.push(`horizontal overflow ${overflow}px at #${shot.id}`);
    const debug = await evaluate('window.__gnDebug ? JSON.stringify(window.__gnDebug()) : ""');
    console.log(`saved ${name} (scrollY ${Math.round(y)}) ${debug}`);
  }
  console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no console errors, no horizontal overflow');
} finally {
  ws.close();
  browser.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile still locked */ }
}
