// Headless-Chrome scenario for the keyboard-driven technician (raw DevTools protocol, no Playwright needed).
// Serve the build first:  npx vite preview --port 4173 --host 127.0.0.1   then:  node scripts/drive.cdp.mjs [outDir]
// Drives with real key events (Input.dispatchKeyEvent), reads state back through the ?debug hook window.__rackTwin,
// and saves screenshots of the inspect pose. Exit code 1 on any failed check.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OUT = process.argv[2] ?? path.join(os.tmpdir(), 'rack-twin-drive');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9340, URL = 'http://127.0.0.1:4173/?debug';
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(OUT, 'profile')}`, '--no-first-run', '--window-size=1100,700', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitJson = async (u, tries = 50) => { for (let i = 0; i < tries; i++) { try { const r = await fetch(u); return await r.json(); } catch { await sleep(200); } } throw new Error('chrome did not answer'); };
const page = (await waitJson(`http://127.0.0.1:${PORT}/json`)).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exc] ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('[console] ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed'); return r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('shot', path.join(OUT, name)); };
const KEYS = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
const key = (type, k) => send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: KEYS[k], nativeVirtualKeyCode: KEYS[k] });
const state = () => evaluate('window.__rackTwin.techState()');
const drv = () => evaluate('window.__rackTwin.techDriving()');
let fails = 0; const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); if (!ok) fails++; };

await send('Runtime.enable'); await send('Page.enable'); await send('Page.bringToFront');
await send('Page.navigate', { url: URL }); await sleep(4000);
for (let i = 0; i < 60; i++) { if (await evaluate('!!(window.__rackTwin && window.__rackTwin.techDriving)')) break; await sleep(500); }
// 1. wait for the badge-in walk to finish
for (let i = 0; i < 40; i++) { if ((await drv()).entered) break; await sleep(500); }
check('technician has entered the hall', (await drv()).entered === true);

// Park the rounds where we want them: teleport is not exposed, so wait for the patrol to reach row A's aisle.
for (let i = 0; i < 60; i++) { const s = await state(); if (Math.abs(s.pos[2] - 1.0) < 0.05 && s.pos[0] < 3.0) break; await sleep(500); }
// 2. ArrowUp: drive along the row-A aisle (facing follows whichever way they were walking)
// Headless SwiftShader renders this scene at a few frames per second, so every check below polls state instead of
// assuming wall-clock distances.
const until = async (pred, ms, every = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pred()) return true; await sleep(every); } return false; };
const s0 = await state();
await key('keyDown', 'ArrowUp'); await sleep(300);
const d1 = await drv();
check('driving after ArrowUp', d1.driving === true, JSON.stringify(d1));
const moved = await until(async () => { const s = await state(); return Math.abs(s.pos[0] - s0.pos[0]) > 0.8; }, 30000);
const s1 = await state();
check('moved along the aisle, z stays 1.0', moved && Math.abs(s1.pos[2] - 1.0) < 0.05, `from x=${s0.pos[0].toFixed(2)} to ${s1.pos[0].toFixed(2)}, frameMs ${(await evaluate('window.__rackTwin.stats()')).frameMs}`);
check('walking pose while driving', s1.pose === 'walk' && s1.walking === true, s1.pose);
// 3. release within 0.4 m of a stand point: stands are at x = {-1.68,-1.03,-0.38,0.27,0.92} on row A
const STANDS = [-1.68, -1.03, -0.38, 0.27, 0.92];
let released = false;
for (let i = 0; i < 80 && !released; i++) {
  const s = await state(); const x = s.pos[0], fx = Math.sin(s.yaw);
  const ahead = STANDS.find((sx) => Math.abs(sx - x) < 0.22 && (sx - x) * fx >= -0.05);
  if (ahead !== undefined) { await key('keyUp', 'ArrowUp'); released = true; }
  else await sleep(60);
}
if (!released) await key('keyUp', 'ArrowUp');
await until(async () => (await drv()).atStop !== null, 15000);
await sleep(2500); // let the yaw ease and the camera fly
const d3 = await drv(); const s3 = await state();
check('parked at a rack stop', d3.atStop !== null, `atStop ${d3.atStop}, pos ${s3.pos.map((v) => v.toFixed(2))}`);
check('inspecting pose (idle + inspect flag)', s3.inspecting === true && s3.pose === 'idle', `${s3.pose} / inspecting ${s3.inspecting}`);
check('faces the rack (yaw ≈ π for row A)', Math.abs(Math.atan2(Math.sin(s3.yaw - Math.PI), Math.cos(s3.yaw - Math.PI))) < 0.2, `yaw ${s3.yaw.toFixed(2)}`);
const cam = await evaluate('window.__rackTwin.cameraPos()');
check('camera handed off toward the rack focus shot (in front of row A, above 1.5 m)', cam[2] > 1.5 && cam[1] > 1.5, `cam ${cam.map((v) => v.toFixed(2))}`);
await shot('drive-01-inspecting.png');
// close-up of the pose from the side
await evaluate(`(() => { const a = window.__rackTwin, p = a.techState().pos; a.setCamera([p[0] + 1.9, 1.6, p[2] + 0.9], [p[0], 1.25, p[2] - 0.6]); })()`); await sleep(300);
await shot('drive-02-inspect-closeup.png');
// 4. queued turn mid-row, then hold ArrowUp until the turn at the end of the row. Both row ends only offer the
// passage toward -z, which is a LEFT turn when facing +x and a RIGHT turn when facing -x.
const facingNow = (await drv()).facing; const turnKey = facingNow.dx > 0 ? 'ArrowLeft' : 'ArrowRight', turnName = facingNow.dx > 0 ? 'left' : 'right';
await key('keyDown', turnKey); await key('keyUp', turnKey); await sleep(200);
const d4 = await drv();
check(`${turnName} turn queued`, d4.pending === turnName, JSON.stringify(d4));
await key('keyDown', 'ArrowUp');
const turned = await until(async () => { const d = await drv(); return d.pending === null && d.facing.dz !== 0; }, 90000);
await key('keyUp', 'ArrowUp'); await sleep(1500);
const s4 = await state();
check('turned onto a cross passage at the end of the row', turned && (Math.abs(Math.abs(s4.pos[0]) - 3.7) < 0.05 || Math.abs(s4.pos[0] - 4.0) < 0.05 || Math.abs(s4.pos[0] - 5.6) < 0.05), `pos ${s4.pos.map((v) => v.toFixed(2))}, facing ${JSON.stringify((await drv()).facing)}`);
await shot('drive-03-turned.png');
// 5. dispatch during driving takes over, then hands back
await evaluate(`window.__rackTwin.setRemediation({ issueId: 'INC-4805', phase: 'requested' })`); await sleep(500);
const d5 = await drv(); const s5 = await state();
check('dispatch takes the technician over', d5.driving === false && s5.job?.issueId === 'INC-4805', JSON.stringify({ driving: d5.driving, job: s5.job }));
await evaluate(`window.__rackTwin.setRemediation({ issueId: null, phase: 'idle' })`); await sleep(800);
const d6 = await drv();
check('control returns to the keyboard after the job', d6.driving === true, JSON.stringify(d6));
// 6. keys are ignored while typing in a control
await evaluate(`(() => { const cb = document.querySelector('input[type=checkbox]'); cb && cb.focus(); })()`);
const before = (await state()).pos;
await key('keyDown', 'ArrowDown'); await sleep(600); await key('keyUp', 'ArrowDown'); await sleep(300);
const after = (await state()).pos;
check('arrows ignored while a form control has focus', Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.02, `moved ${Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(3)} m`);
await evaluate(`document.activeElement && document.activeElement.blur()`);
// 7. inactivity resumes the rounds
console.log('waiting for the rounds to resume (20 s idle)…');
const resumed = await until(async () => (await drv()).driving === false, 40000, 1000);
await until(async () => (await state()).walking === true, 15000, 500);
const d7 = await drv(); const s7 = await state();
check('rounds resume after 20 s idle', resumed && s7.walking === true, JSON.stringify({ driving: d7.driving, walking: s7.walking }));

console.log('page errors:', logs.length ? '\n' + logs.join('\n') : 'none');
if (logs.length) fails++;
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
