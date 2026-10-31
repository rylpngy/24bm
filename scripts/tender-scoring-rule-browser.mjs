import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { chromium,expect } from '@playwright/test';
const fixture=JSON.parse(readFileSync(process.env.ACCEPTANCE_FIXTURE_PATH));
assert.ok(fixture.passed);
const base=process.env.JAVA_API_BASE_URL,root=process.env.ACCEPTANCE_BROWSER_DIR;
assert.ok(new URL(base).hostname==='127.0.0.1'&&new URL(base).port!=='8080');
const response=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:fixture.buyerAccount,password:process.env.ACCEPTANCE_PASSWORD,scope:'BUYER',tenantId:fixture.tenantId})});
assert.ok(response.ok);const user=(await response.json()).data;
const browser=await chromium.launch(),checks=[],errors=[];
try{
 const context=await browser.newContext();await context.addInitScript(s=>localStorage.setItem('24bid.tenant-portal.session',JSON.stringify(s)),{token:user.accessToken,userId:user.userId,tenantId:user.tenantId,displayName:user.displayName});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`)});
 await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.tenderId}`);
 await expect(page.getByLabel('技术权重')).toHaveValue('40');await expect(page.getByLabel('技术权重')).toBeDisabled();
 await expect(page.getByRole('button',{name:'保存评分规则',exact:true})).toHaveCount(0);checks.push('published-rule-locked');
 await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.draftId}`);
 await expect(page.getByLabel('技术权重')).toBeEnabled();await page.getByLabel('技术权重').fill('70');
 await page.getByLabel('编制或调整依据').fill('浏览器验收：技术能力优先');
 await expect(page.getByRole('button',{name:'保存评分规则',exact:true})).toBeDisabled();
 await page.getByLabel('商务权重').fill('10');await page.getByLabel('价格权重').fill('20');
 await page.getByRole('button',{name:'保存评分规则',exact:true}).click();
 await expect(page.getByText(/综合得分 = 技术均分×70%/)).toBeVisible();checks.push('invalid-sum-blocked-and-real-save');
 await page.reload();await expect(page.getByLabel('技术权重')).toHaveValue('70');checks.push('saved-rule-survives-reload');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.waitForLoadState('networkidle');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${root}/scoring-rule-${width}.png`,fullPage:true});checks.push(`scoring-rule-${width}`);}
 assert.deepEqual(errors,[]);
}finally{await browser.close();writeFileSync(`${root}/browser.json`,JSON.stringify({passed:checks.length===5&&errors.length===0,checks,errors},null,2));}
