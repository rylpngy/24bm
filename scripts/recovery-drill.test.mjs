import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTarget, compareRows, checkedObjectPath } from './recovery-drill.mjs';
test('refuses original, shared and malformed recovery destinations', () => {
  for (const target of [{ database: 'procurement_saas_base', bucket: '24bid-attachments' },
    { database: 'drill_1', bucket: '24bid-attachments' }, { database: 'drill_x;drop', bucket: '24bid-drill-1' }]) {
    assert.throws(() => validateTarget(target));
  }
  assert.doesNotThrow(() => validateTarget({ database: 'drill_179283', bucket: '24bid-drill-179283' }));
});
test('compares every table including migration history and rejects missing or extra rows', () => {
  const expected = [{ name: 'users', rows: 2, digest: 'abc' }];
  assert.doesNotThrow(() => compareRows(expected, [...expected]));
  for (const actual of [[], [{ name: 'users', rows: 1, digest: 'abc' }], [{ name: 'users', rows: 2, digest: 'bad' }], [...expected, ...expected]]) {
    assert.throws(() => compareRows(expected, actual));
  }
});
test('rejects object traversal before storage access', () => {
  for (const key of ['../secret', '/secret', 'a/../../secret', 'a\\..\\secret', 'a//b']) assert.throws(() => checkedObjectPath(key));
  assert.equal(checkedObjectPath('tenant/files/evidence.pdf'), 'tenant/files/evidence.pdf');
});
