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

  for (const suite of suites) {
    const token = await getToken(suite.username);
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

  console.log(JSON.stringify({ ok: true, keycloak: `${KEYCLOAK_URL}/realms/${REALM}`, api: JAVA_API_BASE_URL, summary }, null, 2));
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
