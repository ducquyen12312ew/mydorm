/**
 * Playwright screenshots — HUST Dormitory (Expo web, real Atlas data)
 * Strategy: inject tokens once → navigate per page (localStorage persists in context)
 */
const { chromium } = require('../mobile/node_modules/playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8081';
const API_URL  = 'http://127.0.0.1:5000';
const OUT_DIR  = path.join(__dirname, '..', 'mobile_screens');
const VIEWPORT = { width: 390, height: 844 };

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body), p = new URL(url);
    const req = http.request({
      hostname: p.hostname, port: parseInt(p.port) || 80,
      path: p.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(JSON.parse(b))); });
    req.on('error', reject); req.write(data); req.end();
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, filename, label) {
  const fp = path.join(OUT_DIR, filename);
  await page.screenshot({ path: fp });
  const kb = (fs.statSync(fp).size / 1024).toFixed(0);
  const url = page.url().replace(BASE_URL, '') || '/';
  console.log(`  ✅ ${label} → ${filename} (${kb}KB) [${url}]`);
}

async function go(page, url, ms = 6000) {
  // Inject tokens into localStorage on the current origin before each navigation
  // (they persist in the browser context, but this ensures they're fresh)
  await page.evaluate((tokens) => {
    localStorage.setItem('mobile_access_token', tokens.at);
    localStorage.setItem('mobile_refresh_token', tokens.rt);
    localStorage.setItem('mobile_auth_user', JSON.stringify(tokens.u));
    localStorage.setItem('mobile_device_id', 'playwright-demo');
    localStorage.setItem('mobile_fingerprint', 'playwright-fp');
  }, page._tokens).catch(() => {});

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

  // Inject again after navigation (page may have been at wrong origin before)
  await page.evaluate((tokens) => {
    localStorage.setItem('mobile_access_token', tokens.at);
    localStorage.setItem('mobile_refresh_token', tokens.rt);
    localStorage.setItem('mobile_auth_user', JSON.stringify(tokens.u));
    localStorage.setItem('mobile_device_id', 'playwright-demo');
    localStorage.setItem('mobile_fingerprint', 'playwright-fp');
  }, page._tokens).catch(() => {});

  await wait(ms);
}

async function run() {
  console.log('Getting real JWT from backend...');
  const resp = await httpPost(`${API_URL}/api/student-app/auth/mobile/login`, {
    username: 'sinhvien_demo', password: 'Demo@1234',
    deviceId: 'playwright-demo', fingerprint: 'playwright-fp',
  });
  if (!resp.success) { console.error('Login failed:', resp); process.exit(1); }
  console.log(`Authenticated as: ${resp.user.name} (${resp.user.studentId})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'vi-VN' });
  const page = await context.newPage();

  // Attach tokens to the page object for convenience
  page._tokens = { at: resp.accessToken, rt: resp.refreshToken, u: resp.user };

  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('Sentry') && !m.text().includes('shadow')) {
      console.log(`  [err] ${m.text().substring(0, 100)}`);
    }
  });

  // ── 1. Login screen (no auth) ─────────────────────────────────────────────
  console.log('\n[1] Login screen...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await wait(3000);
  await shot(page, '01-login.png', 'Login');

  // Bootstrap: inject tokens then navigate to root so restoreSession fires
  await page.evaluate((tokens) => {
    localStorage.setItem('mobile_access_token', tokens.at);
    localStorage.setItem('mobile_refresh_token', tokens.rt);
    localStorage.setItem('mobile_auth_user', JSON.stringify(tokens.u));
    localStorage.setItem('mobile_device_id', 'playwright-demo');
    localStorage.setItem('mobile_fingerprint', 'playwright-fp');
  }, page._tokens);

  // ── 2. Dashboard ──────────────────────────────────────────────────────────
  console.log('\n[2] Dashboard...');
  await go(page, BASE_URL, 8000);
  await shot(page, '02-dashboard.png', 'Dashboard');

  // ── 3. Allocation Timeline ────────────────────────────────────────────────
  console.log('\n[3] Allocation Timeline...');
  await go(page, `${BASE_URL}/allocation`, 6000);
  await shot(page, '03-allocation-timeline.png', 'Allocation Timeline');

  // ── 4. Room List ──────────────────────────────────────────────────────────
  console.log('\n[4] Room List...');
  await go(page, `${BASE_URL}/rooms`, 7000);
  await shot(page, '04-room-list.png', 'Room List');

  // ── 5. Room Detail ────────────────────────────────────────────────────────
  console.log('\n[5] Room Detail...');
  // Click room 202 (the demo student's room) from the list
  const roomClicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div[role="button"], a'));
    for (const el of items) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t.startsWith('P.202') || t.includes('P.202') || t.includes('202')) {
        el.click(); return `clicked: ${t.substring(0, 40)}`;
      }
    }
    // Click first available room card
    for (const el of items) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t.match(/^P\.\d+/) || t.match(/P\.1\d\d/)) {
        el.click(); return `clicked fallback: ${t.substring(0, 40)}`;
      }
    }
    return 'no room card found';
  });
  console.log(`    ${roomClicked}`);
  await wait(4000);
  await shot(page, '05-room-detail.png', 'Room Detail');

  // ── 6. Roommates (Profile scrolled) ──────────────────────────────────────
  console.log('\n[6] Profile + Roommates...');
  await go(page, `${BASE_URL}/profile`, 7000);
  await page.mouse.wheel(0, 600);
  await wait(1500);
  await shot(page, '06-roommates.png', 'Profile + Roommates');

  // ── 7. Notifications ─────────────────────────────────────────────────────
  console.log('\n[7] Notifications...');
  await go(page, `${BASE_URL}/notifications`, 6000);
  await shot(page, '07-notifications.png', 'Notifications');

  // ── 8. Maintenance List ───────────────────────────────────────────────────
  console.log('\n[8] Maintenance List...');
  await go(page, `${BASE_URL}/maintenance`, 6000);
  await shot(page, '08-maintenance-list.png', 'Maintenance List');

  // ── 9. Maintenance New Form ───────────────────────────────────────────────
  console.log('\n[9] Maintenance New Form...');
  await go(page, `${BASE_URL}/maintenance/new`, 5000);
  await shot(page, '09-maintenance-detail.png', 'Maintenance New Form');

  // ── 10. Profile ───────────────────────────────────────────────────────────
  console.log('\n[10] Profile...');
  await go(page, `${BASE_URL}/profile`, 7000);
  await shot(page, '10-profile.png', 'Profile');

  // ── 11. QR Card ───────────────────────────────────────────────────────────
  console.log('\n[11] QR Card...');
  await go(page, `${BASE_URL}/card`, 7000);
  await shot(page, '11-qr-card.png', 'QR Card');

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  const total = files.reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log('\n' + '─'.repeat(60));
  console.log(`✅ ${files.length} screenshots — ${(total / 1024).toFixed(0)}KB total`);
  files.forEach(f => {
    const kb = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
    const status = parseInt(kb) > 40 ? '✅' : parseInt(kb) > 20 ? '⚠️' : '❌';
    console.log(`  ${status} ${f}: ${kb}KB`);
  });
}

run().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
