import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_WALKTHROUGH_APP_URL ?? 'http://127.0.0.1:3000';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const artifactDir = process.env.STAGE_SEVEN_WALKTHROUGH_ARTIFACT_DIR ?? 'docs/artifacts';

const pages = [
  {
    id: 'demands',
    label: '采购需求',
    url: `${appBaseUrl}/?role=buyer&module=demands`,
    requiredText: ['Java 数据源', '采购需求', '提交审批', '创建询价'],
  },
  {
    id: 'approvals',
    label: '审批中心',
    url: `${appBaseUrl}/?role=buyer&module=approvals`,
    requiredText: ['Java 数据源', '审批中心', '待审批', '通过'],
  },
  {
    id: 'rfqs',
    label: '询价项目',
    url: `${appBaseUrl}/?role=buyer&module=rfqs`,
    requiredText: ['Java 数据源', '询价项目', '邀请供应商', '报价'],
  },
  {
    id: 'quotes',
    label: '报价对比',
    url: `${appBaseUrl}/?role=buyer&module=quotes`,
    requiredText: ['Java 数据源', '报价对比', '报价比较矩阵', '定标'],
  },
  {
    id: 'orders',
    label: '采购订单',
    url: `${appBaseUrl}/?role=buyer&module=orders`,
    requiredText: ['Java 数据源', '采购订单', '履约', '供应商'],
  },
  {
    id: 'receipts',
    label: '收货验收',
    url: `${appBaseUrl}/?role=buyer&module=receipts`,
    requiredText: ['Java 数据源', '收货验收', '登记收货', '验收'],
  },
  {
    id: 'invoices',
    label: '发票付款',
    url: `${appBaseUrl}/?role=buyer&module=invoices`,
    requiredText: ['Java 数据源', '发票付款', '付款', '三单匹配'],
  },
];

const viewports = [
  { id: 'desktop-1280x720', width: 1280, height: 720, label: '桌面 1280x720' },
  { id: 'mobile-390x844', width: 390, height: 844, label: '移动 390x844' },
];

const requestJson = async (path) => {
  const response = await fetch(`${javaApiBaseUrl}${path}`);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || payload?.success === false) {
    throw new Error(`GET ${path} failed: ${response.status} ${payload?.message ?? response.statusText}`);
  }
  return payload?.data;
};

const runChromeCli = ({ args, timeoutMs = 24000 }) => new Promise((resolve) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-seven-java-walkthrough-'));
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
  const screenshotPath = join(artifactDir, `stage-seven-java-${page.id}-${viewport.id}.png`);
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

const isDomReady = (page, dom) => (
  page.requiredText.every((text) => dom.includes(text))
  && !dom.includes('加载失败')
  && !dom.includes('Failed to fetch')
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
    hasLoadFailure: dom.includes('加载失败') || dom.includes('Failed to fetch'),
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
  if (checks.hasLoadFailure) failed.push('page shows 加载失败 or Failed to fetch');
  if (checks.hasArgumentTypeMismatch) failed.push('page shows argument type mismatch');
  if (checks.hasReactRuntimeError) failed.push('page shows React runtime error');

  return {
    id: page.id,
    label: page.label,
    url: page.url,
    captures,
    checks,
    failed,
  };
};

const main = async () => {
  console.log('stage-seven-java-walkthrough');
  mkdirSync(artifactDir, { recursive: true });

  const health = await requestJson('/api/v1/health');
  const results = [];
  for (const page of pages) {
    results.push(await inspectPage(page));
  }

  const failed = results.flatMap((result) => result.failed.map((failure) => `${result.label}: ${failure}`));
  const output = {
    appBaseUrl,
    javaApiBaseUrl,
    health,
    viewports,
    results,
    failed,
    note: 'Stage seven buyer main-flow Java walkthrough uses Chrome CLI screenshots plus DOM text checks.',
  };

  writeFileSync(join(artifactDir, 'stage-seven-java-walkthrough-result.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
  if (failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
