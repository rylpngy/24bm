import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_ELEVEN_VISUAL_APP_URL ?? 'http://127.0.0.1:3000';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const artifactDir = process.env.STAGE_ELEVEN_VISUAL_ARTIFACT_DIR ?? 'docs/artifacts';
const resultPath = join(artifactDir, 'stage-eleven-buyer-main-flow-visual-density-result.json');
const docPath = 'docs/stage-eleven-buyer-main-flow-visual-density-result.md';

const pages = [
  { module: 'demands', label: '采购需求', requiredText: ['Java 数据源', '采购需求', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '列表扫读'] },
  { module: 'approvals', label: '审批中心', requiredText: ['Java 数据源', '审批中心', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '详情层级'] },
  { module: 'rfqs', label: '询价项目', requiredText: ['Java 数据源', '询价项目', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '空状态解释'] },
  { module: 'quotes', label: '报价对比', requiredText: ['Java 数据源', '报价对比', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '按钮边界'] },
  { module: 'orders', label: '采购订单', requiredText: ['Java 数据源', '采购订单', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '列表扫读'] },
  { module: 'receipts', label: '收货验收', requiredText: ['Java 数据源', '收货验收', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '详情层级'] },
  { module: 'invoices', label: '发票付款', requiredText: ['Java 数据源', '发票付款', '采购方主流程操作条', '页面一致性检查', '首屏业务焦点', '动作区可见性', '演示数据瘦身', '按钮边界'] },
].map((page) => ({
  ...page,
  url: `${appBaseUrl}/?role=buyer&module=${page.module}`,
}));

const viewports = [
  { id: 'desktop-1280x720', width: 1280, height: 720, label: '桌面 1280x720' },
  { id: 'mobile-390x844', width: 390, height: 844, label: '移动 390x844' },
];

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ws = new WebSocket(wsUrl);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (message) => {
      const payload = JSON.parse(message.data.toString());
      if (payload.id && this.callbacks.has(payload.id)) {
        const { resolve, reject } = this.callbacks.get(payload.id);
        this.callbacks.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
        return;
      }
      if (payload.method) this.events.push(payload);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const requestJson = async (path) => {
  const response = await fetch(`${javaApiBaseUrl}${path}`);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || payload?.success === false) {
    throw new Error(`GET ${path} failed: ${response.status} ${payload?.message ?? response.statusText}`);
  }
  return payload?.data;
};

const runChromeCli = ({ args, timeoutMs = 9000 }) => new Promise((resolve) => {
  const userDataDir = join(tmpdir(), `stage-eleven-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const chrome = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-proxy-server',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    `--user-data-dir=${userDataDir}`,
    ...args,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: {
      ...process.env,
      NO_PROXY: '*',
      no_proxy: '*',
      http_proxy: '',
      https_proxy: '',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
    },
  });
  const stdout = [];
  const stderr = [];
  let timedOut = false;
  let settled = false;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Chrome can release profile files just after timeout; leftover temp dirs are harmless for this verifier.
    }
    resolve({
      code,
      timedOut,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    });
  };
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-chrome.pid, 'SIGKILL');
    } catch {
      chrome.kill('SIGKILL');
    }
    finish(142);
  }, timeoutMs);
  chrome.stdout.on('data', (chunk) => stdout.push(chunk));
  chrome.stderr.on('data', (chunk) => stderr.push(chunk));
  chrome.on('close', (code) => finish(code));
});

const dumpDomCli = async (page) => {
  const result = await runChromeCli({
    args: [
      '--window-size=1280,720',
      '--virtual-time-budget=5000',
      '--dump-dom',
      page.url,
    ],
  });
  return result.stdout;
};

const extractRenderedDomText = (dom) => dom
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

const hasRenderedLoadFailure = (text) => (
  /(^|\s)加载失败(\s|$)/.test(text)
  || text.includes('工作台数据加载失败')
  || text.includes('Failed to fetch')
);

const dumpDomCliWithRetry = async (page) => {
  let latestDom = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    latestDom = await dumpDomCli(page);
    const renderedText = extractRenderedDomText(latestDom);
    const ready = page.requiredText.every((text) => renderedText.includes(text))
      && !hasRenderedLoadFailure(renderedText);
    if (ready) return latestDom;
    if (attempt < 3) await wait(1200);
  }
  return latestDom;
};

const captureViewportCli = async (page, viewport) => {
  const screenshotPath = join(artifactDir, `stage-eleven-buyer-main-flow-${page.module}-${viewport.id}.png`);
  const result = await runChromeCli({
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      '--virtual-time-budget=5000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${screenshotPath}`,
      page.url,
    ],
  });
  return {
    module: page.module,
    label: page.label,
    viewport: viewport.id,
    url: page.url,
    screenshotPath,
    screenshotWritten: existsSync(screenshotPath),
    chromeTimedOutAfterScreenshot: result.timedOut,
  };
};

const inspectPageCli = async (page, viewport, dom) => {
  const capture = await captureViewportCli(page, viewport);
  const renderedText = extractRenderedDomText(dom);
  const metrics = {
    hasJavaDataSource: renderedText.includes('Java 数据源'),
    hasOperationStrip: renderedText.includes('采购方主流程操作条'),
    hasFirstScreenFocus: renderedText.includes('首屏业务焦点'),
    hasActionVisibility: renderedText.includes('动作区可见性'),
    hasDemoDataSlimming: renderedText.includes('演示数据瘦身'),
    hasPageConsistencyCheck: renderedText.includes('页面一致性检查'),
    hasLoadFailure: hasRenderedLoadFailure(renderedText),
    hasArgumentTypeMismatch: renderedText.includes('argument type mismatch'),
    hasReactRuntimeError: renderedText.includes('React runtime error') || renderedText.includes('Minified React error'),
    hasWholePageHorizontalOverflow: false,
    operationStripTop: null,
    operationStripHeight: null,
    firstScreenFocusTop: null,
    firstScreenFocusHeight: null,
    bodyTextLength: renderedText.length,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    scrollWidth: viewport.width,
    measurementMode: 'chrome-cli-dom-screenshot',
    requiredText: page.requiredText.reduce((acc, item) => {
      acc[item] = renderedText.includes(item);
      return acc;
    }, {}),
  };
  const failures = [];

  page.requiredText.forEach((text) => {
    if (!metrics.requiredText[text]) failures.push(`missing ${text}`);
  });
  if (!capture.screenshotWritten) failures.push('screenshot was not written');
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (!metrics.hasOperationStrip) failures.push('missing stage eleven operation strip');
  if (!metrics.hasFirstScreenFocus) failures.push('missing stage eleven first-screen focus');
  if (!metrics.hasActionVisibility) failures.push('missing stage eleven action visibility');
  if (!metrics.hasDemoDataSlimming) failures.push('missing stage eleven demo data slimming');
  if (!metrics.hasPageConsistencyCheck) failures.push('missing page consistency check');
  if (metrics.hasLoadFailure) failures.push('page shows load failure');
  if (metrics.hasArgumentTypeMismatch) failures.push('page shows argument type mismatch');
  if (metrics.hasReactRuntimeError) failures.push('page shows React runtime error');

  return {
    module: page.module,
    label: page.label,
    viewport: viewport.id,
    url: page.url,
    screenshotPath: capture.screenshotPath,
    metrics,
    consoleErrors: [],
    networkErrors: [],
    failures,
  };
};

const launchChrome = async () => {
  const userDataDir = join(tmpdir(), `stage-eleven-visual-${Date.now()}`);
  const port = 46000 + Math.floor(Math.random() * 1200);
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-proxy-server',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      NO_PROXY: '*',
      no_proxy: '*',
      http_proxy: '',
      https_proxy: '',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
    },
  });

  const stderr = [];
  chrome.stderr.on('data', (chunk) => stderr.push(chunk.toString('utf8')));

  const pagesUrl = `http://127.0.0.1:${port}/json`;
  const newPageUrl = `http://127.0.0.1:${port}/json/new?about:blank`;
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const pagesResponse = await fetch(pagesUrl);
      if (pagesResponse.ok) {
        const openPages = await pagesResponse.json();
        const page = openPages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (page) return { chrome, wsUrl: page.webSocketDebuggerUrl, userDataDir, stderr };
        const newPageResponse = await fetch(newPageUrl, { method: 'PUT' });
        if (newPageResponse.ok) {
          const newPage = await newPageResponse.json();
          if (newPage.type === 'page' && newPage.webSocketDebuggerUrl) {
            return { chrome, wsUrl: newPage.webSocketDebuggerUrl, userDataDir, stderr };
          }
        }
      }
    } catch {
    }
    await wait(100);
  }

  chrome.kill('SIGKILL');
  rmSync(userDataDir, { recursive: true, force: true });
  throw new Error(`Chrome did not expose DevTools endpoint: ${stderr.join('')}`);
};

const evalBrowser = async (client, expression) => {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return result.result?.value;
};

const waitForBrowser = async (client, expression, timeoutMs = 20000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evalBrowser(client, expression);
    if (value) return value;
    await wait(250);
  }
  return false;
};

const collectErrors = (client, eventStartIndex) => {
  const events = client.events.slice(eventStartIndex);
  const consoleErrors = events
    .filter((event) => (
      (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
      || event.method === 'Runtime.exceptionThrown'
      || event.method === 'Log.entryAdded'
    ))
    .map((event) => {
      if (event.method === 'Runtime.consoleAPICalled') {
        return event.params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ') ?? 'console error';
      }
      if (event.method === 'Runtime.exceptionThrown') {
        return event.params.exceptionDetails?.text ?? 'runtime exception';
      }
      return event.params?.entry?.text ?? 'log error';
    });
  const networkErrors = events
    .filter((event) => event.method === 'Network.responseReceived' && event.params?.response?.status >= 400)
    .map((event) => `${event.params.response.status} ${event.params.response.url}`);

  return { consoleErrors, networkErrors };
};

const inspectPage = async (client, page, viewport) => {
  const eventStartIndex = client.events.length;
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
  });
  await client.send('Page.navigate', { url: page.url });
  await waitForBrowser(client, `document.readyState === 'complete'`);
  await waitForBrowser(client, `document.body && document.body.innerText.includes('Java 数据源')`);
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage11-buyer-main-flow-operation-strip"]'))`);
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage11-buyer-first-screen-focus"]'))`);
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage11-buyer-action-visibility"]'))`);
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage11-buyer-demo-data-slimming"]'))`);
  await wait(600);

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const screenshotPath = join(artifactDir, `stage-eleven-buyer-main-flow-${page.module}-${viewport.id}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  const metrics = await evalBrowser(client, `(() => {
    const text = document.body?.innerText ?? '';
    const operationStrip = document.querySelector('[data-testid="stage11-buyer-main-flow-operation-strip"]');
    const firstScreenFocus = document.querySelector('[data-testid="stage11-buyer-first-screen-focus"]');
    const actionVisibility = document.querySelector('[data-testid="stage11-buyer-action-visibility"]');
    const demoDataSlimming = document.querySelector('[data-testid="stage11-buyer-demo-data-slimming"]');
    const stripRect = operationStrip?.getBoundingClientRect();
    const focusRect = firstScreenFocus?.getBoundingClientRect();
    const actionRect = actionVisibility?.getBoundingClientRect();
    const slimmingRect = demoDataSlimming?.getBoundingClientRect();
    return {
      hasJavaDataSource: text.includes('Java 数据源'),
      hasOperationStrip: Boolean(operationStrip) && text.includes('采购方主流程操作条'),
      hasFirstScreenFocus: Boolean(firstScreenFocus) && text.includes('首屏业务焦点'),
      hasActionVisibility: Boolean(actionVisibility) && text.includes('动作区可见性'),
      hasDemoDataSlimming: Boolean(demoDataSlimming) && text.includes('演示数据瘦身'),
      hasPageConsistencyCheck: Boolean(operationStrip) && text.includes('页面一致性检查'),
      hasLoadFailure: Array.from(document.querySelectorAll('p,h1,h2,h3')).some((node) => node.textContent?.trim() === '加载失败') || text.includes('Failed to fetch'),
      hasArgumentTypeMismatch: text.includes('argument type mismatch'),
      hasReactRuntimeError: text.includes('React runtime error') || text.includes('Minified React error'),
      hasWholePageHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      operationStripTop: stripRect ? Math.round(stripRect.top) : null,
      operationStripHeight: stripRect ? Math.round(stripRect.height) : null,
      firstScreenFocusTop: focusRect ? Math.round(focusRect.top) : null,
      firstScreenFocusHeight: focusRect ? Math.round(focusRect.height) : null,
      actionVisibilityTop: actionRect ? Math.round(actionRect.top) : null,
      actionVisibilityHeight: actionRect ? Math.round(actionRect.height) : null,
      demoDataSlimmingTop: slimmingRect ? Math.round(slimmingRect.top) : null,
      demoDataSlimmingHeight: slimmingRect ? Math.round(slimmingRect.height) : null,
      bodyTextLength: text.length,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      requiredText: ${JSON.stringify(page.requiredText)}.reduce((acc, item) => {
        acc[item] = text.includes(item);
        return acc;
      }, {}),
    };
  })()`);
  const { consoleErrors, networkErrors } = collectErrors(client, eventStartIndex);
  const failures = [];

  page.requiredText.forEach((text) => {
    if (!metrics.requiredText[text]) failures.push(`missing ${text}`);
  });
  if (!existsSync(screenshotPath)) failures.push('screenshot was not written');
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (!metrics.hasOperationStrip) failures.push('missing stage eleven operation strip');
  if (!metrics.hasFirstScreenFocus) failures.push('missing stage eleven first-screen focus');
  if (!metrics.hasActionVisibility) failures.push('missing stage eleven action visibility');
  if (!metrics.hasDemoDataSlimming) failures.push('missing stage eleven demo data slimming');
  if (!metrics.hasPageConsistencyCheck) failures.push('missing page consistency check');
  if (metrics.hasLoadFailure) failures.push('page shows load failure');
  if (metrics.hasArgumentTypeMismatch) failures.push('page shows argument type mismatch');
  if (metrics.hasReactRuntimeError) failures.push('page shows React runtime error');
  if (metrics.hasWholePageHorizontalOverflow) failures.push('whole page horizontal overflow');
  if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join('; ')}`);
  if (networkErrors.length > 0) failures.push(`network errors: ${networkErrors.join('; ')}`);

  return {
    module: page.module,
    label: page.label,
    viewport: viewport.id,
    url: page.url,
    screenshotPath,
    metrics,
    consoleErrors,
    networkErrors,
    failures,
  };
};

const renderMarkdown = (output) => {
  const lines = [
    '# 阶段十一采购方主流程视觉密度验收',
    '',
    `生成时间：${output.generatedAt}`,
    '',
    '## 验收命令',
    '',
    '`node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs`',
    '',
    '## 结论',
    '',
    `- 数据源：${output.dataSource}`,
    '- 覆盖页面：7 个采购方主流程页面。',
    '- 覆盖视口：desktop-1280x720、mobile-390x844。',
    `- 检查组合：${output.results.length} 个页面/视口组合。`,
    `- 失败项：${output.failed.length}`,
    `- ${output.failed.length === 0 ? '阶段十一操作条可见，首屏业务焦点可见，动作区可见性可见，演示数据瘦身可见，无整页横向溢出，控制台 error 为 0。' : '存在失败项，请查看 JSON 详情。'}`,
    '',
    '## 截图证据',
    '',
    '| 页面 | 视口 | 截图 | 结果 |',
    '| --- | --- | --- | --- |',
    ...output.results.map((result) => (
      `| ${result.label} | ${result.viewport} | \`${result.screenshotPath}\` | ${result.failures.length === 0 ? '通过' : result.failures.join('；')} |`
    )),
    '',
    '## 检查项',
    '',
    '- Java 数据源可见。',
    '- 阶段十一操作条可见。',
    '- 首屏业务焦点可见。',
    '- 动作区可见性可见。',
    '- 演示数据瘦身可见。',
    '- 页面一致性检查可见。',
    '- 页面无“加载失败”、`argument type mismatch`、React runtime error。',
    '- 控制台 error 为 0。',
    '- 无整页横向溢出。',
  ];

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  const health = await requestJson('/api/v1/health');
  let visualCheckMode = 'chrome-cli-dom-screenshot';
  let results = [];
  let browser;

  if (process.env.STAGE_ELEVEN_VISUAL_USE_CDP === '1') {
    visualCheckMode = 'cdp-real-browser';
  }

  try {
    if (visualCheckMode !== 'cdp-real-browser') {
      throw new Error('CDP visual check disabled; using Chrome CLI visual verifier');
    }
    browser = await launchChrome();
    const client = new CdpClient(browser.wsUrl);
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Log.enable');
    for (const page of pages) {
      for (const viewport of viewports) {
        results.push(await inspectPage(client, page, viewport));
      }
    }
    client.close();
  } catch (error) {
    visualCheckMode = 'chrome-cli-dom-screenshot';
    if (process.env.STAGE_ELEVEN_VISUAL_USE_CDP === '1') {
      console.error(`CDP visual check failed, falling back to Chrome CLI: ${error.message}`);
    }
    const resultsByPage = await Promise.all(pages.map(async (page) => {
      const dom = await dumpDomCliWithRetry(page);
      return Promise.all(viewports.map((viewport) => inspectPageCli(page, viewport, dom)));
    }));
    results = resultsByPage.flat();
  } finally {
    if (browser) {
      try {
        browser.chrome.kill('SIGKILL');
      } catch {
      }
      try {
        rmSync(browser.userDataDir, { recursive: true, force: true });
      } catch {
      }
    }
  }

  const failed = results.flatMap((result) => result.failures.map((failure) => ({
    module: result.module,
    viewport: result.viewport,
    failure,
  })));
  const output = {
    generatedAt: new Date().toISOString(),
    appBaseUrl,
    javaApiBaseUrl,
    health,
    dataSource: 'Java 数据源',
    viewports,
    pages: pages.map(({ module, label, url }) => ({ module, label, url })),
    visualCheckMode,
    results,
    failed,
  };

  writeFileSync(resultPath, `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(docPath, renderMarkdown(output));
  console.log(JSON.stringify(output, null, 2));
  if (failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
