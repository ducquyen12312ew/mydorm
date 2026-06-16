/**
 * Playwright screenshots — HUST Dormitory Web Portal
 * Captures admin + student portal pages for thesis report.
 *
 * Credentials:
 *   Admin:   username=admin       password=admin123
 *   Student: username=sinhvien_demo  password=Demo@1234
 */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE = 'http://localhost:5010';
const OUT  = path.join(__dirname, '..', 'full_report', 'full_images');
const DESK = { width: 1280, height: 800 };
const wait = ms => new Promise(r => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, file, label) {
  const fp = path.join(OUT, file);
  await page.screenshot({ path: fp, fullPage: false });
  const kb = (fs.statSync(fp).size / 1024).toFixed(0);
  console.log(`  ✓ ${label} → ${file} (${kb} KB)`);
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await wait(800);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await wait(1000);
  console.log(`  Logged in as ${username} → ${page.url()}`);
}

async function nav(page, url, delay = 4000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await wait(delay);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: DESK,
    deviceScaleFactor: 1.5,
    locale: 'vi-VN',
  });
  const page = await context.newPage();

  // ── 1. Login page (unauthenticated) ──────────────────────────────────────
  console.log('\n[1] Login page');
  await nav(page, `${BASE}/login`, 1500);
  await shot(page, 'ui_login.png', 'Login');

  // ═══════════════════════════════════════════════
  // STUDENT SESSION
  // ═══════════════════════════════════════════════
  console.log('\n--- STUDENT SESSION ---');
  await login(page, 'sinhvien_demo', 'Demo@1234');

  // ── 2. Student home / dashboard ──────────────────────────────────────────
  console.log('[2] Student home');
  await nav(page, `${BASE}/home`, 5000);
  await shot(page, 'ui_student_dashboard.png', 'Student Dashboard');

  // ── 3. Application form ───────────────────────────────────────────────────
  console.log('[3] Application form');
  await nav(page, `${BASE}/register`, 3500);
  await shot(page, 'ui_application.png', 'Application Form');

  // ── 4. Room status / result ──────────────────────────────────────────────
  console.log('[4] Room status');
  await nav(page, `${BASE}/api/admin/room-status`, 4000);
  await shot(page, 'ui_room_result.png', 'Room Result');

  // ── 5. Maintenance requests ───────────────────────────────────────────────
  console.log('[5] Maintenance requests');
  await nav(page, `${BASE}/student/maintenance-requests`, 4000);
  await shot(page, 'ui_room_explorer.png', 'Maintenance Requests');

  // ── 6. Student profile ────────────────────────────────────────────────────
  console.log('[6] Student profile');
  await nav(page, `${BASE}/profile`, 4000);
  await shot(page, 'ui_my_ranking.png', 'Student Profile');

  // Logout student
  await nav(page, `${BASE}/logout`, 1000);

  // ═══════════════════════════════════════════════
  // ADMIN SESSION
  // ═══════════════════════════════════════════════
  console.log('\n--- ADMIN SESSION ---');
  await login(page, 'admin', 'admin123');

  // ── 7. Admin dashboard ────────────────────────────────────────────────────
  console.log('[7] Admin dashboard');
  await nav(page, `${BASE}/admin/dashboard`, 5000);
  await shot(page, 'ui_admin_dashboard.png', 'Admin Dashboard');

  // ── 8. Allocation policies ────────────────────────────────────────────────
  console.log('[8] Allocation policies');
  await nav(page, `${BASE}/admin/allocation/policies`, 5000);
  await shot(page, 'ui_allocation.png', 'Allocation Policies');

  // ── 9. Academic / quota policies ─────────────────────────────────────────
  console.log('[9] Quota policies');
  await nav(page, `${BASE}/admin/academic-policies`, 4000);
  await shot(page, 'ui_policy.png', 'Academic Policies');

  // ── 10. Violations ───────────────────────────────────────────────────────
  console.log('[10] Violations');
  await nav(page, `${BASE}/admin/violations`, 4000);
  await shot(page, 'ui_violation.png', 'Violations');

  // ── 11. Master dashboard / statistics ────────────────────────────────────
  console.log('[11] Statistics / Master dashboard');
  await nav(page, `${BASE}/admin/master-dashboard`, 5000);
  await shot(page, 'ui_statistics.png', 'Statistics');

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  const total = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log('\n' + '─'.repeat(55));
  console.log(`✅  ${files.length} screenshots — ${(total / 1024).toFixed(0)} KB total`);
  files.forEach(f => {
    const kb = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0);
    const ok = parseInt(kb) > 30 ? '✅' : '⚠️ ';
    console.log(`  ${ok}  ${f}: ${kb} KB`);
  });
}

run().catch(err => {
  console.error('\n❌ FAILED:', err.message);
  process.exit(1);
});
