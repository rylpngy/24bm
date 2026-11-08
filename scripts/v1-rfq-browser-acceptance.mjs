import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.env.JAVA_API_BASE_URL;
assert.ok(base && new URL(base).port !== '8080');
const root = process.env.ACCEPTANCE_BROWSER_DIR;
const fixture = JSON.parse(readFileSync(process.env.ACCEPTANCE_FIXTURE_PATH));
const login = await fetch(base + '/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: fixture.buyerAccount, password: process.env.ACCEPTANCE_PASSWORD,
    scope: 'BUYER', tenantId: fixture.tenantId }),
});
assert.ok(login.ok);
const user = (await login.json()).data;
const browser = await chromium.launch();
const errors = [], checks = [];
try {
  const context = await browser.newContext();
  await context.addInitScript(session => localStorage.setItem('24bid.tenant-portal.session', JSON.stringify(session)), {
    token: user.accessToken, userId: user.userId, displayName: user.displayName, tenantId: fixture.tenantId,
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: base + url.pathname + url.search });
    if (response.status() >= 400) errors.push(`${response.status()} ${url.pathname}`);
    await route.fulfill({ response });
  });
  for (const [module, text] of [['demands', '采购需求'], ['rfqs', '询价'], ['procurement-plans', '采购计划'], ['orders', '采购订单'], ['invoices', '发票']]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=${module}`);
      await page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${module} ${width} overflow`);
      await page.screenshot({ path: `${root}/${module}-${width}.png`, fullPage: true });
      checks.push(`${module}-${width}`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(`${root}/browser.json`, JSON.stringify({ checks, errors, passed: checks.length === 10 && errors.length === 0 }, null, 2));
  await browser.close();
}
