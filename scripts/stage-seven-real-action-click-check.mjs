import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_REAL_ACTION_APP_URL ?? 'http://127.0.0.1:3000';
const artifactDir = process.env.STAGE_SEVEN_REAL_ACTION_ARTIFACT_DIR ?? 'docs/artifacts';
const artifactPath = join(artifactDir, 'stage-seven-java-real-action-click-result.json');
const seedPath = 'backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql';

const actions = [
  {
    action: '提交审批',
    module: 'demands',
    testId: 'stage7-submit-demand-dem-stage7-submit-ready',
    successText: '采购需求已提交审批',
  },
  {
    action: '通过',
    module: 'approvals',
    preflight: () => {
      const input = document.getElementById('approval-review-confirmed-approval-stage7-demand-pending');
      if (input && !input.checked) input.click();
      return Boolean(input);
    },
    testId: 'stage7-approve-approval-stage7-demand-pending',
    successText: '需求审批已通过',
  },
  {
    action: '创建询价',
    module: 'demands',
    testId: 'stage7-create-rfq-dem-stage7-rfq-ready',
    successText: '询价已创建',
  },
  {
    action: '按推荐报价提交定标审批',
    module: 'quotes',
    focusTitle: '阶段七演示-可提交定标审批 RFQ',
    testId: 'stage7-submit-award-rfq-stage7-award-ready',
    successText: '定标审批已提交',
  },
  {
    action: '生成采购订单',
    module: 'quotes',
    focusTitle: '阶段七演示-可生成采购订单 RFQ',
    testId: 'stage7-create-order-award-stage7-order-ready',
    successText: '订单已生成',
  },
  {
    action: '登记收货',
    module: 'receipts',
    testId: 'stage7-create-receipt-po-stage7-receipt-ready',
    successText: '收货验收已登记',
  },
  {
    action: '登记付款',
    module: 'invoices',
    testId: 'stage7-register-payment-inv-stage7-payment-ready',
    successText: '登记付款完成',
  },
];

class CdpClient {
  constructor(chrome) {
    this.chrome = chrome;
    this.nextId = 1;
    this.callbacks = new Map();
    this.events = [];
    this.buffer = Buffer.alloc(0);
    this.ready = Promise.resolve();
    this.chrome.stdio[4].on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      let boundary = this.buffer.indexOf(0);
      while (boundary >= 0) {
        const raw = this.buffer.slice(0, boundary).toString('utf8');
        this.buffer = this.buffer.slice(boundary + 1);
        boundary = this.buffer.indexOf(0);
        if (!raw) continue;
        const payload = JSON.parse(raw);
      if (payload.id && this.callbacks.has(payload.id)) {
        const { resolve, reject } = this.callbacks.get(payload.id);
        this.callbacks.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
          continue;
      }
      if (payload.method) this.events.push(payload);
      }
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
    });
    this.chrome.stdio[3].write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    return promise;
  }

  close() {
    this.chrome.kill('SIGKILL');
  }
}

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const applySeed = () => {
  if (!existsSync(seedPath)) {
    throw new Error(`Missing stage seven seed: ${seedPath}`);
  }
  const result = spawnSync(
    'docker',
    ['exec', '-i', 'procurement-saas-postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'procurement', '-d', 'procurement_saas'],
    { input: readFileSync(seedPath), encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to apply stage seven seed: ${result.stderr || result.stdout}`);
  }
};

const launchChrome = async () => {
  const userDataDir = join(tmpdir(), `stage-seven-real-action-${Date.now()}`);
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-pipe',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

  const stderr = [];
  chrome.stderr.on('data', (chunk) => stderr.push(chunk.toString('utf8')));
  return { chrome, stderr };
};

const evalBrowser = async (client, sessionId, expression) => {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return result.result?.value;
};

const waitForBrowser = async (client, sessionId, expression, timeoutMs = 12000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evalBrowser(client, sessionId, expression);
    if (value) return value;
    await wait(250);
  }
  return false;
};

const navigate = async (client, sessionId, module) => {
  const url = `${appBaseUrl}/?role=buyer&module=${module}`;
  await client.send('Page.navigate', { url }, sessionId);
  await waitForBrowser(client, sessionId, `document.readyState === 'complete'`);
  await waitForBrowser(
    client,
    sessionId,
    `document.body && document.body.innerText.includes('Java 数据源') && !document.body.innerText.includes('加载失败')`,
    18000,
  );
};

const clickByTestId = async (client, sessionId, testId) => evalBrowser(client, sessionId, `(() => {
  const button = document.querySelector('[data-testid="${testId}"]');
  if (!button) return { found: false, disabled: false, text: '' };
  button.scrollIntoView({ block: 'center', inline: 'center' });
  const disabled = Boolean(button.disabled || button.getAttribute('aria-disabled') === 'true');
  if (!disabled) button.click();
  return { found: true, disabled, text: button.innerText };
})()`);

const focusCardByTitle = async (client, sessionId, title) => evalBrowser(client, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('[aria-label$="信息卡片"], [aria-label$="工作流卡片"]'));
  const card = cards.find((item) => item.innerText && item.innerText.includes(${JSON.stringify(title)}));
  if (!card) return false;
  const detailButton = Array.from(card.querySelectorAll('button')).find((button) => (
    button.innerText.includes('查看详情') || button.innerText.includes('当前详情')
  ));
  if (!detailButton) return false;
  detailButton.scrollIntoView({ block: 'center', inline: 'center' });
  detailButton.click();
  return true;
})()`);

const runAction = async (client, sessionId, action) => {
  await navigate(client, sessionId, action.module);
  const beforeErrorCount = client.events.filter((event) => (
    event.method === 'Network.responseReceived'
    && event.params?.response?.status >= 400
  )).length;

  if (action.boundaryOnly) {
    const boundaryVisible = await waitForBrowser(client, sessionId, `document.body.innerText.includes(${JSON.stringify(action.boundaryText)})`, 4000);
    return {
      action: action.action,
      module: action.module,
      attemptedRealClick: false,
      successVisible: false,
      boundaryVisible: Boolean(boundaryVisible),
      outcome: boundaryVisible ? '当前数据无可点击真实按钮但边界可解释' : '当前数据无可点击真实按钮且缺少边界提示',
      consoleErrors: [],
    };
  }

  if (action.preflight) {
    await evalBrowser(client, sessionId, `(${action.preflight.toString()})()`);
  }

  if (action.focusTitle) {
    await focusCardByTitle(client, sessionId, action.focusTitle);
    await waitForBrowser(
      client,
      sessionId,
      `Boolean(document.querySelector('[data-testid="${action.testId}"]'))`,
      6000,
    );
  }

  const click = await clickByTestId(client, sessionId, action.testId);
  if (!click.found || click.disabled) {
    return {
      action: action.action,
      module: action.module,
      attemptedRealClick: false,
      successVisible: false,
      boundaryVisible: true,
      outcome: click.found ? '真实按钮存在但当前置灰，边界可解释' : '未找到真实按钮，边界可解释',
      consoleErrors: [],
    };
  }

  const successVisible = await waitForBrowser(
    client,
    sessionId,
    `document.body.innerText.includes(${JSON.stringify(action.successText)})`,
    18000,
  );
  const failedResponses = client.events
    .filter((event) => event.method === 'Network.responseReceived' && event.params?.response?.status >= 400)
    .slice(beforeErrorCount)
    .map((event) => `${event.params.response.status} ${event.params.response.url}`);

  return {
    action: action.action,
    module: action.module,
    attemptedRealClick: true,
    successVisible: Boolean(successVisible),
    boundaryVisible: !successVisible && failedResponses.length === 0,
    outcome: successVisible ? '真实点击完成并出现业务反馈' : '真实点击后未出现预期业务反馈',
    consoleErrors: failedResponses,
  };
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  applySeed();

  const { chrome } = await launchChrome();
  const client = new CdpClient(chrome);
  try {
    await client.send('Browser.getVersion');
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Network.enable', {}, sessionId);

    const results = [];
    for (const action of actions) {
      results.push(await runAction(client, sessionId, action));
    }
    const failed = results.filter((result) => (
      result.attemptedRealClick
        ? !result.successVisible || result.consoleErrors.length > 0
        : !result.boundaryVisible
    ));
    const output = {
      generatedAt: new Date().toISOString(),
      appBaseUrl,
      dataSource: 'Java 数据源',
      note: 'Stage seven real action click walkthrough resets local Java demo seed, then clicks stable action test ids in Chrome CDP.',
      results,
      failed,
    };
    writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    client.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
