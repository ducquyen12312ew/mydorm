const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().substring(0,120)); });

    // 1. Test home page in English
    await page.goto('http://localhost:5001/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'e2e-screenshots/i18n-home-vi.png' });

    // Switch to English via i18n API
    await page.evaluate(() => window.i18n && window.i18n.setLanguage('en', false));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'e2e-screenshots/i18n-home-en.png' });

    const heroText = await page.$eval('.hero-title', el => el.textContent).catch(() => 'N/A');
    const navHome = await page.$eval('[data-i18n="nav.home"]', el => el.textContent).catch(() => 'N/A');
    const benefitWifi = await page.$eval('[data-i18n="home.wifiSpeed"]', el => el.textContent).catch(() => 'N/A');

    console.log('Hero title (en):', heroText);
    console.log('Nav home (en):', navHome);
    console.log('WiFi benefit (en):', benefitWifi);

    // Switch to Korean
    await page.evaluate(() => window.i18n && window.i18n.setLanguage('ko', false));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'e2e-screenshots/i18n-home-ko.png' });
    const heroKo = await page.$eval('.hero-title', el => el.textContent).catch(() => 'N/A');
    console.log('Hero title (ko):', heroKo);

    // 2. Test login page
    await page.goto('http://localhost:5001/login', { waitUntil: 'networkidle', timeout: 10000 });
    await page.evaluate(() => window.i18n && window.i18n.setLanguage('zh', false));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'e2e-screenshots/i18n-login-zh.png' });
    const loginTitle = await page.$eval('[data-i18n="auth.loginTitle"]', el => el.textContent).catch(() => 'N/A');
    console.log('Login title (zh):', loginTitle);

    // 3. Test admin page - role display
    await page.goto('http://localhost:5001/admin/dashboard', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: 'e2e-screenshots/task1-admin-before-login.png' });

    console.log('\nConsole errors:', errors.length);
    errors.slice(0,5).forEach(e => console.log(' ', e));

    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
