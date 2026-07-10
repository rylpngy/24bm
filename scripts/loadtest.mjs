// 轻量压测基线:登录取 token,对关键只读端点并发打流,统计 p50/p95/p99/吞吐/错误。
// 用法:node scripts/loadtest.mjs [总请求数=500] [并发=20] [baseURL=http://localhost:8080]
const TOTAL = Number(process.argv[2] || 500);
const CONCURRENCY = Number(process.argv[3] || 20);
const BASE = process.argv[4] || 'http://localhost:8080';

const ENDPOINTS = [
  '/api/v1/buyer/suppliers',
  '/api/v1/buyer/demands',
  '/api/v1/buyer/rfqs',
  '/api/v1/buyer/orders',
  '/api/v1/buyer/workspace',
  '/api/v1/buyer/budgets',
  '/api/v1/buyer/supplier-invitations',
];

async function login() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: 'buyer.owner@example.com',
      password: 'demo123456',
      scope: 'BUYER',
      tenantId: 'tenant-acme',
    }),
  });
  const body = await res.json();
  if (!body?.data?.accessToken) throw new Error('登录失败:' + JSON.stringify(body));
  return body.data.accessToken;
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function main() {
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };
  const latencies = [];
  let errors = 0;
  let next = 0;

  const started = performance.now();
  async function worker() {
    while (next < TOTAL) {
      const i = next++;
      const url = BASE + ENDPOINTS[i % ENDPOINTS.length];
      const t0 = performance.now();
      try {
        const r = await fetch(url, { headers });
        await r.arrayBuffer();
        if (!r.ok) errors++;
      } catch {
        errors++;
      }
      latencies.push(performance.now() - t0);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const elapsed = (performance.now() - started) / 1000;

  latencies.sort((a, b) => a - b);
  const r = (x) => Math.round(x);
  console.log('=== 24Bid 压测基线 ===');
  console.log(`目标: ${BASE} · 端点 ${ENDPOINTS.length} 个 · 请求 ${TOTAL} · 并发 ${CONCURRENCY}`);
  console.log(`吞吐: ${(TOTAL / elapsed).toFixed(1)} req/s · 耗时 ${elapsed.toFixed(2)}s · 错误 ${errors}`);
  console.log(`延迟(ms): p50=${r(pct(latencies, 50))} p95=${r(pct(latencies, 95))} p99=${r(pct(latencies, 99))} max=${r(latencies[latencies.length - 1])}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
