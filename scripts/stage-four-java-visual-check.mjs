import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const targetUrl = process.env.STAGE_FOUR_VISUAL_URL ?? 'http://127.0.0.1:3001/?role=buyer&module=invoices';
const artifactDir = process.env.STAGE_FOUR_VISUAL_ARTIFACT_DIR ?? 'docs/artifacts';
const javaApiBaseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';

const requestJson = async (path, init = {}) => {
  const response = await fetch(`${javaApiBaseUrl}${path}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok || payload?.success === false) {
    const message = payload?.message || payload?.error?.message || response.statusText;
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${message}`);
  }

  return payload?.data;
};

const loginBuyer = async () => {
  const login = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
      password: process.env.JAVA_BUYER_PASSWORD ?? 'demo123456',
      scope: 'BUYER',
      tenantId: process.env.JAVA_BUYER_TENANT_ID ?? 'tenant-acme',
    }),
  });
  return {
    login,
    headers: { Authorization: `${login.tokenType} ${login.accessToken}` },
  };
};

const daysUntilPaymentDate = (value) => {
  if (!value || value === '待排期') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
};

const paymentBatchRiskRank = (batch) => {
  const dueDays = daysUntilPaymentDate(batch.plannedPaymentDate);
  if (dueDays != null && dueDays < 0) return 0;
  if (dueDays != null && dueDays <= 7) return 1;
  if (batch.batchStatus === '可安排付款') return 2;
  if (batch.batchStatus === '审批中') return 3;
  if (batch.batchStatus === '待提交审批') return 4;
  return 5;
};

const pickDefaultPaymentBatch = (paymentBatches) =>
  [...paymentBatches].sort((left, right) => (
    paymentBatchRiskRank(left) - paymentBatchRiskRank(right)
    || (left.plannedPaymentDate ?? '待排期').localeCompare(right.plannedPaymentDate ?? '待排期')
    || left.paymentBatchNo.localeCompare(right.paymentBatchNo)
  ))[0];

const ensurePaymentBlockResolutionRecord = async () => {
  const { login, headers } = await loginBuyer();
  const paymentBatches = await requestJson('/api/v1/buyer/payment-batches', { headers });
  const selectedBatch = pickDefaultPaymentBatch(paymentBatches);
  if (!selectedBatch) {
    throw new Error('No Java payment batch is available for visual payment block resolution check');
  }

  const paymentRequests = await requestJson('/api/v1/buyer/payment-requests', { headers });
  const selectedRequest = paymentRequests.find((request) => request.paymentBatchNo === selectedBatch.paymentBatchNo);
  const existingResolutions = await requestJson(
    `/api/v1/buyer/payment-block-resolutions?paymentBatchNo=${encodeURIComponent(selectedBatch.paymentBatchNo)}`,
    { headers },
  );
  const existingResolution = existingResolutions.find(
    (resolution) => resolution.blockReason === 'Java visual smoke 阻断处理记录',
  );

  if (existingResolution) {
    return requestJson(`/api/v1/buyer/payment-block-resolutions/${existingResolution.id}/status`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        resolutionStatus: '已处理待刷新',
        resolutionAction: 'Java visual smoke 阻断处理记录',
        nextStep: '刷新付款批次详情确认处理记录台账非空回显。',
        handledBy: login.userId ?? 'user-buyer-owner',
      }),
    });
  }

  return requestJson('/api/v1/buyer/payment-block-resolutions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      paymentBatchNo: selectedBatch.paymentBatchNo,
      paymentRequestId: selectedRequest?.id ?? null,
      invoiceId: selectedRequest?.invoiceId ?? null,
      supplierId: selectedRequest?.supplierId ?? selectedBatch.supplierId ?? null,
      blockReason: 'Java visual smoke 阻断处理记录',
      resolutionStatus: '已处理待刷新',
      resolutionAction: 'Java visual smoke 阻断处理记录',
      nextStep: '刷新付款批次详情确认处理记录台账非空回显。',
      handledBy: login.userId ?? 'user-buyer-owner',
    }),
  });
};

const runChromeCli = ({ args, timeoutMs = 24000 }) => new Promise((resolve) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'stage-four-java-visual-check-'));
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

const captureViewport = async ({ name, width, height }) => {
  const screenshotPath = join(artifactDir, `stage-four-java-${name}.png`);
  const result = await runChromeCli({
    args: [
      `--window-size=${width},${height}`,
      '--virtual-time-budget=10000',
      `--screenshot=${screenshotPath}`,
      targetUrl,
    ],
  });
  return {
    name,
    width,
    height,
    screenshotPath,
    screenshotWritten: existsSync(screenshotPath),
    chromeTimedOutAfterScreenshot: result.timedOut,
  };
};

const dumpDom = async () => {
  const result = await runChromeCli({
    args: [
      '--window-size=1280,720',
      '--virtual-time-budget=10000',
      '--dump-dom',
      targetUrl,
    ],
  });
  return result.stdout;
};

const isDomReadyForFinanceCheck = (dom) => (
  dom.includes('Java 数据源')
  && dom.includes('发票付款')
  && dom.includes('付款批次详情')
  && !dom.includes('加载失败')
  && !dom.includes('Failed to fetch')
);

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const dumpDomWithRetry = async () => {
  let latestDom = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    latestDom = await dumpDom();
    if (isDomReadyForFinanceCheck(latestDom)) return latestDom;
    if (attempt < 3) {
      console.log(`DOM check retry ${attempt}: page not ready for finance assertions`);
      await wait(1200);
    }
  }
  return latestDom;
};

const main = async () => {
  console.log('stage-four-java-visual-check');
  mkdirSync(artifactDir, { recursive: true });

  const seededResolution = await ensurePaymentBlockResolutionRecord();
  const desktop = await captureViewport({ name: 'desktop-1280x720', width: 1280, height: 720 });
  const mobile = await captureViewport({ name: 'mobile-390x844', width: 390, height: 844 });
  const dom = await dumpDomWithRetry();

  const checks = {
    hasJavaDataSource: dom.includes('Java 数据源'),
    hasInvoicePayment: dom.includes('发票付款'),
    hasPaymentBatchDetail: dom.includes('付款批次详情'),
    hasResolutionLedger: dom.includes('处理记录台账'),
    hasResolutionLedgerRecord: dom.includes('Java visual smoke 阻断处理记录'),
    hasExecutionReviewHint: dom.includes('执行复核提示'),
    hasReviewActionList: dom.includes('复核动作清单'),
    hasThreeWayRebuildAction: dom.includes('刷新三单匹配'),
    hasExecutionRefreshAction: dom.includes('刷新执行复核'),
    hasRegistrationGate: dom.includes('登记前置条件'),
    hasRegistrationAction: dom.includes('登记付款状态'),
    hasRegistrationPostActionHint: dom.includes('登记后复核提示'),
    hasRegistrationReviewSummary: dom.includes('登记后复核摘要'),
    hasArchiveAuditPanel: dom.includes('归档审计面板'),
    hasArchiveAuditHandoff: dom.includes('审计追踪入口'),
    hasPendingVarianceCount: dom.includes('待处理差异数量'),
    hasPendingPaymentRequestCount: dom.includes('待复核付款申请'),
    hasLoadFailure: dom.includes('加载失败') || dom.includes('Failed to fetch'),
    hasArgumentTypeMismatch: dom.includes('argument type mismatch'),
    hasReactRuntimeError: dom.includes('React runtime error'),
  };

  const failed = [];
  if (!desktop.screenshotWritten) failed.push('desktop screenshot was not written');
  if (!mobile.screenshotWritten) failed.push('mobile screenshot was not written');
  if (!checks.hasJavaDataSource) failed.push('missing Java 数据源');
  if (!checks.hasInvoicePayment) failed.push('missing 发票付款');
  if (!checks.hasPaymentBatchDetail) failed.push('missing 付款批次详情');
  if (!checks.hasResolutionLedger) failed.push('missing 处理记录台账');
  if (!checks.hasResolutionLedgerRecord) failed.push('missing Java visual smoke 阻断处理记录');
  if (!checks.hasExecutionReviewHint) failed.push('missing 执行复核提示');
  if (!checks.hasReviewActionList) failed.push('missing 复核动作清单');
  if (!checks.hasThreeWayRebuildAction) failed.push('missing 刷新三单匹配');
  if (!checks.hasExecutionRefreshAction) failed.push('missing 刷新执行复核');
  if (!checks.hasRegistrationGate) failed.push('missing 登记前置条件');
  if (!checks.hasRegistrationAction) failed.push('missing 登记付款状态');
  if (!checks.hasRegistrationPostActionHint) failed.push('missing 登记后复核提示');
  if (!checks.hasRegistrationReviewSummary) failed.push('missing 登记后复核摘要');
  if (!checks.hasArchiveAuditPanel) failed.push('missing 归档审计面板');
  if (!checks.hasArchiveAuditHandoff) failed.push('missing 审计追踪入口');
  if (!checks.hasPendingVarianceCount) failed.push('missing 待处理差异数量');
  if (!checks.hasPendingPaymentRequestCount) failed.push('missing 待复核付款申请');
  if (checks.hasLoadFailure) failed.push('page shows 加载失败 or Failed to fetch');
  if (checks.hasArgumentTypeMismatch) failed.push('page shows argument type mismatch');
  if (checks.hasReactRuntimeError) failed.push('page shows React runtime error');

  const result = {
    targetUrl,
    seededResolution,
    viewports: [desktop, mobile],
    checks,
    failed,
    note: 'Chrome CLI exits by timeout after writing screenshots in this macOS environment; screenshot files and DOM text are used as the acceptance evidence.',
  };
  writeFileSync(join(artifactDir, 'stage-four-java-visual-check-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
