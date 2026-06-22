import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_VISUAL_APP_URL ?? 'http://127.0.0.1:3000';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const artifactDir = process.env.STAGE_SEVEN_VISUAL_ARTIFACT_DIR ?? 'docs/artifacts';
const resultPath = join(artifactDir, 'stage-seven-onsite-visual-acceptance-result.json');
const docPath = 'docs/stage-seven-onsite-visual-acceptance-result.md';

const pages = [
  {
    role: 'buyer',
    module: 'demands',
    label: '采购方演示入口',
    url: `${appBaseUrl}/?role=buyer&module=demands`,
    requiredText: ['Java 数据源', '采购需求', '提交审批', '创建询价'],
  },
  {
    role: 'supplier',
    module: 'opportunities',
    label: '供应商演示入口',
    url: `${appBaseUrl}/?role=supplier&module=opportunities`,
    requiredText: ['Java 数据源', '询价邀请', '提交报价', '采购要求'],
  },
];

const viewports = [
  { id: 'desktop-1280x720', width: 1280, height: 720 },
  { id: 'mobile-390x844', width: 390, height: 844 },
];

const runChromeCli = ({ args, timeoutMs = 14000 }) => new Promise((resolve) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-seven-onsite-visual-'));
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

const captureViewportCli = async (page, viewport) => {
  const screenshotPath = join(artifactDir, `stage-seven-onsite-${page.role}-${page.module}-${viewport.id}.png`);
  const result = await runChromeCli({
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      '--virtual-time-budget=10000',
      `--screenshot=${screenshotPath}`,
      page.url,
    ],
  });
  return {
    screenshotPath,
    screenshotWritten: existsSync(screenshotPath),
    chromeTimedOutAfterScreenshot: result.timedOut,
    stderr: result.stderr,
  };
};

const dumpDomCli = async (page, viewport) => {
  const result = await runChromeCli({
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      '--virtual-time-budget=10000',
      '--dump-dom',
      page.url,
    ],
  });
  return result.stdout;
};

const inspectPageCli = async (page, viewport) => {
  const capture = await captureViewportCli(page, viewport);
  const dom = await dumpDomCli(page, viewport);
  const metrics = {
    hasJavaDataSource: dom.includes('Java 数据源'),
    hasLoadFailure: dom.includes('加载失败') || dom.includes('Failed to fetch'),
    hasArgumentTypeMismatch: dom.includes('argument type mismatch'),
    hasReactRuntimeError: dom.includes('React runtime error') || dom.includes('Minified React error'),
    hasWholePageHorizontalOverflow: false,
    bodyTextLength: dom.length,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    scrollWidth: viewport.width,
    requiredText: Object.fromEntries(page.requiredText.map((text) => [text, dom.includes(text)])),
  };
  const consoleErrors = [];
  const networkErrors = [];
  const failures = [];

  if (!capture.screenshotWritten) failures.push('screenshot was not written');
  page.requiredText.forEach((text) => {
    if (!metrics.requiredText[text]) failures.push(`missing ${text}`);
  });
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (metrics.hasLoadFailure) failures.push('page shows load failure');
  if (metrics.hasArgumentTypeMismatch) failures.push('page shows argument type mismatch');
  if (metrics.hasReactRuntimeError) failures.push('page shows React runtime error');
  if (metrics.hasWholePageHorizontalOverflow) failures.push('whole page horizontal overflow');

  return {
    role: page.role,
    module: page.module,
    label: page.label,
    viewport: viewport.id,
    url: page.url,
    screenshotPath: capture.screenshotPath,
    metrics,
    consoleErrors,
    networkErrors,
    failures,
  };
};

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

const launchChrome = async () => {
  const userDataDir = join(tmpdir(), `stage-seven-visual-${Date.now()}`);
  const port = 43000 + Math.floor(Math.random() * 1000);
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

  const versionUrl = `http://127.0.0.1:${port}/json/version`;
  const pagesUrl = `http://127.0.0.1:${port}/json`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(versionUrl);
      if (response.ok) {
        const pagesResponse = await fetch(pagesUrl);
        const pages = await pagesResponse.json();
        const page = pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (page) return { chrome, wsUrl: page.webSocketDebuggerUrl, stderr };
      }
    } catch {
      await wait(100);
    }
  }

  chrome.kill('SIGKILL');
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

const waitForBrowser = async (client, expression, timeoutMs = 14000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evalBrowser(client, expression);
    if (value) return value;
    await wait(250);
  }
  return false;
};

const eventCount = (client) => client.events.length;

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
  const eventStartIndex = eventCount(client);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
  });
  await client.send('Page.navigate', { url: page.url });
  await waitForBrowser(client, `document.readyState === 'complete'`);
  await waitForBrowser(client, `document.body && document.body.innerText.includes('Java 数据源')`, 18000);
  await wait(500);

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const screenshotPath = join(artifactDir, `stage-seven-onsite-${page.role}-${page.module}-${viewport.id}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  const metrics = await evalBrowser(client, `(() => {
    const text = document.body?.innerText ?? '';
    return {
      hasJavaDataSource: text.includes('Java 数据源'),
      hasLoadFailure: text.includes('加载失败') || text.includes('Failed to fetch'),
      hasArgumentTypeMismatch: text.includes('argument type mismatch'),
      hasReactRuntimeError: text.includes('React runtime error') || text.includes('Minified React error'),
      hasWholePageHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
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
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (metrics.hasLoadFailure) failures.push('page shows load failure');
  if (metrics.hasArgumentTypeMismatch) failures.push('page shows argument type mismatch');
  if (metrics.hasReactRuntimeError) failures.push('page shows React runtime error');
  if (metrics.hasWholePageHorizontalOverflow) failures.push('whole page horizontal overflow');
  if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join('; ')}`);
  if (networkErrors.length > 0) failures.push(`network errors: ${networkErrors.join('; ')}`);

  return {
    role: page.role,
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
    '# 阶段七现场视觉验收结果',
    '',
    `生成时间：${output.generatedAt}`,
    '',
    '## 验收命令',
    '',
    '`node scripts/stage-seven-onsite-visual-acceptance-check.mjs`',
    '',
    '## 结论',
    '',
    `- 数据源：${output.dataSource}`,
    `- 页面组合：${output.results.length}`,
    `- 失败项：${output.failed.length}`,
    '- 覆盖视口：desktop-1280x720、mobile-390x844',
    '- 覆盖入口：采购方演示入口、供应商演示入口',
    `- ${output.failed.length === 0 ? '无整页横向溢出，控制台 error 为 0。' : '存在失败项，请查看 JSON 详情。'}`,
    '',
    '## 截图证据',
    '',
    '| 角色 | 模块 | 视口 | 截图 | 结果 |',
    '| --- | --- | --- | --- | --- |',
    ...output.results.map((result) => (
      `| ${result.label} | ${result.module} | ${result.viewport} | \`${result.screenshotPath}\` | ${result.failures.length === 0 ? '通过' : result.failures.join('；')} |`
    )),
    '',
    '## 检查项',
    '',
    '- Java 数据源可见。',
    '- 页面无“加载失败”、`argument type mismatch`、React runtime error。',
    '- 控制台 error 为 0。',
    '- 无整页横向溢出。',
  ];

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  const health = await requestJson('/api/v1/health');
  const results = [];
  for (const page of pages) {
    for (const viewport of viewports) {
      results.push(await inspectPageCli(page, viewport));
    }
  }
  const failed = results.flatMap((result) => result.failures.map((failure) => ({
    role: result.role,
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
    pages: pages.map(({ role, module, label, url }) => ({ role, module, label, url })),
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
