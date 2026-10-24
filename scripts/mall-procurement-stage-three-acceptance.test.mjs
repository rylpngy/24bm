import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig, validateBase, validateDatabase, validateHealth } from './mall-procurement-stage-three-acceptance.mjs';

// Pure guard tests only. These are not HTTP acceptance or substitutes for business evidence.
const config = () => ({ JAVA_API_BASE_URL: 'http://127.0.0.1:8095', ACCEPTANCE_LOCAL_WRITES: '1',
  ACCEPTANCE_STAGE_THREE_READY: '1', ACCEPTANCE_EXPECTED_DB: 'srm_acceptance_20261023',
  ACCEPTANCE_BACKEND_SHA256: 'a'.repeat(64), ACCEPTANCE_PASSWORD: 'test-only-value' });

test('accepts only the exact local 8095 origin', () => {
  assert.equal(validateBase('http://127.0.0.1:8095'), 'http://127.0.0.1:8095');
  for (const url of ['http://127.0.0.1:8080', 'http://localhost:8095', 'http://example.com:8095',
    'https://127.0.0.1:8095', 'http://127.0.0.1:8095/api/v1', 'http://user:secret@127.0.0.1:8095',
    'http://127.0.0.1:8095?target=8080', 'http://127.0.0.1:8095#8080']) {
    assert.throws(() => validateBase(url), /Only the exact/);
  }
});

test('rejects production databases, lookalikes, other hosts and connection overrides', () => {
  const expected = 'srm_acceptance_20261023';
  assert.equal(validateDatabase(`jdbc:postgresql://127.0.0.1:25432/${expected}`, expected), expected);
  for (const url of ['jdbc:postgresql://127.0.0.1:25432/procurement_saas_base',
    `jdbc:postgresql://127.0.0.1:25432/${expected}_other`, `jdbc:postgresql://db.example.com:25432/${expected}`,
    `jdbc:postgresql://127.0.0.1:5432/${expected}`, `jdbc:postgresql://127.0.0.1:25432/${expected}?currentSchema=other`,
    `jdbc:postgresql://secret@127.0.0.1:25432/${expected}`]) {
    assert.throws(() => validateDatabase(url, expected));
  }
  assert.throws(() => validateDatabase('jdbc:postgresql://127.0.0.1:25432/procurement_saas_base', 'procurement_saas_base'));
  assert.throws(() => validateDatabase('jdbc:postgresql://127.0.0.1:25432/srm_acceptance_', 'srm_acceptance_'));
});

test('requires the real health envelope, exact identity, fresh timestamp and sensible clock', () => {
  const now = Date.now();
  const payload = { success: true, data: { status: 'ok', service: 'procurement-saas-backend', time: new Date(now).toISOString() } };
  assert.equal(validateHealth(payload, now), now);
  for (const bad of [{ ...payload, success: false }, { ...payload, data: { ...payload.data, service: 'mock-backend' } },
    { ...payload, data: { ...payload.data, status: 'down' } },
    { ...payload, data: { ...payload.data, time: new Date(now - 60000).toISOString() } },
    { ...payload, data: { ...payload.data, time: 'invalid' } }]) {
    assert.throws(() => validateHealth(bad, now));
  }
});

test('configuration requires explicit stage-three readiness, write opt-in, expected JAR and credentials', () => {
  assert.equal(readConfig(config()).windowSeconds, 120);
  for (const key of ['ACCEPTANCE_LOCAL_WRITES', 'ACCEPTANCE_STAGE_THREE_READY',
    'ACCEPTANCE_BACKEND_SHA256', 'ACCEPTANCE_PASSWORD', 'ACCEPTANCE_EXPECTED_DB']) {
    const env = config(); delete env[key];
    assert.throws(() => readConfig(env));
  }
  for (const value of ['0', '-1', '59', '601', 'NaN']) {
    assert.throws(() => readConfig({ ...config(), ACCEPTANCE_WINDOW_SECONDS: value }));
  }
});
