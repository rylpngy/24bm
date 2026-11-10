import {chromium} from '/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const dir='.p0/office';const session=JSON.parse(await fs.readFile(dir+'/browser-session.json'));
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('console',m=>{if(m.type()==='error')console.log('browser console:',m.text().slice(0,200))});
await page.goto(session.url);try{await page.waitForFunction(()=>window.documentReady||window.editorError,null,{timeout:45000});}catch{console.log('editor ready timeout')}
console.log('editor flags',await page.evaluate(()=>({ready:window.documentReady,error:window.editorError})));
await page.screenshot({path:dir+'/editor-loaded.png',fullPage:true});
console.log('frames',page.frames().map(f=>f.url().split('?')[0]));
const ready=await page.evaluate(()=>window.documentReady===true);await browser.close();if(!ready)throw Error('Office editor never became ready');
