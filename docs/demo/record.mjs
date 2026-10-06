// Scripted product tour recorded with Playwright's video capture.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';

const BASE = process.env.DEMO_URL || 'http://localhost:4391/';
const OUT = new URL('.', import.meta.url).pathname + 'raw';
mkdirSync(OUT, { recursive: true });
const W = 1280, H = 800;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, colorScheme: 'light' });

// Visible cursor + click ripple (Playwright videos don't show the pointer).
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-3px,-2px)' });
    document.body.appendChild(c);
    const style = document.createElement('style');
    style.textContent = '@keyframes demo-ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.6}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}';
    document.head.appendChild(style);
    window.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(235,104,52,.55)', zIndex: '2147483646', pointerEvents: 'none', animation: 'demo-ripple .5s ease-out forwards' });
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
});

const page = await context.newPage();
const t0 = Date.now(); // video starts with the page
const marks = {};
const wait = (ms) => page.waitForTimeout(ms);
let mouse = { x: W / 2, y: H / 2 };

async function moveTo(locator, { click = true, pause = 350 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const steps = Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 18));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
  await wait(pause);
  if (click) { await page.mouse.down(); await wait(90); await page.mouse.up(); }
}

async function smoothScroll(dy, stepPx = 40, stepMs = 28) {
  const n = Math.abs(Math.round(dy / stepPx));
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, Math.sign(dy) * stepPx); await wait(stepMs); }
}

// ---- 1. Rankings ----
await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
await page.mouse.move(mouse.x, mouse.y);
await wait(1800);
await moveTo(page.getByRole('button', { name: 'Adjust ranking' }));
await wait(900);
await moveTo(page.getByRole('button', { name: 'Wellbeing first' }));
await wait(1200);
const stars = page.locator('table tbody tr button[aria-label="Toggle shortlist"]');
await moveTo(stars.nth(0));
await wait(400);
await moveTo(stars.nth(1));
await wait(900);

// ---- 2. School page: why this score ----
await moveTo(page.locator('table tbody tr', { hasText: /Folkeskole·/ }).first().locator('a').first());
await page.waitForSelector('#score-breakdown');
await wait(1500);
await smoothScroll(650);
await wait(1800);
const climate = page.getByRole('heading', { name: 'Social climate', exact: true });
const top = await climate.evaluate((el) => el.getBoundingClientRect().top);
await smoothScroll(top - 90);
await wait(2200);

// ---- 3. Map: address, district school, travel times, route ----
await page.mouse.move(W / 2, 30, { steps: 15 }); mouse = { x: W / 2, y: 30 };
await moveTo(page.locator('header nav').getByRole('link', { name: 'Map', exact: true }));
await wait(1500);
const address = page.getByLabel('Home address');
await moveTo(address);
await address.pressSequentially('Gammel Kongevej 10', { delay: 70 });
await page.waitForSelector('ul.card li button', { timeout: 15000 });
await wait(700);
await moveTo(page.locator('ul.card li button').first());
// Wait until travel times for the top of the list have all arrived
// (this stretch is fast-forwarded in the final video).
marks.waitStart = (Date.now() - t0) / 1000 + 1.2;
await page.waitForFunction(() => {
  const rows = [...document.querySelectorAll('aside ul li')].slice(0, 12);
  return rows.length > 5 && rows.every((r) => /min/.test(r.textContent ?? ''));
}, null, { timeout: 60000 });
marks.waitEnd = (Date.now() - t0) / 1000;
await wait(2500);
await moveTo(page.getByRole('button', { name: 'Bike' }), { click: false, pause: 600 });
const nearby = page.locator('aside ul li button', { hasText: 'Skolen ved Søerne' });
await moveTo(nearby);
await page.waitForFunction(() => /by bike/.test(document.body.textContent ?? ''), null, { timeout: 30000 });
await wait(3000);
await moveTo(page.locator('.leaflet-container ~ div button[aria-label="Toggle shortlist"], div.absolute button[aria-label="Toggle shortlist"]').last());
await wait(900);

// ---- 4. Compare ----
await moveTo(page.locator('header nav').getByRole('link', { name: /Compare/ }));
await wait(2200);
await smoothScroll(420);
await wait(2200);

await context.close(); // flushes the video
await browser.close();
const file = readdirSync(OUT).find((f) => f.endsWith('.webm'));
renameSync(`${OUT}/${file}`, `${OUT}/tour.webm`);
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log('saved', `${OUT}/tour.webm`, marks);
