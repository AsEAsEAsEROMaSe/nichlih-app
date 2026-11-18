// Прогін основного сценарію в безголовому Chrome зі знімками екрана кожної сторінки.
// Запуск: node scripts/walkthrough.mjs http://localhost:4199/ docs/screens
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:4199/';
const outDir = process.argv[3] ?? 'docs/screens';
const PORT = 9333;
const W = Number(process.argv[4] ?? 412);
const H = Number(process.argv[5] ?? 915);
const MOBILE = W < 900;
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'walk-'))}`,
  '--no-first-run', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* Chrome ще стартує */ }
    await sleep(250);
  }
  throw new Error('Chrome не відповів');
}

const problems = [];
try {
  const ws = new WebSocket((await pageTarget()).webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    // Порушення CSP і збої мережі браузер пише в журнал, а не в console.
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push(`${m.params.entry.source}: ${m.params.entry.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const until = async (expression, ms, what) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await js(expression)) return Date.now() - t0; await sleep(300); }
    console.log('стан сторінки:', await js(`document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 600)`));
    await shot('fail');
    throw new Error(`Не дочекалися: ${what}`);
  };
  const shot = async (name) => {
    await sleep(1200);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.result.data, 'base64'));
    console.log('знімок', name);
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE });
  await send('Page.navigate', { url });
  await until(`!!document.querySelector('.chip')`, 15000, 'перша сторінка');
  await js(`localStorage.clear(); location.reload()`);
  await sleep(2000); // стара сторінка ще мить живе після команди перезавантаження
  await until(`!!document.querySelector('.chip')`, 15000, 'перша сторінка після очищення');
  await js(`[...document.querySelectorAll('.chip')].find(b => b.textContent.includes('Гданськ')).click()`);
  await sleep(4500);
  await shot('1-home');

  await js(`document.querySelector('.bar button[type=submit]').click()`);
  const ms = await until(`!!document.querySelector('a.night') && !document.body.innerText.includes('Шукаємо готелі')`, 120000, 'план з готелями');
  console.log('план готовий за', ms, 'мс');
  console.log(await js(`document.querySelector('.stats').innerText.replace(/\n/g, ' ')`));
  console.log(await js(`[...document.querySelectorAll('.day')].map(d => d.innerText.replace(/\n+/g, ' | ')).join('\n')`));
  await sleep(2500);
  await shot('2-plan');

  await js(`document.querySelector('a.night').click()`);
  await until(`document.querySelectorAll('.hcard').length > 0`, 10000, 'сторінка ночі');
  const before = await js(`document.querySelector('.hcard.on b').innerText`);
  await js(`document.querySelectorAll('.hcard .pick')[1]?.click()`);
  const after = await js(`document.querySelector('.hcard.on b').innerText`);
  console.log('вибір готелю:', before, '→', after, '| карток:', await js(`document.querySelectorAll('.hcard').length`), '| цінників на карті:', await js(`document.querySelectorAll('.pin-price').length`));
  await sleep(2500);
  await shot('3-night');

  await js(`document.querySelector('.hcard.on .hcard-main').click()`);
  await until(`!!document.querySelector('.hotel-page')`, 10000, 'сторінка готелю');
  await sleep(3500);
  console.log('готель:', await js(`document.querySelector('.hotel-page h1').innerText`), '| плиток знімка завантажено:', await js(`[...document.querySelectorAll('.cover img')].filter(i => i.complete && i.naturalWidth > 0).length + ' з ' + document.querySelectorAll('.cover img').length`));
  await shot('4-hotel');

  await js(`document.querySelector('.book .btn.primary').click()`);
  await until(`!!document.querySelector('.stats')`, 10000, 'повернення до плану');
  console.log('перша ніч у плані після вибору:', await js(`document.querySelector('a.night b').innerText`));
  await js(`[...document.querySelectorAll('.btn.primary')].find(b => b.textContent.includes('Зберегти')).click()`);
  await js(`location.hash = '#/trips'`);
  await until(`!!document.querySelector('.trip')`, 10000, 'список поїздок');
  await js(`document.querySelector('.book-btn')?.click()`);
  console.log(await js(`document.querySelector('.trip').innerText.replace(/\n+/g, ' | ')`));
  await shot('5-trips');

  await js(`location.hash = '#/premium'`);
  await until(`!!document.querySelector('.plan.pro')`, 10000, 'підписка');
  await js(`document.querySelector('.plan.pro button').click()`);
  await shot('6-premium');

  await js(`location.hash = '#/profile'`);
  await until(`!!document.querySelector('.mini-stats')`, 10000, 'профіль');
  await shot('7-profile');

  await js(`location.hash = '#/'`);
  await until(`!!document.querySelector('.steps')`, 10000, 'головна');
  await js(`document.querySelector('.scroll').scrollTo(0, 99999)`);
  await shot('8-home-bottom');

  if (!MOBILE) {
    await js(`document.querySelector('.scroll').scrollTo(0, 0)`);
    await js(`[...document.querySelectorAll('.mode-switch button')].find(b => b.textContent.includes('Телефон')).click()`);
    console.log('режим телефона, ширина застосунку:', await js(`Math.round(document.querySelector('.viewport').getBoundingClientRect().width)`), '| нижні вкладки видно:', await js(`getComputedStyle(document.querySelector('.tabs')).display !== 'none'`));
    await shot('9-phone-mode');
    await js(`location.hash = '#/plan'`);
    await sleep(2500);
    await shot('10-phone-mode-plan');
    await js(`[...document.querySelectorAll('.mode-switch button')].find(b => b.textContent.includes('Десктоп')).click()`);
  }
  console.log('ширше за екран:', await js(`document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.scroll *')].some(e => e.getBoundingClientRect().right > document.querySelector('.viewport').getBoundingClientRect().right + 1 && !e.closest('.map') && !e.closest('.aerial') && !e.closest('.hero-map'))`));
  await js(`location.reload()`);
  await sleep(1500);
  console.log('після перезавантаження:', await js(`JSON.stringify({trips: JSON.parse(localStorage.nichlih).state.trips.length, premium: JSON.parse(localStorage.nichlih).state.profile.premium})`));
  ws.close();
} catch (e) {
  problems.push(String(e));
} finally {
  chrome.kill();
}
console.log(problems.length ? `ПРОБЛЕМИ:\n${problems.join('\n')}` : 'помилок у консолі нема');
process.exit(problems.length ? 1 : 0);
