import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appBaseUrl = process.env.STAGE_SEVEN_PLATFORM_REAL_ACTION_APP_URL ?? 'http://127.0.0.1:3000';
const artifactDir = process.env.STAGE_SEVEN_PLATFORM_REAL_ACTION_ARTIFACT_DIR ?? 'docs/artifacts';
const artifactPath = join(artifactDir, 'stage-seven-platform-java-real-action-click-result.json');
const seedPath = 'backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql';
const announcementTitle = `阶段七平台演示-真实发布公告-${Date.now()}`;

const actions = [
  {
    action: '停用租户',
    module: 'tenants',
    testId: 'stage7-platform-disable-tenant-tenant-stage7-platform-action',
    successText: '平台租户已停用：tenant-stage7-platform-action',
  },
  {
    action: '升级专业版',
    module: 'tenants',
    testId: 'stage7-platform-upgrade-plan-tenant-stage7-platform-action',
    successText: '平台租户套餐已更新：tenant-stage7-platform-action',
  },
  {
    action: '通过企业审核',
    module: 'reviews',
    checks: [
      'stage7-platform-review-profile-ent-stage7-platform-review-ready',
      'stage7-platform-review-risk-ent-stage7-platform-review-ready',
    ],
    testId: 'stage7-platform-approve-review-ent-stage7-platform-review-ready',
    successText: '平台企业审核已通过：ent-stage7-platform-review-ready',
  },
  {
    action: '发布平台公告',
    module: 'announcements',
    fill: [
      { testId: 'stage7-platform-announcement-title', value: announcementTitle },
      { testId: 'stage7-platform-announcement-content', value: '阶段七平台端真实点击演示：公告发布能力已通过 Java 模式验证。' },
    ],
    testId: 'stage7-platform-publish-announcement',
    successText: `平台公告已发布：${announcementTitle}`,
  },
  {
    action: '撤回平台公告',
    module: 'announcements',
    selectTestId: 'stage7-platform-select-announcement-announcement-stage7-platform-withdraw-ready',
    testId: 'stage7-platform-withdraw-announcement-announcement-stage7-platform-withdraw-ready',
    successText: '平台公告已撤回：阶段七平台演示-可撤回公告',
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
    throw new Error(`Failed to apply stage seven platform seed: ${result.stderr || result.stdout}`);
  }
};

const launchChrome = async () => {
  const userDataDir = join(tmpdir(), `stage-seven-platform-real-action-${Date.now()}`);
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

const waitForBrowser = async (client, sessionId, expression, timeoutMs = 16000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evalBrowser(client, sessionId, expression);
    if (value) return value;
    await wait(250);
  }
  return false;
};

const navigate = async (client, sessionId, module) => {
  const url = `${appBaseUrl}/?role=platform&module=${module}`;
  await client.send('Page.navigate', { url }, sessionId);
  await waitForBrowser(client, sessionId, `document.readyState === 'complete'`);
  await waitForBrowser(
    client,
    sessionId,
    `document.body && document.body.innerText.includes('Java 数据源') && document.body.innerText.includes('平台运营演示路径') && !document.body.innerText.includes('加载失败')`,
    22000,
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
  const prototype = field.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : field.tagName === 'SELECT'
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  setter.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const checkByTestId = async (client, sessionId, testId) => evalBrowser(client, sessionId, `(() => {
  const field = document.querySelector('[data-testid="${testId}"]');
  if (!field) return false;
  field.scrollIntoView({ block: 'center', inline: 'center' });
  if (!field.checked) field.click();
  return true;
})()`);

const runAction = async (client, sessionId, action) => {
  await navigate(client, sessionId, action.module);
  const beforeErrorCount = client.events.filter((event) => (
    event.method === 'Network.responseReceived'
    && event.params?.response?.status >= 400
  )).length;

  if (action.fill) {
    for (const field of action.fill) {
      const filled = await setFieldByTestId(client, sessionId, field.testId, field.value);
      if (!filled) {
        return { ...action, passed: false, failure: `field not found: ${field.testId}` };
      }
    }
  }

  if (action.checks) {
    for (const testId of action.checks) {
      const checked = await checkByTestId(client, sessionId, testId);
      if (!checked) {
        return { ...action, passed: false, failure: `checkbox not found: ${testId}` };
      }
    }
  }

  if (action.selectTestId) {
    const selectionReady = await waitForBrowser(
      client,
      sessionId,
      `Boolean(document.querySelector('[data-testid="${action.selectTestId}"]'))`,
      16000,
    );
    if (!selectionReady) {
      return { ...action, passed: false, failure: `selection not found: ${action.selectTestId}` };
    }
    const selection = await clickByTestId(client, sessionId, action.selectTestId);
    if (!selection.found) {
      return { ...action, passed: false, failure: `selection not found: ${action.selectTestId}` };
    }
    await waitForBrowser(client, sessionId, `document.querySelector('[data-testid="${action.selectTestId}"]')?.getAttribute('aria-pressed') === 'true'`, 6000);
  }

  const click = await clickByTestId(client, sessionId, action.testId);
  if (!click.found) {
    return { ...action, passed: false, failure: `button not found: ${action.testId}` };
  }
  if (click.disabled) {
    return { ...action, passed: false, failure: `button disabled: ${action.testId}` };
  }

  const success = await waitForBrowser(
    client,
    sessionId,
    `document.body && document.body.innerText.includes(${JSON.stringify(action.successText)})`,
    18000,
  );
  const afterErrorCount = client.events.filter((event) => (
    event.method === 'Network.responseReceived'
    && event.params?.response?.status >= 400
  )).length;

  if (!success) {
    const bodyText = await evalBrowser(client, sessionId, 'document.body ? document.body.innerText.slice(0, 1200) : ""');
    return { ...action, passed: false, failure: `success text not found: ${action.successText}`, bodyText };
  }
  if (afterErrorCount > beforeErrorCount) {
    return { ...action, passed: false, failure: 'network error detected after click' };
  }

  return { ...action, passed: true };
};

const main = async () => {
  mkdirSync(artifactDir, { recursive: true });
  applySeed();

  const { chrome } = await launchChrome();
  const client = new CdpClient(chrome);
  const results = [];

  try {
    await client.send('Browser.getVersion');
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Network.enable', {}, sessionId);
    await client.send('Page.enable', {}, sessionId);

    for (const action of actions) {
      results.push(await runAction(client, sessionId, action));
    }
  } finally {
    client.close();
  }

  const failed = results.filter((result) => !result.passed);
  const output = {
    generatedAt: new Date().toISOString(),
    dataSource: 'Java',
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    artifactPath,
    passed: output.passed,
    failed: output.failed,
    failures: failed.map((result) => ({ action: result.action, failure: result.failure })),
  }, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
