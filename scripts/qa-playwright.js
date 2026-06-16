/**
 * qa-playwright.js — Phase 2 QA screenshots
 * Logs in as admin and captures key admin pages.
 * Usage: node scripts/qa-playwright.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5000';
const CREDS = { username: 'admin', password: 'Admin@1234' };
const OUT_DIR = path.join(__dirname, '..', 'evidence', 'screenshots-phase2');

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT_DIR, name + '.png'), fullPage: true });
    console.log('  [OK] Screenshot saved:', name + '.png');
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  console.log('\n[1] Login...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await shot('00-login-page');

  await page.fill('input[name="username"]', CREDS.username);
  await page.fill('input[name="password"]', CREDS.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);
  await shot('01-after-login');
  console.log('  Current URL:', page.url());

  // ── Admin Dashboard ───────────────────────────────────────────────────────────
  console.log('\n[2] Admin Dashboard...');
  await page.goto(BASE + '/admin/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot('02-admin-dashboard');

  // ── Master Dashboard ──────────────────────────────────────────────────────────
  console.log('\n[3] Master Dashboard...');
  await page.goto(BASE + '/admin/master-dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot('03-master-dashboard');

  // ── Dormitories list ──────────────────────────────────────────────────────────
  console.log('\n[4] Dormitories list...');
  await page.goto(BASE + '/admin/dormitories', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot('04-dormitories-list');

  // ── Dormitory detail (first one) ──────────────────────────────────────────────
  console.log('\n[5] Dormitory detail...');
  const firstDormLink = await page.$('a[href*="/admin/dormitories/view/"]');
  if (firstDormLink) {
    const dormHref = await firstDormLink.getAttribute('href');
    await page.goto(BASE + dormHref, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await shot('05-dormitory-detail');

    // ── Click on first resident link ───────────────────────────────────────────
    console.log('\n[6] Student profile...');
    const residentLink = await page.$('a[href*="/admin/students/"]');
    if (residentLink) {
      const resHref = await residentLink.getAttribute('href');
      await page.goto(BASE + resHref, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await shot('06-student-profile');
    } else {
      console.log('  [WARN] No resident link found on dormitory detail page');
    }
  } else {
    console.log('  [WARN] No dormitory detail link found');
  }

  // ── Violations ────────────────────────────────────────────────────────────────
  console.log('\n[7] Violations...');
  await page.goto(BASE + '/admin/violations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('07-violations');

  // ── Maintenance ───────────────────────────────────────────────────────────────
  console.log('\n[8] Maintenance requests...');
  await page.goto(BASE + '/admin/maintenance-requests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('08-maintenance');

  // ── Master dashboard - wait for heatmap ──────────────────────────────────────
  console.log('\n[9] Master dashboard KPI data...');
  await page.goto(BASE + '/admin/master-dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot('09-master-dashboard-loaded');

  // Check for layout issues
  const overflowEls = await page.$$eval('*', els => {
    const bad = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 5) {
        bad.push(el.tagName + '.' + [...el.classList].join('.'));
      }
    }
    return bad.slice(0, 10);
  });
  if (overflowEls.length > 0) {
    console.log('  [WARN] Overflow elements:', overflowEls);
  } else {
    console.log('  [OK] No horizontal overflow detected');
  }

  await browser.close();

  console.log('\n=== QA COMPLETE ===');
  console.log('Screenshots saved to:', OUT_DIR);
  console.log('JS errors captured:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:');
    errors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 120)));
  }
}

run().catch(err => { console.error('QA failed:', err.message); process.exit(1); });
