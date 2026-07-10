const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8081';
const JAVA_API_BASE_URL = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM ?? '24bid';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? '24bid-portal';
const PASSWORD = process.env.ACCEPTANCE_DEMO_PASSWORD ?? 'demo123456';

const users = {
  buyer: 'buyer.owner@example.com',
  requester: 'zhang.req@example.com',
  finance: 'li.fin@example.com',
  platform: 'platform.admin@example.com',
  supplier: 'supplier.sales@example.com',
};

const suites = [
  {
    actor: 'buyer-owner',
    username: users.buyer,
    claims: { authScope: 'BUYER', tenantId: 'tenant-acme', role: 'BUYER_OWNER' },
    expectedPermissions: ['buyer:*'],
    forbiddenPermissions: [],
    endpoints: [
      ['/api/v1/buyer/workspace', 'buyer workspace'],
      ['/api/v1/buyer/roles/my-permissions', 'buyer permissions'],
      ['/api/v1/buyer/demands', 'buyer demands'],
      ['/api/v1/buyer/rfqs', 'buyer RFQs'],
      ['/api/v1/buyer/orders', 'buyer orders'],
      ['/api/v1/buyer/invoices', 'buyer invoices'],
      ['/api/v1/buyer/contracts', 'buyer contracts'],
      ['/api/v1/buyer/payment-batches', 'buyer payment batches'],
      ['/api/v1/buyer/payment-execution-records', 'buyer payment execution records'],
      ['/api/v1/buyer/budgets', 'buyer department budgets'],
    ],
  },
  {
    actor: 'buyer-requester',
    username: users.requester,
    claims: { authScope: 'BUYER', tenantId: 'tenant-acme', role: 'BUYER_REQUESTER' },
    expectedPermissions: ['buyer:demand:read', 'buyer:rfq:read', 'buyer:material:read'],
    forbiddenPermissions: ['buyer:contract:read', 'buyer:payment:register'],
    endpoints: [
      ['/api/v1/buyer/workspace', 'requester workspace'],
      ['/api/v1/buyer/roles/my-permissions', 'requester permissions'],
      ['/api/v1/buyer/demands', 'requester scoped demands'],
      ['/api/v1/buyer/rfqs', 'requester scoped RFQs'],
      ['/api/v1/buyer/materials', 'requester materials'],
    ],
  },
  {
    actor: 'buyer-finance',
    username: users.finance,
    claims: { authScope: 'BUYER', tenantId: 'tenant-acme', role: 'BUYER_FINANCE' },
    expectedPermissions: ['buyer:invoice:read', 'buyer:payment:register', 'buyer:contract:read'],
    forbiddenPermissions: ['buyer:demand:create', 'buyer:role:manage'],
    endpoints: [
      ['/api/v1/buyer/workspace', 'finance workspace'],
      ['/api/v1/buyer/roles/my-permissions', 'finance permissions'],
      ['/api/v1/buyer/invoices', 'finance invoices'],
      ['/api/v1/buyer/contracts', 'finance contracts'],
      ['/api/v1/buyer/payment-batches', 'finance payment batches'],
      ['/api/v1/buyer/payment-execution-records', 'finance payment execution records'],
      ['/api/v1/buyer/payment-block-resolutions', 'finance block resolutions'],
      ['/api/v1/buyer/variance-handlings', 'finance variance handlings'],
      ['/api/v1/buyer/payment-archive-exception-requests', 'finance archive exceptions'],
    ],
  },
  {
    actor: 'platform',
    username: users.platform,
    claims: { authScope: 'PLATFORM', role: 'PLATFORM_ADMIN' },
    endpoints: [
      ['/api/v1/platform/workspace', 'platform workspace'],
      ['/api/v1/platform/tenants', 'platform tenants'],
      ['/api/v1/platform/enterprise-reviews', 'platform enterprise reviews'],
      ['/api/v1/platform/announcements', 'platform announcements'],
    ],
  },
  {
    actor: 'supplier',
    username: users.supplier,
    claims: { authScope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise', role: 'SUPPLIER_SALES' },
    endpoints: [
      ['/api/v1/supplier/workspace', 'supplier workspace'],
      ['/api/v1/supplier/rfqs', 'supplier RFQs'],
      ['/api/v1/supplier/quotes', 'supplier quotes'],
      ['/api/v1/supplier/orders', 'supplier orders'],
      ['/api/v1/supplier/invoices', 'supplier invoices'],
      ['/api/v1/supplier/profile', 'supplier profile'],
    ],
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeJwtPayload(token) {
  const [, encodedPayload] = token.split('.');
  assert(encodedPayload, 'Keycloak token is not a JWT');
  const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(normalized, 'base64url').toString('utf8'));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${url} -> ${response.status}: ${text}`);
  }

  return body;
}

async function getToken(username) {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username,
    password: PASSWORD,
  });

  const token = await fetchJson(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  assert(token.access_token, `No access token returned for ${username}`);
  return token.access_token;
}

async function getApi(path, token) {
  const body = await fetchJson(`${JAVA_API_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert(body && body.success === true, `${path} did not return success=true`);
  return body.data;
}

async function sendApi(method, path, token, payload) {
  const body = await fetchJson(`${JAVA_API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  assert(body && body.success === true, `${method} ${path} did not return success=true`);
  return body.data;
}

// 业务守卫负向断言:期望 4xx + 指定错误信息,且不产生任何状态变更。
async function expectApiRejection(method, path, token, payload, messagePart, label) {
  const response = await fetch(`${JAVA_API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  assert(
    response.status >= 400 && response.status < 500,
    `${label}: expected 4xx rejection but got ${response.status}: ${text}`,
  );
  assert(
    text.includes(messagePart),
    `${label}: rejection message should mention "${messagePart}" but got: ${text}`,
  );
}

// Track B 财务/合同链写路径验收:
// 1) 未审批批次禁止登记放款(带证据 body 也被同一守卫拦截);
// 2) 批次提交审批可推进并可回退(循环,可重复执行);
// 3) 合同里程碑乱序支付被拒;
// 4) 部门预算暴露实付(disbursed)口径。
async function runTrackBAcceptance(tokens) {
  const finance = tokens.finance;
  const owner = tokens.buyer;
  const checks = [];

  const batches = await getApi('/api/v1/buyer/payment-batches', finance);
  const executionRecords = await getApi('/api/v1/buyer/payment-execution-records', finance);
  const batchByNo = new Map(batches.map((batch) => [batch.paymentBatchNo, batch]));

  const blockedRegistration = executionRecords.find((record) => {
    const batch = record.paymentBatchNo ? batchByNo.get(record.paymentBatchNo) : undefined;
    return record.executionStatus === '待登记付款' && batch && batch.batchStatus !== '可安排付款';
  });
  if (blockedRegistration) {
    await expectApiRejection(
      'POST',
      `/api/v1/buyer/payment-execution-records/${blockedRegistration.id}/registration`,
      finance,
      {
        paymentStatus: '已付款',
        releaseEvidenceNo: 'ACCEPTANCE-EVIDENCE-001',
        releaseRemark: '验收脚本注入的放款证据(应被批次审批守卫拦截)',
      },
      'must be approved before payment execution registration',
      'unapproved batch registration guard',
    );
    checks.push('registration-requires-approved-batch');
  }

  const restingBatch = batches.find(
    (batch) => !['审批中', '可安排付款', '已付款归档'].includes(batch.batchStatus),
  );
  if (restingBatch) {
    const originalStatus = restingBatch.batchStatus;
    const submitted = await sendApi(
      'PUT',
      `/api/v1/buyer/payment-batches/${restingBatch.paymentBatchNo}/status`,
      finance,
      { batchStatus: '审批中' },
    );
    assert(
      submitted.batchStatus === '审批中',
      `payment batch submit should move to 审批中, got ${submitted.batchStatus}`,
    );
    const reverted = await sendApi(
      'PUT',
      `/api/v1/buyer/payment-batches/${restingBatch.paymentBatchNo}/status`,
      finance,
      { batchStatus: originalStatus },
    );
    assert(
      reverted.batchStatus === originalStatus,
      `payment batch should revert to ${originalStatus}, got ${reverted.batchStatus}`,
    );
    checks.push('payment-batch-status-roundtrip');
  }

  const contracts = await getApi('/api/v1/buyer/contracts', owner);
  for (const contract of contracts) {
    let milestones = await getApi(`/api/v1/buyer/contracts/${contract.id}/payment-milestones`, owner);
    if (milestones.length === 0) {
      milestones = await sendApi(
        'POST',
        `/api/v1/buyer/contracts/${contract.id}/payment-milestones/generate`,
        owner,
      );
    }
    const ordered = [...milestones].sort((a, b) => a.sortNo - b.sortNo);
    const firstUnpaidIndex = ordered.findIndex((milestone) => milestone.status !== '已付');
    const outOfOrderTarget = firstUnpaidIndex >= 0 ? ordered[firstUnpaidIndex + 1] : undefined;
    if (outOfOrderTarget) {
      await expectApiRejection(
        'POST',
        `/api/v1/buyer/contracts/${contract.id}/payment-milestones/${outOfOrderTarget.id}/pay`,
        owner,
        undefined,
        '须先按序支付前序里程碑',
        'milestone out-of-order pay guard',
      );
      checks.push('milestone-order-enforced');
      break;
    }
  }

  const budgets = await getApi('/api/v1/buyer/budgets', owner);
  assert(Array.isArray(budgets), 'buyer budgets is not an array');
  for (const budget of budgets) {
    assert(
      budget.disbursed === null || budget.disbursed === undefined || typeof budget.disbursed === 'number',
      `budget ${budget.id} disbursed should be numeric when present`,
    );
  }
  if (budgets.length > 0) {
    checks.push('budget-disbursed-exposed');
  }

  return checks;
}

function assertClaims(actor, claims, expected) {
  assert(claims.authScope === expected.authScope, `${actor} authScope mismatch: ${claims.authScope}`);
  if (expected.tenantId) {
    assert(claims.tenantId === expected.tenantId, `${actor} tenantId mismatch: ${claims.tenantId}`);
  }
  if (expected.supplierId) {
    assert(claims.supplierId === expected.supplierId, `${actor} supplierId mismatch: ${claims.supplierId}`);
  }
  assert(Array.isArray(claims.roles), `${actor} roles claim is missing`);
  assert(claims.roles.includes(expected.role), `${actor} roles missing ${expected.role}`);
}

async function run() {
  const discovery = await fetchJson(`${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid-configuration`);
  assert(discovery.issuer === `${KEYCLOAK_URL}/realms/${REALM}`, 'Keycloak issuer mismatch');

  const health = await fetchJson(`${JAVA_API_BASE_URL}/api/v1/health`);
  assert(health.success === true && health.data?.status === 'ok', 'Backend health check failed');

  const summary = [];
  const tokens = {};

  for (const suite of suites) {
    const token = await getToken(suite.username);
    tokens[suite.actor === 'buyer-owner' ? 'buyer' : suite.actor === 'buyer-finance' ? 'finance' : suite.actor] = token;
    const claims = decodeJwtPayload(token);
    assertClaims(suite.actor, claims, suite.claims);

    const endpoints = [];
    for (const [path, label] of suite.endpoints) {
      const data = await getApi(path, token);
      endpoints.push({
        path,
        label,
        shape: Array.isArray(data) ? `array:${data.length}` : typeof data,
      });
    }

    if (suite.actor.startsWith('buyer-')) {
      const permissions = await getApi('/api/v1/buyer/roles/my-permissions', token);
      const granted = permissions?.permissions ?? [];
      assert(Array.isArray(granted), `${suite.actor} permissions is not an array`);
      for (const required of suite.expectedPermissions ?? []) {
        assert(granted.includes(required), `${suite.actor} permissions missing ${required}`);
      }
      for (const forbidden of suite.forbiddenPermissions ?? []) {
        assert(!granted.includes(forbidden), `${suite.actor} permissions unexpectedly include ${forbidden}`);
      }
    }

    if (suite.actor === 'buyer-requester') {
      const demands = await getApi('/api/v1/buyer/demands', token);
      assert(Array.isArray(demands), 'buyer-requester demands is not an array');
      assert(demands.length > 0, 'buyer-requester scoped demands should not be empty');
      assert(
        demands.every((demand) => demand.departmentId === 'dept-it'),
        'buyer-requester should only see dept-it demands',
      );
      assert(
        demands.every((demand) => demand.departmentId !== 'dept-finance'),
        'buyer-requester should not see finance department demands',
      );
    }

    summary.push({ actor: suite.actor, username: suite.username, endpoints });
  }

  const trackBChecks = await runTrackBAcceptance(tokens);
  assert(
    trackBChecks.includes('registration-requires-approved-batch'),
    'Track B acceptance did not find an unapproved batch with pending registration; reseed demo data',
  );
  assert(
    trackBChecks.includes('milestone-order-enforced'),
    'Track B acceptance did not find a contract milestone chain to verify ordering; reseed demo data',
  );

  console.log(JSON.stringify({ ok: true, keycloak: `${KEYCLOAK_URL}/realms/${REALM}`, api: JAVA_API_BASE_URL, summary, trackB: trackBChecks }, null, 2));
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
