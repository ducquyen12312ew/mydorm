const { test, expect } = require('@playwright/test');

const routes = [
  { path: '/', label: 'home' },
  { path: '/map', label: 'map' },
  { path: '/login', label: 'login' },
  { path: '/signup', label: 'signup' },
  { path: '/register', label: 'register' },
];

test.describe('mobile responsive smoke', () => {
  for (const route of routes) {
    test(`${route.label}: loads and contains viewport meta`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `No response for route ${route.path}`).not.toBeNull();
      expect(response.ok(), `Route ${route.path} is not OK`).toBeTruthy();

      await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    });

    test(`${route.label}: no horizontal overflow on first paint`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `No response for route ${route.path}`).not.toBeNull();
      expect(response.ok(), `Route ${route.path} is not OK`).toBeTruthy();

      await page.waitForTimeout(350);

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        return {
          viewportWidth: window.innerWidth,
          docScrollWidth: root.scrollWidth,
          bodyScrollWidth: body ? body.scrollWidth : 0,
        };
      });

      expect(layout.docScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 2);
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 2);
    });
  }

  test('home: remains stable after orientation-like resize', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'No response for home route').not.toBeNull();
    expect(response.ok(), 'Home route is not OK').toBeTruthy();

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);

    const overflowLandscape = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return {
        viewportWidth: window.innerWidth,
        docScrollWidth: root.scrollWidth,
        bodyScrollWidth: body ? body.scrollWidth : 0,
      };
    });

    expect(overflowLandscape.docScrollWidth).toBeLessThanOrEqual(overflowLandscape.viewportWidth + 2);
    expect(overflowLandscape.bodyScrollWidth).toBeLessThanOrEqual(overflowLandscape.viewportWidth + 2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    const overflowPortrait = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return {
        viewportWidth: window.innerWidth,
        docScrollWidth: root.scrollWidth,
        bodyScrollWidth: body ? body.scrollWidth : 0,
      };
    });

    expect(overflowPortrait.docScrollWidth).toBeLessThanOrEqual(overflowPortrait.viewportWidth + 2);
    expect(overflowPortrait.bodyScrollWidth).toBeLessThanOrEqual(overflowPortrait.viewportWidth + 2);
  });

  test('home: menu is interactive on mobile widths', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Menu interaction check only needed for mobile profiles.');

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'No response for home route').not.toBeNull();
    expect(response.ok(), 'Home route is not OK').toBeTruthy();

    const menuToggle = page.locator('.menu-toggle').first();
    if (await menuToggle.count()) {
      await menuToggle.click({ force: true });
      await page.waitForTimeout(250);
      await expect(page.locator('.nav-container.active').first()).toHaveCount(1);

      await menuToggle.click({ force: true });
      await page.waitForTimeout(250);
      await expect(page.locator('.nav-container.active').first()).toHaveCount(0);
    }
  });
});
