import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.ludong-tender-runtime');
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const secretsPath = resolve(runtime, 'secrets.json');
if (!existsSync(secretsPath)) writeFileSync(secretsPath, JSON.stringify({
  POC_DB_PASSWORD: randomBytes(24).toString('hex'),
  POC_STORAGE_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(48).toString('hex'),
}), { mode: 0o600, flag: 'wx' });
const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
const modelPath = resolve(runtime, 'contract-model.json');
const modelConfig = existsSync(modelPath) ? JSON.parse(readFileSync(modelPath, 'utf8')) : {};
const modelKeys = ['CONTRACT_REVIEW_MODEL_ENABLED','CONTRACT_REVIEW_MODEL_ENDPOINT','CONTRACT_REVIEW_MODEL_API_KEY','CONTRACT_REVIEW_MODEL_NAME'];
const contractModel = Object.fromEntries(modelKeys.filter(key => typeof modelConfig[key] === 'string').map(key => [key,modelConfig[key]]));
const javaHome = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21';
const env = {
  ...process.env, ...secrets, ...contractModel, JAVA_HOME: javaHome,
  PATH: `${javaHome}/bin:${process.env.PATH}`,
  SERVER_PORT: '8098', SERVER_ADDRESS: '127.0.0.1',
  DB_URL: 'jdbc:postgresql://127.0.0.1:26432/ludong_tender_poc',
  DB_USERNAME: 'ludong_poc', DB_PASSWORD: secrets.POC_DB_PASSWORD,
  MINIO_ENDPOINT: 'http://127.0.0.1:29000', MINIO_ACCESS_KEY: 'ludong-tender-poc',
  MINIO_SECRET_KEY: secrets.POC_STORAGE_PASSWORD, MINIO_BUCKET: 'ludong-tender-attachments',
  APP_SEED_LOCATIONS: 'classpath:db/poc/ludong,classpath:db/poc/ludong-tender',
  APP_WORKFLOW_DEADLINES_ENABLED: 'true', APP_WORKFLOW_DEADLINES_INTERVAL_MS: '10000',
  APP_RFQ_QUOTATION_EXTENSIONS_ENABLED: 'true', APP_RFQ_QUOTATION_EXTENSIONS_INTERVAL_MS: '10000',
  SELF_LOGIN_ENABLED: 'true', KEYCLOAK_ENABLED: 'false', TENANT_HEADER_FALLBACK_ENABLED: 'false',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5288,http://127.0.0.1:5289',
  DEV_API_PROXY_TARGET: 'http://127.0.0.1:8098',
  VITE_JAVA_API_BASE_URL: '', VITE_SELF_LOGIN: 'true', VITE_KEYCLOAK_URL: '', VITE_KEYCLOAK_ENABLED: 'false',
  VITE_PORTAL_URL: 'http://127.0.0.1:5288/?solution=ludong-poc',
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.error?.message ?? ''}`);
}
function compose(args) {
  run('docker', ['compose', '-f', resolve(root, 'infra/ludong-tender-poc/compose.yml'), ...args]);
}
async function waitFor(url, timeout = 120000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Not ready: ${url}; inspect ${runtime}`);
}
async function waitForPocLogin() {
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    try {
      const response = await fetch('http://127.0.0.1:8098/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(3000),
        body: JSON.stringify({ account: 'LDU000001', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-ludong-poc' }),
      });
      if (response.ok && (await response.json()).data?.tenantId === 'tenant-ludong-poc') return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('POC login is not ready; inspect seed migration logs. Original data must not be reset.');
}
async function requireFree(port) {
  const net = await import('node:net');
  await new Promise((resolveReady, reject) => {
    const probe = net.createServer();
    probe.on('error', () => reject(new Error(`Port ${port} is occupied; nothing was stopped`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolveReady));
  });
}
function launch(name, command, args, cwd = root) {
  const log = openSync(resolve(runtime, `${name}.log`), 'a', 0o600);
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', log, log] });
  child.unref(); closeSync(log);
  child.on('error', (error) => console.error(`${name}: ${error.message}`));
  writeFileSync(resolve(runtime, `${name}.json`), JSON.stringify({ pid: child.pid, command, args, cwd }));
}
function freezeBackend() {
  const directory = resolve(runtime, 'releases');
  mkdirSync(directory, { recursive: true });
  const snapshot = resolve(directory, `backend-${Date.now()}.jar`);
  copyFileSync(resolve(root, 'backend-java/target/procurement-saas-backend-0.1.0-SNAPSHOT.jar'), snapshot);
  return snapshot;
}
const command = process.argv[2] || 'status';
if (command === 'prepare') {
  compose(['up', '-d', '--wait', 'postgres', 'minio']);
  run('pnpm', ['install', '--offline', '--frozen-lockfile']);
  run('mvn', ['-q', '-DskipTests', 'package'], resolve(root, 'backend-java'));
} else if (command === 'start') {
  for (const port of [8098, 5288, 5289]) await requireFree(port);
  compose(['up', '-d', '--wait', 'postgres', 'minio']);
  launch('backend', resolve(javaHome, 'bin/java'), ['-Xmx768m', '-jar', freezeBackend()]);
  await waitFor('http://127.0.0.1:8098/api/v1/health');
  await waitForPocLogin();
  for (const [name, directory, port] of [
    ['buyer', 'tenant-portal', '5288'], ['supplier', 'supplier-portal', '5289'],
  ]) {
    launch(name, 'pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], resolve(root, 'apps', directory));
    await waitFor(`http://127.0.0.1:${port}/`);
  }
  console.log('Buyer: http://127.0.0.1:5288/?solution=ludong-poc');
  console.log('Supplier: http://127.0.0.1:5289/');
} else if (command === 'restart-portals') {
  for (const [name, directory, port] of [['buyer', 'tenant-portal', '5288'], ['supplier', 'supplier-portal', '5289']]) {
    const state = JSON.parse(readFileSync(resolve(runtime, `${name}.json`), 'utf8'));
    const actual = spawnSync('ps', ['-p', String(state.pid), '-o', 'command='], { encoding: 'utf8' }).stdout || '';
    const expectedCwd = resolve(root, 'apps', directory);
    const actualCwd = spawnSync('lsof', ['-a', '-p', String(state.pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout || '';
    if (!actual.includes('vite') || state.cwd !== expectedCwd || !actualCwd.includes(expectedCwd)) {
      throw new Error(`Refusing to restart unrecognized ${name} process`);
    }
    process.kill(-state.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await requireFree(Number(port)); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    await requireFree(Number(port));
    launch(name, 'pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], expectedCwd);
    await waitFor(`http://127.0.0.1:${port}/`);
  }
} else if (command === 'restart-backend') {
  const state = JSON.parse(readFileSync(resolve(runtime, 'backend.json'), 'utf8'));
  const actual = spawnSync('ps', ['-p', String(state.pid), '-o', 'command='], { encoding: 'utf8' }).stdout || '';
  const jar = state.args?.at(-1);
  const oldTarget = resolve(root, 'backend-java/target/procurement-saas-backend-0.1.0-SNAPSHOT.jar');
  if (!jar || (jar !== oldTarget && !jar.startsWith(resolve(runtime, 'releases') + '/')) || (actual.trim() && !actual.includes(jar))) {
    throw new Error('Backend PID does not match this POC worktree; refusing to stop it');
  }
  if (actual.trim()) process.kill(state.pid, 'SIGTERM');
  for (let attempt = 0; actual.trim() && attempt < 30; attempt++) {
    try { process.kill(state.pid, 0); } catch { break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await requireFree(8098);
  launch('backend', resolve(javaHome, 'bin/java'), ['-Xmx768m', '-jar', freezeBackend()]);
  await waitFor('http://127.0.0.1:8098/api/v1/health');
  await waitForPocLogin();
  console.log('Only the isolated POC backend was restarted; existing data retained.');
} else if (command === 'status') {
  compose(['ps']);
  for (const port of [8098, 5288, 5289]) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/${port === 8098 ? 'api/v1/health' : ''}`, { signal: AbortSignal.timeout(3000) });
      console.log(`${port}: HTTP ${response.status}`);
    } catch { console.log(`${port}: unavailable`); }
  }
} else {
  throw new Error('Supported commands: prepare, start, restart-backend, restart-portals, status. No reset or data deletion is provided.');
}
