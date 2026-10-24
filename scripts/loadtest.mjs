import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

// Explicit environment authorization; no implicit demo login or default server.
export function parseOptions(args = process.argv.slice(2), env = process.env) {
  if (env.LOADTEST_AUTHORIZED !== 'true') throw new Error('Set LOADTEST_AUTHORIZED=true for the authorized target');
  const base = new URL(env.LOADTEST_BASE_URL || '');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
      || base.pathname !== '/') throw new Error('LOADTEST_BASE_URL must be a bare HTTP(S) origin');
  if (!env.LOADTEST_TOKEN?.trim()) throw new Error('LOADTEST_TOKEN is required');
  const integer = (value, max) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) throw new Error('Invalid bounded positive integer');
    return n;
  };
  const total = integer(args[0] || 500, 100000);
  const concurrency = integer(args[1] || 20, 100);
  const timeoutMs = integer(env.LOADTEST_TIMEOUT_MS || 10000, 120000);
  const maxP95Ms = integer(env.LOADTEST_MAX_P95_MS || 1500, 120000);
  const maxErrorRate = Number(env.LOADTEST_MAX_ERROR_RATE || 0);
  if (!Number.isFinite(maxErrorRate) || maxErrorRate < 0 || maxErrorRate > 1) throw new Error('Invalid error-rate threshold');
  return { base: base.origin, token: env.LOADTEST_TOKEN.trim(), total, concurrency, timeoutMs, maxP95Ms, maxErrorRate };
}

const ENDPOINTS = [
  '/api/v1/buyer/suppliers',
  '/api/v1/buyer/demands',
  '/api/v1/buyer/rfqs',
  '/api/v1/buyer/orders',
  '/api/v1/buyer/workspace',
  '/api/v1/buyer/budgets',
  '/api/v1/buyer/supplier-invitations',
];

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

export async function runLoadtest(options, request = fetch) {
  const { base, token, total, concurrency, timeoutMs, maxP95Ms, maxErrorRate } = options;
  const headers = { Authorization: `Bearer ${token}` };
  const latencies = [];
  const groups = new Map(ENDPOINTS.map(path => [path, { path, requests: 0, errors: 0, latencies: [] }]));
  let errors = 0;
  let next = 0;

  const started = performance.now();
  async function worker() {
    while (next < total) {
      const i = next++;
      const path = ENDPOINTS[i % ENDPOINTS.length];
      const group = groups.get(path); group.requests++;
      const url = base + path;
      const t0 = performance.now();
      let failed = false;
      try {
        const r = await request(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
        const payload = await r.json();
        failed = !r.ok || payload?.success !== true;
      } catch {
        failed = true;
      }
      if (failed) { errors++; group.errors++; }
      const elapsed = performance.now() - t0;
      latencies.push(elapsed); group.latencies.push(elapsed);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  const elapsed = (performance.now() - started) / 1000;

  latencies.sort((a, b) => a - b);
  const endpoints = [...groups.values()].filter(g => g.requests).map(g => ({ path: g.path, requests: g.requests,
    errors: g.errors, p95Ms: pct(g.latencies.sort((a, b) => a - b), 95) }));
  const passed = errors / total <= maxErrorRate && pct(latencies, 95) <= maxP95Ms
    && endpoints.every(g => g.errors / g.requests <= maxErrorRate && g.p95Ms <= maxP95Ms);
  return { passed, base, total, concurrency, timeoutMs, errors, errorRate: errors / total,
    thresholds: { maxP95Ms, maxErrorRate }, durationSeconds: elapsed, requestsPerSecond: total / elapsed,
    p50Ms: pct(latencies, 50), p95Ms: pct(latencies, 95), p99Ms: pct(latencies, 99), endpoints,
    generatedAt: new Date().toISOString(), scope: 'Read-only local measurement; not a production capacity guarantee' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runLoadtest(parseOptions());
    if (process.env.LOADTEST_REPORT) writeFileSync(process.env.LOADTEST_REPORT, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch {
    console.error('Load test failed: check authorization, target, token, limits and report destination. No credentials logged.');
    process.exitCode = 1;
  }
}
