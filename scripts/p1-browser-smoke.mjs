import fs from 'node:fs/promises';
import {chromium} from '/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const session=JSON.parse(await fs.readFile('.p0/p1-browser-session.json'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(s=>localStorage.setItem('24bid.tenant-portal.session',JSON.stringify(s)),session);
 await page.goto('http://127.0.0.1:15173/?module=agency');await page.getByRole('heading',{name:'招标代理项目库'}).waitFor();await page.getByRole('button',{name:'查看档案'}).first().waitFor();
 await page.screenshot({path:'.p0/p1-project-list.png',fullPage:true});
 await page.goto('http://127.0.0.1:15173/?module=agency&recordId='+session.packageId);await page.getByRole('heading',{name:'分类附件与不可变版本'}).waitFor();await page.getByText('V1 · 已封存').first().waitFor();await page.getByText('V2 · 已封存').waitFor();
 await page.screenshot({path:'.p0/p1-package-detail.png',fullPage:true});
 await page.locator('summary').filter({hasText:'重要变更'}).first().click();
 await page.getByRole('heading',{name:'代理采购包送审快照'}).waitFor();
 const frozenDownload=page.waitForEvent('download');await page.getByRole('button',{name:'下载此送审版本'}).first().click();const frozen=await frozenDownload;await frozen.saveAs('.p0/p1-browser-frozen.txt');assert.match(await fs.readFile('.p0/p1-browser-frozen.txt','utf8'),/immutable original/);

 await page.getByRole('button',{name:'维护档案',exact:true}).click();await page.getByLabel('采购包或标段名称',{exact:true}).waitFor();await page.getByLabel('联系人',{exact:true}).fill('浏览器验收联系人');await page.getByRole('button',{name:'保存档案',exact:true}).click();await page.getByText('档案已保存',{exact:true}).waitFor();await page.getByText('浏览器验收联系人',{exact:true}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));
 await page.getByRole('button',{name:'返回项目库'}).click();await page.getByRole('button',{name:'新建采购包'}).click();await page.getByLabel('采购包或标段名称',{exact:true}).fill('浏览器新建草稿');await page.getByRole('button',{name:'保存档案',exact:true}).click();await page.getByRole('heading',{name:'浏览器新建草稿',exact:true}).waitFor();await page.getByText('未编号草稿',{exact:false}).waitFor();
 await page.screenshot({path:'.p0/p1-browser-created.png',fullPage:true});await fs.writeFile('.p0/p1-browser-result.json',JSON.stringify({checks:['项目库显示真实数据','详情展示两个文件版本','维护联系人并持久化','缺项草稿可从页面创建','历史审批下载固定送审版本，未被新版替换'],pageErrors:errors},null,2));console.log('Browser P1 smoke passed');
}finally{await browser.close()}
