import { describe, expect, it } from 'vitest';
import { buyerAdminModules, hasPermission } from './navigation';

describe('navigation permission matching', () => {
  it('allows exact permission matches', () => {
    expect(hasPermission(['buyer:demand:read'], 'buyer:demand:read')).toBe(true);
  });

  it('allows parent wildcard permissions', () => {
    expect(hasPermission(['buyer:*'], 'buyer:contract:read')).toBe(true);
    expect(hasPermission(['buyer:rfq:*'], 'buyer:rfq:read')).toBe(true);
  });

  it('does not leak unrelated module permissions', () => {
    expect(hasPermission(['buyer:demand:*'], 'buyer:contract:read')).toBe(false);
    expect(hasPermission(['supplier:*'], 'buyer:rfq:read')).toBe(false);
  });

  it('keeps governance modules behind role management permission', () => {
    const guarded = buyerAdminModules.filter((m) => ['team', 'org', 'process-engine'].includes(m.id));

    expect(guarded).toHaveLength(3);
    expect(guarded.map((m) => m.requiredPermission)).toEqual([
      'buyer:role:manage',
      'buyer:role:manage',
      'buyer:role:manage',
    ]);
  });
});
