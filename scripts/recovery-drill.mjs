import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync, openSync, closeSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseOptions, runLoadtest } from './loadtest.mjs';

export function validateTarget({ database, bucket }) {
  assert.match(database ?? '', /^drill_[0-9]{6,20}$/);
  assert.match(bucket ?? '', /^24bid-drill-[0-9]{6,20}$/);
}
export function compareRows(expected, actual) {
  assert.equal(actual.length, expected.length, 'Recovery table count differs');
  assert.equal(new Set(actual.map(row => row.name)).size, actual.length);
  for (const old of expected) {
    const row = actual.find(item => item.name === old.name);
    assert.ok(row && row.rows === old.rows && row.digest === old.digest, 'Restored table fingerprint differs');
  }
}
export function checkedObjectPath(key) {
  assert.equal(typeof key, 'string');
  assert.ok(key && !key.includes('\\') && !key.includes('\0') && !key.startsWith('/')
    && key.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe object key');
  return key;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export async function recoveryDrill(env = process.env) {
  assert.equal(env.DRILL_AUTHORIZED, 'true', 'Explicit recovery drill authorization is required');
  assert.ok(env.DRILL_REPORT && !existsSync(env.DRILL_REPORT), 'A new report path is required');
  assert.ok(env.DRILL_SMOKE_ACCOUNT && env.DRILL_SMOKE_PASSWORD && env.DRILL_SMOKE_TENANT, 'Restored buyer credentials and tenant are required');
  if (env.DRILL_PLATFORM_ACCOUNT) assert.ok(env.DRILL_PLATFORM_PASSWORD, 'Restored platform credentials are required');
  const stamp = String(Date.now()), database = `drill_${stamp}`, bucket = `24bid-drill-${stamp}`;
  validateTarget({ database, bucket });
  const backup = JSON.parse(readFileSync(env.DRILL_BACKUP_MANIFEST));
  assert.equal(backup.database, 'procurement_saas_base');
  const before = JSON.parse(readFileSync(join(backup.root, 'fingerprints.json')));
  const dump = readFileSync(join(backup.root, 'database.dump'));
  assert.equal(sha(dump), backup.dumpSha256);
  const objects = JSON.parse(readFileSync(join(backup.root, 'objects.json')));
  assert.equal(objects.length, backup.objects);
  const container = env.DRILL_DB_CONTAINER;
  assert.match(container ?? '', /^[a-zA-Z0-9_-]+$/);
  assert.notEqual(container, 'procurement-saas-postgres');
  const sourceRelease = JSON.parse(readFileSync(join(env.DRILL_RELEASE_ROOT, 'runtime.json')));
  const jar = realpathSync(env.DRILL_JAR);
  assert.ok(env.DRILL_EXPECTED_JAR_SHA256, 'Final artifact checksum is required');
  assert.equal(sha(readFileSync(jar)), env.DRILL_EXPECTED_JAR_SHA256);
  const port = Number(env.DRILL_API_PORT || 8096);
  assert.ok(Number.isInteger(port) && port >= 8096 && port <= 8099);
  try {
    const found = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
    assert.equal(found, '', 'Drill API port occupied');
  } catch (error) { if (error.status !== 1) throw error; }
  const containerEnvironment = JSON.parse(execFileSync('docker', ['inspect', container, '--format', '{{json .Config.Env}}'], { encoding: 'utf8' }));
  const password = containerEnvironment.find(v => v.startsWith('POSTGRES_PASSWORD='))?.slice(18);
  assert.ok(password, 'Missing isolated database credentials');
  const mapped = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim().split('\n')[0];
  const dbPort = Number(mapped.split(':').at(-1));
  assert.ok(dbPort > 1024 && dbPort !== 5432, 'Use a separately published drill database');
  const sql = query => JSON.parse(execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'procurement', '-d', database],
    { input: `begin isolation level repeatable read read only;${query};commit;`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim());
  const mc = (command, input) => execFileSync('docker', ['exec', '-i', '24bid-minio', 'sh', '-c',
    'export MC_HOST_drill="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; ' + command],
    { input, maxBuffer: 128 * 1024 * 1024 });
  const fingerprints = () => sql('select json_agg(t) from (' + before.tables.map(table =>
    `select ${literal(table)} name,count(*)::int rows,md5(coalesce(string_agg(md5(row_to_json(r)::text),'' order by md5(row_to_json(r)::text)),'')) digest from (select ${before.columns[table].map(quote).join(',')} from public.${quote(table)}) r`).join(' union all ') + ') t');
  const report = { passed: false, database, bucket, backup: backup.root, jarSha256: env.DRILL_EXPECTED_JAR_SHA256,
    startedAt: new Date().toISOString(), restoredObjects: [], checks: [], scope: 'Isolated local recovery, not a customer RTO/RPO commitment' };
  const started = performance.now(); let child, log;
  try {
    // createdb and mb intentionally fail on existing destinations. Never drop/clean an old target.
    execFileSync('docker', ['exec', container, 'createdb', '-U', 'procurement', database]);
    execFileSync('docker', ['exec', '-i', container, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-U', 'procurement', '-d', database], { input: dump });
    compareRows(before.rows, fingerprints()); report.checks.push('restored database fingerprints');
    mc('mc mb ' + shellQuote('drill/' + bucket));
    const attachmentRoot = realpathSync(join(backup.root, 'attachments'));
    for (const object of objects) {
      const key = checkedObjectPath(object.key), path = realpathSync(join(attachmentRoot, key));
      assert.ok(path.startsWith(attachmentRoot + sep));
      const bytes = readFileSync(path); assert.equal(bytes.length, object.size);
      if (!object.etag.includes('-')) assert.equal(createHash('md5').update(bytes).digest('hex'), object.etag);
      const target = shellQuote(`drill/${bucket}/${key}`);
      mc('mc pipe ' + target, bytes);
      assert.equal(sha(mc('mc cat ' + target)), sha(bytes));
      report.restoredObjects.push({ key, sha256: sha(bytes), bytes: bytes.length });
    }
    const restoredInventory = mc('mc ls --recursive --json ' + shellQuote('drill/' + bucket)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.equal(restoredInventory.length, objects.length); report.checks.push('all object originals restored and SHA256 matched');
    const logPath = `/tmp/24bid-${database}.log`; log = openSync(logPath, 'wx', 0o600);
    const processEnv = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG'].filter(k => env[k]).map(k => [k, env[k]]));
    child = spawn('/opt/homebrew/opt/openjdk@21/bin/java', ['-Xmx512m', '-jar', jar], {
      env: { ...processEnv, ...sourceRelease.env, DB_URL: `jdbc:postgresql://127.0.0.1:${dbPort}/${database}`, DB_USERNAME: 'procurement', DB_PASSWORD: password,
        SERVER_ADDRESS: '127.0.0.1', SERVER_PORT: String(port), APP_SEED_LOCATIONS: '', MINIO_BUCKET: bucket,
        SPRING_PROFILES_ACTIVE: 'drill', PROCUREMENT_AI_ENABLED: 'false', LUDONG_AI_REVIEW_ENDPOINT: '', LUDONG_AI_REVIEW_API_KEY: '',
        APP_SUPPLIER_QUALIFICATIONREMINDERS_ENABLED: 'false', SPRING_MAIL_HOST: '',
        SPRING_FLYWAY_CLEAN_DISABLED: 'true', SPRING_FLYWAY_BASELINE_ON_MIGRATE: 'false', SPRING_FLYWAY_OUT_OF_ORDER: 'false' }, stdio: ['ignore', log, log] });
    let healthy = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error('Restored application exited before ready');
      try { const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(1500) }); if (res.ok) { healthy = true; break; } } catch {}
      await new Promise(done => setTimeout(done, 1000));
    }
    assert.ok(healthy); report.checks.push('restored application healthy');
    assert.ok(env.DRILL_SMOKE_ACCOUNT && env.DRILL_SMOKE_PASSWORD);
    const login = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: env.DRILL_SMOKE_ACCOUNT, password: env.DRILL_SMOKE_PASSWORD, scope: 'BUYER', tenantId: env.DRILL_SMOKE_TENANT }) });
    const payload = await login.json(); assert.ok(login.ok && payload.success && payload.data?.accessToken);
    for (const endpoint of ['demands', 'orders', 'suppliers']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/buyer/${endpoint}`, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${payload.data.accessToken}` } });
      const value = await response.json(); assert.ok(response.ok && value.success); report.checks.push('restored authorized ' + endpoint);
    }
    if (env.DRILL_PLATFORM_ACCOUNT) {
      const auth = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: env.DRILL_PLATFORM_ACCOUNT, password: env.DRILL_PLATFORM_PASSWORD, scope: 'PLATFORM' }) });
      const platform = await auth.json(); assert.ok(auth.ok && platform.success && platform.data?.accessToken);
      const media = sql('select coalesce(json_agg(t),\'[]\'::json) from (select id,product_id,storage_key from mall_product_media order by id) t');
      const file = media.find(item => report.restoredObjects.some(o => o.key === item.storage_key));
      if (!file) {
        report.coverageGaps = ['Restored mall media metadata has no backed-up object reference; application-level media download not exercised. All original objects were authenticated-read from the restored bucket and SHA256 checked.'];
      } else {
      const download = await fetch(`http://127.0.0.1:${port}/api/v1/platform/mall/products/${encodeURIComponent(file.product_id)}/media/${encodeURIComponent(file.id)}/content`,
        { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${platform.data.accessToken}` } });
      assert.ok(download.ok, 'Restored authenticated attachment download failed');
      const bytes = Buffer.from(await download.arrayBuffer());
      assert.equal(sha(bytes), report.restoredObjects.find(o => o.key === file.storage_key).sha256);
      report.checks.push('restored authenticated HTTP attachment bytes match backup');
      }
    }
    if (env.DRILL_LOAD_REQUESTS) {
      report.capacity = await runLoadtest(parseOptions([env.DRILL_LOAD_REQUESTS, env.DRILL_LOAD_CONCURRENCY || '4'],
        { ...env, LOADTEST_AUTHORIZED: 'true', LOADTEST_BASE_URL: `http://127.0.0.1:${port}`, LOADTEST_TOKEN: payload.data.accessToken }));
      assert.ok(report.capacity.passed, 'Isolated capacity thresholds not met');
      report.checks.push('isolated read-only capacity thresholds');
    }
    compareRows(before.rows, fingerprints()); report.checks.push('all restored rows unchanged after startup and reads');
    report.passed = true;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await new Promise(done => child.once('exit', done)); }
    if (log !== undefined) closeSync(log);
    report.finishedAt = new Date().toISOString(); report.durationSeconds = (performance.now() - started) / 1000;
    report.retainedTargets = true;
    writeFileSync(env.DRILL_REPORT, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await recoveryDrill())); } catch { console.error('Recovery drill failed; inspect the restricted report and log. Original targets were not selected.'); process.exitCode = 1; }
}
