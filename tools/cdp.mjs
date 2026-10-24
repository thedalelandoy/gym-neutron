// Minimal DevTools-protocol client for headless Edge or Chrome, shared by
// the export tools. Opens one page and returns helpers to drive it.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openPage({ width = 1920, height = 1080 } = {}) {
  const browserPath = BROWSERS.find((p) => existsSync(p));
  if (!browserPath) throw new Error('No Edge or Chrome found');
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'gn-cdp-'));
  const browser = spawn(browserPath, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 50 && !wsUrl; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl || null;
    } catch { /* still starting */ }
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) throw new Error('Browser did not open a debugging port');

  const ws = new WebSocket(wsUrl);
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
    } else if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
      problems.push(`log: ${msg.params.entry.text}`);
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

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.setWebLifecycleState', { state: 'active' });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  async function close() {
    ws.close();
    browser.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ }
  }

  return { send, evaluate, close, problems };
}
