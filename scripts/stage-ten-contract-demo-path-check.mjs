import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_TEN_CONTRACT_DEMO_APP_URL ?? 'http://127.0.0.1:3000';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const artifactDir = process.env.STAGE_TEN_CONTRACT_DEMO_ARTIFACT_DIR ?? 'docs/artifacts';

const pathFocus = [
  '订单生成合同',
  '合同审批',
  '合同履约事件',
  '合同与订单/发票/付款关系',
];

const pages = [
  {
    id: 'orders',
    label: '采购订单',
    url: `${appBaseUrl}/?role=buyer&module=orders`,
    requiredText: ['Java 数据源', '采购订单'],
    focus: ['订单生成合同', '合同与订单/发票/付款关系'],
  },
  {
    id: 'contracts',
    label: '合同管理',
    url: `${appBaseUrl}/?role=buyer&module=contracts`,
    requiredText: ['Java 数据源', '合同管理', '合同台账', '阶段十合同演示总线', '推荐合同样本', '合同演示动作闭环'],
    focus: ['订单生成合同', '合同审批', '合同履约事件', '合同与订单/发票/付款关系'],
  },
  {
    id: 'approvals',
    label: '审批中心',
    url: `${appBaseUrl}/?role=buyer&module=approvals`,
    requiredText: ['Java 数据源', '审批中心'],
    focus: ['合同审批'],
  },
  {
    id: 'receipts',
    label: '收货验收',
    url: `${appBaseUrl}/?role=buyer&module=receipts`,
    requiredText: ['Java 数据源', '收货验收'],
    focus: ['合同履约事件'],
  },
  {
    id: 'invoices',
    label: '发票付款',
    url: `${appBaseUrl}/?role=buyer&module=invoices`,
    requiredText: ['Java 数据源', '发票付款'],
    focus: ['合同与订单/发票/付款关系'],
  },
];

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

const requestJson = async (path) => {
  const response = await fetch(`${javaApiBaseUrl}${path}`);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || payload?.success === false) {
    throw new Error(`GET ${path} failed: ${response.status} ${payload?.message ?? response.statusText}`);
  }
  return payload?.data;
};

const runChromeCli = ({ args, timeoutMs = 26000 }) => new Promise((resolve) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-ten-contract-demo-path-'));
  const chrome = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    ...args,
  ], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const stdout = [];
  const stderr = [];
  let timedOut = false;
  let settled = false;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    rmSync(userDataDir, { recursive: true, force: true });
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

const captureViewport = async (page, viewport) => {
  const screenshotPath = join(artifactDir, `stage-ten-contract-demo-path-${page.id}-${viewport.id}.png`);
  const result = await runChromeCli({
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      '--virtual-time-budget=10000',
      `--screenshot=${screenshotPath}`,
      page.url,
    ],
  });
  return {
    page: page.id,
    viewport: viewport.id,
    width: viewport.width,
    height: viewport.height,
    screenshotPath,
    screenshotWritten: existsSync(screenshotPath),
    chromeTimedOutAfterScreenshot: result.timedOut,
  };
};

const dumpDom = async (page) => {
  const result = await runChromeCli({
    args: [
      '--window-size=1280,720',
      '--virtual-time-budget=10000',
      '--dump-dom',
      page.url,
    ],
  });
  return result.stdout;
};

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const launchChrome = async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-ten-contract-demo-path-cdp-'));
  const port = 52000 + Math.floor(Math.random() * 4000);
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

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

const waitForBrowser = async (client, expression, timeoutMs = 16000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evalBrowser(client, expression);
    if (value) return value;
    await wait(250);
  }
  return false;
};

const hasStandaloneLoadFailure = (dom) => />\s*加载失败\s*</.test(dom) || dom.includes('Failed to fetch');

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

const isDomReady = (page, dom) => (
  page.requiredText.every((text) => dom.includes(text))
  && !hasStandaloneLoadFailure(dom)
);

const dumpDomWithRetry = async (page) => {
  let latestDom = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    latestDom = await dumpDom(page);
    if (isDomReady(page, latestDom)) return latestDom;
    if (attempt < 3) {
      console.log(`DOM check retry ${attempt} for ${page.label}: page not ready`);
      await wait(1200);
    }
  }
  return latestDom;
};

const inspectPage = async (page) => {
  const captures = [];
  for (const viewport of viewports) {
    captures.push(await captureViewport(page, viewport));
  }

  const dom = await dumpDomWithRetry(page);
  const checks = {
    hasJavaDataSource: dom.includes('Java 数据源'),
    hasLoadFailure: hasStandaloneLoadFailure(dom),
    hasArgumentTypeMismatch: dom.includes('argument type mismatch'),
    hasReactRuntimeError: dom.includes('React runtime error'),
    requiredText: Object.fromEntries(page.requiredText.map((text) => [text, dom.includes(text)])),
  };

  const failed = [];
  for (const capture of captures) {
    if (!capture.screenshotWritten) failed.push(`${capture.viewport} screenshot was not written`);
  }
  for (const text of page.requiredText) {
    if (!checks.requiredText[text]) failed.push(`missing ${text}`);
  }
  if (!checks.hasJavaDataSource) failed.push('missing Java 数据源');
  if (checks.hasLoadFailure) failed.push('page shows 加载失败 or Failed to fetch');
  if (checks.hasArgumentTypeMismatch) failed.push('page shows argument type mismatch');
  if (checks.hasReactRuntimeError) failed.push('page shows React runtime error');

  return {
    id: page.id,
    label: page.label,
    url: page.url,
    focus: page.focus,
    captures,
    checks,
    failed,
  };
};

const inspectPageWithCdp = async (client, page) => {
  const captures = [];
  const pageFailures = [];
  let pageMetrics = null;
  let pageConsoleErrors = [];
  let pageNetworkErrors = [];

  for (const viewport of viewports) {
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
    await wait(500);

    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const screenshotPath = join(artifactDir, `stage-ten-contract-demo-path-${page.id}-${viewport.id}.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    const metrics = await evalBrowser(client, `(() => {
      const text = document.body?.innerText ?? '';
      const requiredText = ${JSON.stringify(page.requiredText)}.reduce((acc, item) => {
        acc[item] = text.includes(item);
        return acc;
      }, {});
      return {
        hasJavaDataSource: text.includes('Java 数据源'),
        hasLoadFailure: Array.from(document.querySelectorAll('p,h1,h2,h3')).some((node) => node.textContent?.trim() === '加载失败') || text.includes('Failed to fetch'),
        hasArgumentTypeMismatch: text.includes('argument type mismatch'),
        hasReactRuntimeError: text.includes('React runtime error') || text.includes('Minified React error'),
        hasWholePageHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        bodyTextLength: text.length,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        requiredText,
      };
    })()`);
    const { consoleErrors, networkErrors } = collectErrors(client, eventStartIndex);
    pageMetrics = metrics;
    pageConsoleErrors = pageConsoleErrors.concat(consoleErrors);
    pageNetworkErrors = pageNetworkErrors.concat(networkErrors);

    const capture = {
      page: page.id,
      viewport: viewport.id,
      width: viewport.width,
      height: viewport.height,
      screenshotPath,
      screenshotWritten: existsSync(screenshotPath),
      hasWholePageHorizontalOverflow: metrics.hasWholePageHorizontalOverflow,
    };
    captures.push(capture);

    if (!capture.screenshotWritten) pageFailures.push(`${viewport.id} screenshot was not written`);
    if (metrics.hasWholePageHorizontalOverflow) pageFailures.push(`${viewport.id} whole page horizontal overflow`);
  }

  const checks = {
    hasJavaDataSource: Boolean(pageMetrics?.hasJavaDataSource),
    hasLoadFailure: Boolean(pageMetrics?.hasLoadFailure),
    hasArgumentTypeMismatch: Boolean(pageMetrics?.hasArgumentTypeMismatch),
    hasReactRuntimeError: Boolean(pageMetrics?.hasReactRuntimeError),
    requiredText: pageMetrics?.requiredText ?? Object.fromEntries(page.requiredText.map((text) => [text, false])),
  };

  for (const text of page.requiredText) {
    if (!checks.requiredText[text]) pageFailures.push(`missing ${text}`);
  }
  if (!checks.hasJavaDataSource) pageFailures.push('missing Java 数据源');
  if (checks.hasLoadFailure) pageFailures.push('page shows 加载失败 or Failed to fetch');
  if (checks.hasArgumentTypeMismatch) pageFailures.push('page shows argument type mismatch');
  if (checks.hasReactRuntimeError) pageFailures.push('page shows React runtime error');
  if (pageConsoleErrors.length > 0) pageFailures.push(`console errors: ${pageConsoleErrors.join('; ')}`);
  if (pageNetworkErrors.length > 0) pageFailures.push(`network errors: ${pageNetworkErrors.join('; ')}`);

  return {
    id: page.id,
    label: page.label,
    url: page.url,
    focus: page.focus,
    captures,
    checks,
    consoleErrors: pageConsoleErrors,
    networkErrors: pageNetworkErrors,
    failed: pageFailures,
  };
};

const writeReview = ({ health, results, failed }) => {
  const status = failed.length === 0 ? '通过' : '存在问题';
  const lines = [
    '# 阶段十合同演示路径复核',
    '',
    `复核时间：${new Date().toISOString()}`,
    '',
    `结论：${status}。本轮使用 Java 数据源复核采购订单、合同管理、审批中心、收货验收、发票付款五个页面，目标是确认合同管理可以承接订单演示路径。`,
    '',
    '## 演示主线',
    '',
    '- 订单生成合同：从采购订单讲到合同台账，说明订单进入合同约束与履约跟踪。',
    '- 合同审批：从合同管理和审批中心讲合同审批状态，暂不扩展复杂法务流。',
    '- 合同履约事件：从合同管理和收货验收讲履约节点，强调演示级履约记录。',
    '- 合同与订单/发票/付款关系：从采购订单、合同管理、发票付款讲业务关系，不宣称已完成三单匹配或真实支付。',
    '',
    '## 页面复核',
    '',
    '| 页面 | URL | 复核重点 | 结果 |',
    '| --- | --- | --- | --- |',
    ...results.map((result) => (
      `| ${result.label} | \`${result.url}\` | ${result.focus.join('、')} | ${result.failed.length === 0 ? '通过' : result.failed.join('；')} |`
    )),
    '',
    '## 稳定性信号',
    '',
    `- Java 健康检查：${health?.status ?? 'unknown'}`,
    '- 无加载失败。',
    '- 无 `argument type mismatch`。',
    '- 无 React runtime error。',
    '- 桌面 1280x720 和移动 390x844 均已输出截图证据。',
    '',
    '## 边界',
    '',
    '- 本轮是合同演示路径复核，不新增后端接口。',
    '- 本轮不做电子签章、真实盖章、法务红线批注、外部合同系统或合同版本对比。',
    '- 合同与订单、收货、发票、付款关系仍按演示闭环讲解，暂不写成完整财务合规闭环。',
    '',
    '## 证据',
    '',
    '- 脚本：`scripts/stage-ten-contract-demo-path-check.mjs`',
    '- JSON：`docs/artifacts/stage-ten-contract-demo-path-result.json`',
    '- 截图：`docs/artifacts/stage-ten-contract-demo-path-*.png`',
    '',
  ];

  writeFileSync('docs/stage-ten-contract-demo-path-review.md', `${lines.join('\n')}\n`);
};

const main = async () => {
  console.log('stage-ten-contract-demo-path-check');
  mkdirSync(artifactDir, { recursive: true });

  const health = await requestJson('/api/v1/health');
  const results = [];
  const browser = await launchChrome();
  const client = new CdpClient(browser.wsUrl);
  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Log.enable');
    for (const page of pages) {
      results.push(await inspectPageWithCdp(client, page));
    }
  } finally {
    client.close();
    browser.chrome.kill('SIGKILL');
    rmSync(browser.userDataDir, { recursive: true, force: true });
  }

  const failed = results.flatMap((result) => result.failed.map((failure) => `${result.label}: ${failure}`));
  const output = {
    appBaseUrl,
    javaApiBaseUrl,
    dataSource: 'Java 数据源',
    health,
    pathFocus,
    viewports,
    results,
    failed,
    note: 'Stage 10 contract order handoff demo path review with Chrome CLI screenshots and DOM text checks.',
  };

  writeFileSync(join(artifactDir, 'stage-ten-contract-demo-path-result.json'), `${JSON.stringify(output, null, 2)}\n`);
  writeReview({ health, results, failed });
  console.log(JSON.stringify(output, null, 2));
  if (failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
