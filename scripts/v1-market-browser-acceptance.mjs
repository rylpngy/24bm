import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync, openSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.ACCEPTANCE_BROWSER_DIR;
const base = process.env.JAVA_API_BASE_URL;
assert.ok(root && base && new URL(base).hostname === '127.0.0.1' && new URL(base).port !== '8080');
const mall = JSON.parse(readFileSync(`${root}/mall-stage-three-acceptance.json`));
const tender = JSON.parse(readFileSync(`${root}/mall-procurement-stage-three-acceptance.json`));
assert.ok(mall.passed && tender.passed, 'HTTP fixtures must pass first');
const children = [], checks = [], errors = [];
const browser = await chromium.launch();
async function preview(app) {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise(r => server.close(r));
  const log = openSync(`${root}/${app}-preview.log`, 'a');
  const child = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: resolve('apps', app), env: { ...process.env, DEV_API_PROXY_TARGET: base }, stdio: ['ignore', log, log],
  });
  children.push(child);
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(url)).ok) return url; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw Error(`Preview unavailable: ${app}`);
}
async function session(fixture, scope) {
  const response = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: scope === 'BUYER' ? fixture.buyerAccount : process.env.ACCEPTANCE_SUPPLIER_ACCOUNT,
      password: process.env.ACCEPTANCE_PASSWORD, scope,
      ...(scope === 'BUYER' ? { tenantId: fixture.tenantId } : { supplierId: process.env.ACCEPTANCE_SUPPLIER_ID }) }),
  });
  assert.ok(response.ok);
  const user = (await response.json()).data;
  return { token: user.accessToken, userId: user.userId, displayName: user.displayName, tenantId: user.tenantId, supplierId: user.supplierId };
}
async function inspect(app, login, views) {
  const url = await preview(app);
  const context = await browser.newContext();
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `24bid.${app}.session`, value: login });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400) errors.push(`${app} ${r.status()} ${new URL(r.url()).pathname}`); });
  for (const [name, query] of views) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url + query);
      await page.waitForLoadState('networkidle');
      if (name === 'tender-detail') await page.getByRole('button', { name: '返回招标台账' }).waitFor();
      if (name === 'mall-cart') await page.getByText('购物车是空的', { exact: true }).waitFor();
      else assert.ok(await page.locator('h1,h2,h3').filter({ visible: true }).count(), `${name} missing heading`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflow`);
      await page.screenshot({ path: `${root}/${name}-${width}.png`, fullPage: true });
      checks.push(`${name}-${width}`);
    }
  }
  await context.close();
}
try {
  const buyer = await session(mall, 'BUYER');
  await inspect('mall-portal', buyer, [['mall-home', '/'], ['mall-category', '/?category=all'],
    ['mall-product', `/?product=${mall.records.productId}`], ['mall-cart', '/?view=cart'], ['mall-orders', '/?view=orders']]);
  await inspect('tenant-portal', await session(tender, 'BUYER'), [
    ['tender-list', '/?module=tenders'], ['tender-detail', `/?module=tenders&recordId=${tender.records.tender.tenderId}`],
    ['auction-list', '/?module=auctions']]);
  await inspect('supplier-portal', await session(mall, 'SUPPLIER'), [
    ['supplier-products', '/?module=shelf'], ['supplier-orders', '/?module=orders']]);
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(`${root}/market-browser.json`, JSON.stringify({ passed: checks.length === 20 && errors.length === 0, checks, errors }, null, 2));
  await browser.close();
  for (const child of children) {
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  }
}
