import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_PLATFORM_VISUAL_APP_URL ?? 'http://127.0.0.1:3000';
const artifactDir = process.env.STAGE_SEVEN_PLATFORM_VISUAL_ARTIFACT_DIR ?? 'docs/artifacts';
const resultPath = join(artifactDir, 'stage-seven-platform-visual-acceptance-result.json');
const docPath = 'docs/stage-seven-platform-visual-acceptance-result.md';
const viewport = { id: 'desktop-1280x720', width: 1280, height: 720 };

const pages = [
  {
    module: 'overview',
    label: '平台看板',
    url: `${appBaseUrl}/?role=platform&module=overview`,
    requiredText: ['Java 数据源', '平台运营演示路径', '平台看板', '采购租户'],
  },
  {
    module: 'tenants',
    label: '租户列表',
    url: `${appBaseUrl}/?role=platform&module=tenants`,
    requiredText: ['Java 数据源', '平台运营演示路径', '租户列表', '租户操作'],
  },
  {
    module: 'reviews',
    label: '企业审核',
    url: `${appBaseUrl}/?role=platform&module=reviews`,
    requiredText: ['Java 数据源', '平台运营演示路径', '企业审核', '审核处理'],
  },
  {
    module: 'announcements',
    label: '平台公告',
    url: `${appBaseUrl}/?role=platform&module=announcements`,
    requiredText: ['Java 数据源', '平台运营演示路径', '平台公告', '发布平台公告'],
  },
];

const runChromeCli = ({ args, timeoutMs = 28000 }) => new Promise((resolve) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-seven-platform-visual-'));
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

const captureScreenshot = async (page) => {
  const screenshotPath = join(artifactDir, `stage-seven-platform-${page.module}-${viewport.id}.png`);
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

const captureScreenshotWithRetry = async (page) => {
  const first = await captureScreenshot(page);
  if (first.screenshotWritten) return first;
  return captureScreenshot(page);
};

const dumpDom = async (page) => {
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

const dumpDomWithRetry = async (page) => {
  const first = await dumpDom(page);
  if (first.length > 0) return first;
  return dumpDom(page);
};

const inspectPage = async (page) => {
  const capture = await captureScreenshotWithRetry(page);
  const dom = await dumpDomWithRetry(page);
  const metrics = {
    hasJavaDataSource: dom.includes('Java 数据源'),
    hasLoadFailure: dom.includes('加载失败') || dom.includes('Failed to fetch'),
    hasArgumentTypeMismatch: dom.includes('argument type mismatch'),
    hasReactRuntimeError: dom.includes('React runtime error') || dom.includes('Minified React error'),
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    bodyTextLength: dom.length,
    requiredText: Object.fromEntries(page.requiredText.map((text) => [text, dom.includes(text)])),
  };
  const failures = [];
  if (!capture.screenshotWritten) failures.push('screenshot was not written');
  if (!metrics.hasJavaDataSource) failures.push('missing Java 数据源');
  if (metrics.hasLoadFailure) failures.push('page shows load failure');
  if (metrics.hasArgumentTypeMismatch) failures.push('page shows argument type mismatch');
  if (metrics.hasReactRuntimeError) failures.push('page shows React runtime error');
  page.requiredText.forEach((text) => {
    if (text === 'Java 数据源' && !metrics.hasJavaDataSource) return;
    if (!metrics.requiredText[text]) failures.push(`missing ${text}`);
  });

  return {
    role: 'platform',
    module: page.module,
    label: page.label,
    viewport: viewport.id,
    url: page.url,
    screenshotPath: capture.screenshotPath,
    screenshotWritten: capture.screenshotWritten,
    chromeTimedOutAfterScreenshot: capture.chromeTimedOutAfterScreenshot,
    metrics,
    failures,
  };
};

const renderMarkdown = (output) => {
  const lines = [
    '# 阶段七平台运营端视觉验收结果',
    '',
    `生成时间：${output.generatedAt}`,
    '',
    '## 验收命令',
    '',
    '`node scripts/stage-seven-platform-visual-acceptance-check.mjs`',
    '',
    '## 结论',
    '',
    `- 数据源：${output.dataSource}`,
    `- 页面组合：${output.results.length}`,
    `- 失败项：${output.failed.length}`,
    '- 覆盖视口：desktop-1280x720',
    '- 覆盖页面：平台看板、租户列表、企业审核、平台公告',
    '',
    '## 截图证据',
    '',
    '| 页面 | 模块 | 视口 | 截图 | 结果 |',
    '| --- | --- | --- | --- | --- |',
    ...output.results.map((result) => (
      `| ${result.label} | ${result.module} | ${result.viewport} | \`${result.screenshotPath}\` | ${result.failures.length === 0 ? '通过' : result.failures.join('；')} |`
    )),
    '',
    '## 检查项',
    '',
    '- Java 数据源可见。',
    '- 平台运营演示路径可见。',
    '- 页面无“加载失败”、`argument type mismatch`、React runtime error。',
  ];

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  const results = [];
  for (const page of pages) {
    results.push(await inspectPage(page));
  }
  const failed = results.filter((result) => result.failures.length > 0);
  const output = {
    generatedAt: new Date().toISOString(),
    dataSource: 'Java',
    results,
    failed,
  };
  writeFileSync(resultPath, `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(docPath, renderMarkdown(output));
  console.log(JSON.stringify({
    resultPath,
    docPath,
    total: results.length,
    failed: failed.map((result) => ({
      module: result.module,
      failures: result.failures,
    })),
  }, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
