import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const fixture=JSON.parse(readFileSync(process.env.ACCEPTANCE_FIXTURE_PATH));
assert.ok(fixture.passed);
const base=process.env.JAVA_API_BASE_URL, root=process.env.ACCEPTANCE_BROWSER_DIR;
assert.ok(new URL(base).hostname==='127.0.0.1' && new URL(base).port!=='8080');
const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:fixture.buyerAccount,password:process.env.ACCEPTANCE_PASSWORD,scope:'BUYER',tenantId:fixture.tenantId})});
assert.ok(login.ok);const user=(await login.json()).data;
const browser=await chromium.launch(), errors=[],checks=[];
try {
  const context=await browser.newContext();
  await context.addInitScript(s=>localStorage.setItem('24bid.tenant-portal.session',JSON.stringify(s)),{token:user.accessToken,userId:user.userId,tenantId:user.tenantId,displayName:user.displayName});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`)});
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.tenderId}`);
    await page.getByText('发布前采购文件审查已通过。',{exact:true}).waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${root}/review-history-${width}.png`,fullPage:true});checks.push(`review-history-${width}`);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.draftId}`);
  await page.getByRole('button',{name:'提交审查',exact:true}).waitFor();
  await expect(page.getByRole('button',{name:'提交审查',exact:true})).toBeEnabled();
  assert.equal(await page.getByRole('button',{name:'发布发售',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'提交审查',exact:true}).click();
  await page.getByRole('dialog',{name:'提交审批 · 采购文件审查',exact:true}).waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${root}/review-submit.png`,fullPage:true});checks.push('review-form-and-publish-lock');
  assert.deepEqual(errors,[]);
} finally { await browser.close();writeFileSync(`${root}/browser.json`,JSON.stringify({checks,errors,passed:checks.length===3&&errors.length===0},null,2)); }
