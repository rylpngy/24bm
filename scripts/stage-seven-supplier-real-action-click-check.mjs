import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_SUPPLIER_REAL_ACTION_APP_URL ?? 'http://127.0.0.1:3000';
const artifactDir = process.env.STAGE_SEVEN_SUPPLIER_REAL_ACTION_ARTIFACT_DIR ?? 'docs/artifacts';
const artifactPath = join(artifactDir, 'stage-seven-supplier-java-real-action-click-result.json');
const seedPath = 'backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql';

const actions = [
  {
    action: '提交报价',
    module: 'opportunities',
    testId: 'stage7-supplier-submit-quote-rfq-stage7-supplier-quote-ready',
    successText: '报价已提交',
  },
  {
    action: '确认订单',
    module: 'orders',
    testId: 'stage7-supplier-confirm-order-po-stage7-supplier-confirm-ready',
    successText: '供应商订单已确认',
    successExpression: `document.body.innerText.includes('供应商订单已确认')
      || (
        document.body.innerText.includes('po-stage7-supplier-confirm-ready')
        && document.body.innerText.includes('待发货')
        && !document.querySelector('[data-testid="stage7-supplier-confirm-order-po-stage7-supplier-confirm-ready"]')
      )`,
  },
  {
    action: '提交发货',
    module: 'orders',
    fill: {
      testId: 'stage7-supplier-delivery-tracking-po-stage7-supplier-delivery-ready',
      value: `SF-STAGE7-SUPPLIER-${Date.now()}`,
    },
    testId: 'stage7-supplier-create-delivery-po-stage7-supplier-delivery-ready',
    successText: '发货信息已提交',
  },
  {
    action: '提交发票',
    module: 'orders',
    fill: {
      testId: 'stage7-supplier-invoice-no-po-stage7-supplier-invoice-ready',
      value: `INV-STAGE7-SUPPLIER-${Date.now()}`,
    },
    testId: 'stage7-supplier-create-invoice-po-stage7-supplier-invoice-ready',
    successText: '发票信息已提交',
  },
  {
    action: '保存对账备注',
    module: 'invoices',
    focusText: 'inv-stage7-supplier-receivable-ready',
    fill: {
      testId: 'stage7-supplier-receivable-note-inv-stage7-supplier-receivable-ready',
      value: '阶段七供应商真实点击演示：已确认对账口径，等待采购方付款。',
    },
    testId: 'stage7-supplier-update-receivable-inv-stage7-supplier-receivable-ready',
    successText: '应收对账备注已保存并刷新',
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
    throw new Error(`Failed to apply stage seven supplier seed: ${result.stderr || result.stdout}`);
  }
};

const launchChrome = async () => {
  const userDataDir = join(tmpdir(), `stage-seven-supplier-real-action-${Date.now()}`);
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
  const url = `${appBaseUrl}/?role=supplier&module=${module}`;
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

const setFieldByTestId = async (client, sessionId, testId, value) => evalBrowser(client, sessionId, `(() => {
  const field = document.querySelector('[data-testid="${testId}"]');
  if (!field) return false;
  field.scrollIntoView({ block: 'center', inline: 'center' });
  const prototype = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  setter.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const focusCardByText = async (client, sessionId, text) => evalBrowser(client, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('[aria-label$="只读详情卡片"], [aria-label$="信息卡片"], [aria-label$="工作流卡片"]'));
  const card = cards.find((item) => item.innerText && item.innerText.includes(${JSON.stringify(text)}));
  if (!card) return false;
  const detailButton = Array.from(card.querySelectorAll('button')).find((button) => (
    button.innerText.includes('查看详情') || button.innerText.includes('当前详情')
  ));
  if (!detailButton) return false;
  detailButton.scrollIntoView({ block: 'center', inline: 'center' });
  if (!detailButton.innerText.includes('当前详情')) detailButton.click();
  return true;
})()`);

const runAction = async (client, sessionId, action) => {
  await navigate(client, sessionId, action.module);
  const beforeErrorCount = client.events.filter((event) => (
    event.method === 'Network.responseReceived'
    && event.params?.response?.status >= 400
  )).length;

  if (action.focusText) {
    await focusCardByText(client, sessionId, action.focusText);
    await wait(250);
  }

  if (action.fill) {
    const filled = await setFieldByTestId(client, sessionId, action.fill.testId, action.fill.value);
    if (!filled) {
      return {
        action: action.action,
        module: action.module,
        attemptedRealClick: false,
        successVisible: false,
        boundaryVisible: false,
        outcome: `未找到输入框 ${action.fill.testId}`,
        consoleErrors: [],
      };
    }
    await wait(250);
  }

  await waitForBrowser(client, sessionId, `Boolean(document.querySelector('[data-testid="${action.testId}"]'))`, 8000);
  const click = await clickByTestId(client, sessionId, action.testId);
  if (!click.found || click.disabled) {
    return {
      action: action.action,
      module: action.module,
      attemptedRealClick: false,
      successVisible: false,
      boundaryVisible: false,
      outcome: click.found ? '真实按钮存在但当前置灰' : `未找到真实按钮 ${action.testId}`,
      consoleErrors: [],
    };
  }

  const successVisible = await waitForBrowser(
    client,
    sessionId,
    action.successExpression ?? `document.body.innerText.includes(${JSON.stringify(action.successText)})`,
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
    boundaryVisible: false,
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
      !result.attemptedRealClick || !result.successVisible || result.consoleErrors.length > 0
    ));
    const output = {
      generatedAt: new Date().toISOString(),
      appBaseUrl,
      dataSource: 'Java 数据源',
      note: 'Stage seven supplier real action click walkthrough resets local Java demo seed, then clicks stable supplier action test ids in Chrome CDP.',
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
