'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const WIRE = path.join(__dirname, '..', 'full_report', 'wireframes');
const OUT  = path.join(__dirname, '..', 'fix_report',  'Hinhve');

const files = [
  { html: 'ui_draft_login.html',           png: 'ui_wireframe_login.png',       w: 1100, h: 700 },
  { html: 'ui_draft_application.html',     png: 'ui_wireframe_application.png', w: 1100, h: 760 },
  { html: 'ui_draft_admin_dashboard.html', png: 'ui_wireframe_admin.png',       w: 1100, h: 780 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const f of files) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: f.w, height: f.h });
    const url = 'file:///' + path.join(WIRE, f.html).split(path.sep).join('/');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const fp = path.join(OUT, f.png);
    await page.screenshot({ path: fp, clip: { x: 0, y: 0, width: f.w, height: f.h } });
    const kb = (fs.statSync(fp).size / 1024).toFixed(0);
    console.log('✓', f.png, '(' + kb + ' KB)');
    await page.close();
  }
  await browser.close();
  console.log('Done.');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
