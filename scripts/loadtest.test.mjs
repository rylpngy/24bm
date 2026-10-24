import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, runLoadtest } from './loadtest.mjs';

const env = { LOADTEST_AUTHORIZED: 'true', LOADTEST_BASE_URL: 'http://127.0.0.1:8095', LOADTEST_TOKEN: 'test-token' };
test('requires explicit authorization, target and token before any request', () => {
  for (const key of Object.keys(env)) assert.throws(() => parseOptions([], { ...env, [key]: '' }));
  for (const value of ['0', '-1', 'NaN', '1.5', '100001']) assert.throws(() => parseOptions([value], env));
  for (const value of ['http://u:password@example.com', 'http://example.com/?token=secret', 'file:///tmp']) {
    assert.throws(() => parseOptions([], { ...env, LOADTEST_BASE_URL: value }));
  }
});
test('counts business errors and HTTP errors, never redirects tokens, aggregates endpoints', async () => {
  const options = parseOptions(['7', '1'], env);
  let calls = 0;
  const report = await runLoadtest(options, async (url, init) => {
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    calls++;
    return new Response(JSON.stringify({ success: calls !== 2 }), { status: calls === 3 ? 403 : 200 });
  });
  assert.equal(calls, 7); assert.equal(report.errors, 2); assert.equal(report.passed, false);
  assert.equal(report.endpoints.length, 7);
  assert.ok(!JSON.stringify(report).includes('test-token'));
});
test('fails malformed payloads and transport errors, passes real success envelopes', async () => {
  const options = parseOptions(['2', '1'], env);
  const good = await runLoadtest(options, async () => new Response('{"success":true,"data":[]}'));
  assert.equal(good.passed, true);
  const bad = await runLoadtest(options, async () => new Response('<html>gateway</html>'));
  assert.equal(bad.errors, 2);
  const unavailable = await runLoadtest(options, async () => { throw new Error('token-sensitive-error'); });
  assert.equal(unavailable.errors, 2); assert.ok(!JSON.stringify(unavailable).includes('token-sensitive-error'));
});
test('reports slow endpoint failures even without HTTP errors', async () => {
  const options = { ...parseOptions(['21', '1'], env), maxP95Ms: 1 };
  const report = await runLoadtest(options, async url => {
    if (url.endsWith('/workspace')) await new Promise(done => setTimeout(done, 10));
    return new Response('{"success":true}');
  });
  assert.equal(report.errors, 0); assert.equal(report.passed, false);
  assert.ok(report.endpoints.find(e => e.path.endsWith('/workspace')).p95Ms > 1);
});
