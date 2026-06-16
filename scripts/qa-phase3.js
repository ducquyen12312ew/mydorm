/**
 * Phase 3 QA — sidebar + branding validation
 * Captures screenshots of all admin pages after sidebar redesign.
 * Run: node scripts/qa-phase3.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:5001';
const OUT  = path.join(__dirname, '..', 'evidence', 'phase3-screenshots');
const CREDS = { user: 'admin', pass: 'Admin@1234' };

const PAGES = [
  { name: '01-dashboard',          url: '/admin/dashboard' },
  { name: '02-dormitories',        url: '/admin/dormitories' },
  { name: '03-students',           url: '/admin/students' },
  { name: '04-applications',       url: '/admin/application' },
  { name: '05-violations',         url: '/admin/violations' },
  { name: '06-maintenance',        url: '/admin/maintenance-requests' },
  { name: '07-allocation',         url: '/admin/allocation/policies' },
  { name: '08-master-dashboard',   url: '/admin/master-dashboard' },
  { name: '09-logs',               url: '/admin/logs' },
  { name: '10-quotas',             url: '/admin/quotas' },
];

const OFF_PALETTE_COLORS = [
  '#3b82f6','#60a5fa','#2563eb','#1d4ed8','#bfdbfe','#dbeafe','#eff6ff',
  '#8b5cf6','#7c3aed','#6d28d9','#a78bfa','#ddd6fe',
  '#059669','#10b981','#34d399','#a7f3d0','#ecfdf5','#d1fae5','#f0fdf4',
  '#14b8a6','#0d9488','#0ea5e9','#38bdf8','#0891b2','#f0f9ff','#bae6fd',
  '#ec4899','#db2777','#fbcfe8','#fdf2f8',
];

async function login(page) {
  await page.goto(BASE + '/login');
  await page.waitForSelector('input[name="username"], input[name="email"]', { timeout: 10000 });
  const userField = await page.$('input[name="username"]') || await page.$('input[name="email"]');
  await userField.fill(CREDS.user);
  await page.fill('input[name="password"]', CREDS.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**', { timeout: 10000 });
  console.log('✓ Logged in');
}

async function checkBranding(page, name) {
  const text = await page.evaluate(() => document.body.innerText);
  const brands = ['EDORM', 'SmartDorm', 'DormHub', 'Dormify', 'Đại học Bách Khoa Hà Nội'];
  const found = brands.filter(b => text.includes(b));
  if (found.length) {
    console.warn(`  ⚠ ${name}: found branding → ${found.join(', ')}`);
  }

  // Check sidebar exists and has no brand text
  const sidebarHtml = await page.evaluate(() => {
    const sb = document.querySelector('.adm-sidebar');
    return sb ? sb.innerHTML : null;
  });
  if (!sidebarHtml) {
    console.warn(`  ⚠ ${name}: .adm-sidebar NOT FOUND`);
  } else {
    const brandInSidebar = ['KTX HUST', 'EDORM', 'SmartDorm', 'DormHub', 'Dormify'].filter(b => sidebarHtml.includes(b));
    if (brandInSidebar.length) {
      console.warn(`  ⚠ ${name}: sidebar has branding → ${brandInSidebar.join(', ')}`);
    } else {
      console.log(`  ✓ ${name}: sidebar clean`);
    }
  }
}

async function checkColors(page, name) {
  const found = await page.evaluate((offColors) => {
    const sheets = Array.from(document.styleSheets);
    const hits = [];
    for (const sheet of sheets) {
      let rules;
      try { rules = Array.from(sheet.cssRules || []); } catch(e) { continue; }
      for (const rule of rules) {
        const txt = rule.cssText || '';
        for (const c of offColors) {
          if (txt.toLowerCase().includes(c.toLowerCase())) {
            hits.push(c);
            break;
          }
        }
      }
    }
    return [...new Set(hits)];
  }, OFF_PALETTE_COLORS);
  if (found.length) {
    console.warn(`  ⚠ ${name}: off-palette colors in CSS → ${found.join(', ')}`);
  } else {
    console.log(`  ✓ ${name}: palette clean`);
  }
}

async function checkOverflow(page, name) {
  const overflow = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    const offenders = [];
    for (const el of els) {
      if (el.scrollWidth > el.clientWidth + 5 && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        offenders.push(el.tagName + '.' + el.className.split(' ')[0]);
      }
    }
    return offenders.slice(0, 3);
  });
  if (overflow.length) {
    console.warn(`  ⚠ ${name}: horizontal overflow → ${overflow.join(', ')}`);
  }
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    await login(page);
  } catch (e) {
    console.error('Login failed:', e.message);
    await browser.close();
    process.exit(1);
  }

  for (const pg of PAGES) {
    try {
      await page.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);

      await checkBranding(page, pg.name);
      await checkColors(page, pg.name);
      await checkOverflow(page, pg.name);

      await page.screenshot({ path: path.join(OUT, pg.name + '.png'), fullPage: true });
      console.log(`  📸 ${pg.name}.png`);
    } catch (e) {
      console.warn(`  ✗ ${pg.name}: ${e.message}`);
    }
  }

  // Dormitory detail
  try {
    await page.goto(BASE + '/admin/dormitories', { waitUntil: 'networkidle', timeout: 15000 });
    const href = await page.$eval('a[href*="/admin/dormitories/view/"]', el => el.href).catch(() => null);
    if (href) {
      await page.goto(href, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, '11-dormitory-detail.png'), fullPage: true });
      console.log('  📸 11-dormitory-detail.png');
    }
  } catch (e) {
    console.warn('  ✗ dormitory-detail:', e.message);
  }

  // Student detail
  try {
    await page.goto(BASE + '/admin/students', { waitUntil: 'networkidle', timeout: 15000 });
    const href = await page.$eval('a.btn-view', el => el.href).catch(() => null);
    if (href) {
      await page.goto(href, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, '12-student-profile.png'), fullPage: true });
      console.log('  📸 12-student-profile.png');
    }
  } catch (e) {
    console.warn('  ✗ student-profile:', e.message);
  }

  await browser.close();
  console.log('\nDone. Screenshots in:', OUT);
})();
