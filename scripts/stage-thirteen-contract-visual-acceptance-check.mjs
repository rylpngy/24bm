import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_THIRTEEN_CONTRACT_VISUAL_APP_URL ?? 'http://127.0.0.1:3000';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const artifactDir = process.env.STAGE_THIRTEEN_CONTRACT_VISUAL_ARTIFACT_DIR ?? 'docs/artifacts';
const resultPath = join(artifactDir, 'stage-thirteen-contract-visual-acceptance-result.json');
const docPath = 'docs/stage-thirteen-contract-visual-acceptance-result.md';

const page = {
  role: 'buyer',
  module: 'contracts',
  label: '阶段十三合同深化页',
  url: `${appBaseUrl}/?role=buyer&module=contracts`,
  requiredText: [
    'Java 数据源',
    '合同管理',
    '阶段十三合同深化',
    '合同管理第一屏演示验收',
    '真实动作复验',
    'stage10-contract-demo-action-loop',
    '推荐合同样本',
  ],
};

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

const launchChrome = async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-thirteen-contract-visual-'));
  const port = 56000 + Math.floor(Math.random() * 2000);
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const pagesResponse = await fetch(pagesUrl);
      if (pagesResponse.ok) {
        const openPages = await pagesResponse.json();
        const pageInfo = openPages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (pageInfo) return { chrome, wsUrl: pageInfo.webSocketDebuggerUrl, userDataDir, stderr };
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

const waitForBrowser = async (client, expression, timeoutMs = 18000) => {
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

const inspectViewport = async (client, viewport) => {
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
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage13-contract-demo-readiness"]'))`);
  await waitForBrowser(client, `Boolean(document.querySelector('[data-testid="stage10-contract-demo-action-loop"]'))`);
  await wait(500);

  const screenshotPath = join(artifactDir, `stage-thirteen-contract-visual-acceptance-contracts-${viewport.id}.png`);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  const metrics = await evalBrowser(client, `(() => {
    const text = document.body?.innerText ?? '';
    const requiredText = ${JSON.stringify(page.requiredText)}.reduce((acc, item) => {
      acc[item] = text.includes(item);
      return acc;
    }, {});
    return {
      hasJavaDataSource: text.includes('Java 数据源'),
      hasStageThirteenReadinessPanel: Boolean(document.querySelector('[data-testid="stage13-contract-demo-readiness"]')),
      hasContractActionLoop: Boolean(document.querySelector('[data-testid="stage10-contract-demo-action-loop"]')),
      hasRecommendedContractSample: text.includes('推荐合同样本'),
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
  const failures = [];

  page.requiredText.forEach((text) => {
    if (!metrics.requiredText[text]) failures.push(`missing ${text}`);
  });
  if (!existsSync(screenshotPath)) failures.push('screenshot was not written');
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (!metrics.hasStageThirteenReadinessPanel) failures.push('missing stage13-contract-demo-readiness');
  if (!metrics.hasContractActionLoop) failures.push('missing stage10-contract-demo-action-loop');
  if (!metrics.hasRecommendedContractSample) failures.push('missing 推荐合同样本');
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
    '# 阶段十三合同深化浏览器视觉验收结果',
    '',
    `生成时间：${output.generatedAt}`,
    '',
    '## 验收命令',
    '',
    '`node scripts/stage-thirteen-contract-visual-acceptance-check.mjs`',
    '',
    '## 结论',
    '',
    `- 数据源：${output.dataSource}`,
    '- 覆盖页面：采购方合同管理页。',
    `- 页面组合：${output.results.length}`,
    `- 失败项：${output.failed.length}`,
    '- 覆盖视口：desktop-1280x720、mobile-390x844',
    `- ${output.failed.length === 0 ? 'stage13-contract-demo-readiness 和 stage10-contract-demo-action-loop 均可见，控制台 error 为 0，无整页横向溢出。' : '存在失败项，请查看 JSON 详情。'}`,
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
    '- `stage13-contract-demo-readiness` 阶段十三合同深化面板可见。',
    '- `stage10-contract-demo-action-loop` 合同动作闭环可见。',
    '- 推荐合同样本可见。',
    '- 页面无“加载失败”、`argument type mismatch`、React runtime error。',
    '- 控制台 error 为 0。',
    '- 无整页横向溢出。',
    '',
    '## 边界',
    '',
    '- 本轮是合同管理页浏览器视觉验收，不新增后端接口。',
    '- 本轮不做电子签章、法务红线、合同版本对比、外部合同系统或真实支付。',
    '- 合同继续作为订单、收货、发票和付款关系的演示聚合页，不替代这些业务模块。',
  ];

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  const health = await requestJson('/api/v1/health');
  const { chrome, wsUrl, userDataDir } = await launchChrome();
  const client = new CdpClient(wsUrl);
  const results = [];

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Log.enable');
    for (const viewport of viewports) {
      results.push(await inspectViewport(client, viewport));
    }
  } finally {
    client.close();
    chrome.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true });
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
    page: {
      role: page.role,
      module: page.module,
      label: page.label,
      url: page.url,
    },
    results,
    failed,
    note: 'Stage 13 contract deepening visual acceptance with Chrome CDP screenshots and DOM checks.',
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
