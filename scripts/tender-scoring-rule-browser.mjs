import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { chromium,expect } from '@playwright/test';
const fixture=JSON.parse(readFileSync(process.env.ACCEPTANCE_FIXTURE_PATH));
assert.ok(fixture.passed);
const base=process.env.JAVA_API_BASE_URL,root=process.env.ACCEPTANCE_BROWSER_DIR;
const stage3FixturePath=process.env.ACCEPTANCE_STAGE3_FIXTURE_PATH??`${root}/mall-procurement-stage-three-acceptance.json`;
assert.ok(new URL(base).hostname==='127.0.0.1'&&new URL(base).port!=='8080');
const response=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:fixture.buyerAccount,password:process.env.ACCEPTANCE_PASSWORD,scope:'BUYER',tenantId:fixture.tenantId})});
assert.ok(response.ok);const user=(await response.json()).data;
const browser=await chromium.launch(),checks=[],errors=[];
try{
 const context=await browser.newContext();await context.addInitScript(s=>localStorage.setItem('24bid.tenant-portal.session',JSON.stringify(s)),{token:user.accessToken,userId:user.userId,tenantId:user.tenantId,displayName:user.displayName});
 let page=await context.newPage();const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`)});};observe(page);
 await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.tenderId}`);
 await expect(page.getByLabel('技术权重')).toHaveValue('40');await expect(page.getByLabel('技术权重')).toBeDisabled();
 await expect(page.getByRole('button',{name:'保存评分规则',exact:true})).toHaveCount(0);checks.push('published-rule-locked');
 const ruleUrl=base+`/api/v1/buyer/tenders/${fixture.records.draftId}/scoring-rule`;
 const draftRuleResponse=await fetch(ruleUrl,{headers:{Authorization:`Bearer ${user.accessToken}`}});assert.ok(draftRuleResponse.ok);
 const draftRule=(await draftRuleResponse.json()).data;
 if(Number(draftRule.weights.technical)!==50||Number(draftRule.weights.commercial)!==20||Number(draftRule.weights.price)!==30){
  const reset=await fetch(ruleUrl,{method:'PUT',headers:{Authorization:`Bearer ${user.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({technicalWeight:50,commercialWeight:20,priceWeight:30,reason:'隔离浏览器重试恢复测试前置条件',expectedRevision:draftRule.revision})});assert.ok(reset.ok);
 }
 await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${fixture.records.draftId}`);
 await expect(page.getByLabel('技术权重')).toBeEnabled();await page.getByLabel('技术权重').fill('70');
 await page.getByLabel('编制或调整依据').fill('浏览器验收：技术能力优先');
 await expect(page.getByRole('button',{name:'保存评分规则',exact:true})).toBeDisabled();
 await page.getByLabel('商务权重').fill('10');await page.getByLabel('价格权重').fill('20');
 await page.getByRole('button',{name:'保存评分规则',exact:true}).click();
 await expect(page.getByText(/综合得分 = 技术均分×70%/)).toBeVisible();checks.push('invalid-sum-blocked-and-real-save');
 await page.reload();await expect(page.getByLabel('技术权重')).toHaveValue('70');checks.push('saved-rule-survives-reload');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.waitForLoadState('networkidle');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${root}/scoring-rule-${width}.png`,fullPage:true});checks.push(`scoring-rule-${width}`);}
 {
  const stage3=JSON.parse(readFileSync(stage3FixturePath));assert.ok(stage3.passed);
  const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:stage3.buyerAccount,password:process.env.ACCEPTANCE_PASSWORD,scope:'BUYER',tenantId:stage3.tenantId})});
  assert.ok(r.ok);const owner=(await r.json()).data;
  await context.close();
  const stageContext=await browser.newContext();await stageContext.addInitScript(u=>localStorage.setItem('24bid.tenant-portal.session',JSON.stringify({token:u.accessToken,userId:u.userId,tenantId:u.tenantId,displayName:u.displayName})),owner);
  page=await stageContext.newPage();observe(page);
  for(const [index,record] of stage3.records.rebids.entries()){
   await page.goto(`${process.env.ACCEPTANCE_FRONTEND_URL}/?module=tenders&recordId=${record.successorId}`);
   await expect(page.getByRole('button',{name:'查看原流标项目'})).toBeVisible();
   await page.getByRole('button',{name:'查看原流标项目'}).click();
   await expect(page.getByRole('heading',{name:'流标留痕'})).toBeVisible();
   await expect(page.getByRole('button',{name:'宣布流标',exact:true})).toHaveCount(0);
   await expect(page.getByRole('button',{name:/提交「.*」评分/})).toHaveCount(0);
   if(index===1){await page.getByText('历史评分记录（只读）',{exact:true}).click();await expect(page.getByText('部分评审历史保留',{exact:true})).toBeVisible();}
   for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.waitForLoadState('networkidle');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${root}/rebid-history-${index}-${width}.png`,fullPage:true});}
   checks.push(`rebid-${index}-origin-link-and-readonly-history`);
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();writeFileSync(`${root}/browser.json`,JSON.stringify({passed:checks.length===7&&errors.length===0,checks,errors},null,2));}
