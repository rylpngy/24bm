import { describe, expect, it } from 'vitest';
import { buyerAdminModules, hasPermission, platformNavigation, supplierNavigation, visiblePortalModules } from './navigation';

describe('navigation permission matching', () => {
  it('gates cooperation invitations with supplier profile read', () => {
    expect(visiblePortalModules(supplierNavigation, ['supplier:profile:read']).map(m => m.id)).toContain('cooperation-invitations');
    expect(visiblePortalModules(supplierNavigation, ['supplier:profile:manage']).map(m => m.id)).not.toContain('cooperation-invitations');
    expect(visiblePortalModules(supplierNavigation, ['supplier:order:read']).map(m => m.id)).not.toContain('cooperation-invitations');
  });
  it('requires separate read permissions for analytics, budgets and enterprise audit', () => {
    const guarded = buyerAdminModules.filter(m => ['analytics', 'budgets', 'audit'].includes(m.id));
    expect(guarded.map(m => m.requiredPermission)).toEqual(['buyer:analytics:read', 'buyer:budget:read', 'buyer:audit:read']);
    expect(guarded.every(m => !hasPermission(['buyer:report:export'], m.requiredPermission!))).toBe(true);
  });
  it('requires explicit read access for buyer fulfillment and supplier modules', () => {
    const guarded = buyerAdminModules.filter(m => ['orders', 'receipts', 'suppliers'].includes(m.id));
    expect(guarded.map(m => m.requiredPermission).sort()).toEqual(['buyer:order:read', 'buyer:receipt:read', 'buyer:supplier:read']);
    expect(guarded.every(m => !hasPermission(['buyer:demand:read'], m.requiredPermission!))).toBe(true);
  });
  it('shows only assigned portal modules without exposing aggregate dashboards', () => {
    expect(visiblePortalModules(platformNavigation, ['platform:announcement:read']).map(m => m.id)).toEqual(['announcements']);
    expect(visiblePortalModules(supplierNavigation, ['supplier:order:read']).map(m => m.id)).toEqual(['mall-projects', 'orders']);
    expect(visiblePortalModules(supplierNavigation, [])).toEqual([]);
    expect(visiblePortalModules(platformNavigation, ['supplier:*'])).toEqual([]);
  });

  it('preserves full-scope navigation without broadening restricted roles', () => {
    expect(visiblePortalModules(supplierNavigation, ['supplier:*'])).toEqual(supplierNavigation.modules);
    expect(visiblePortalModules(platformNavigation, ['platform:*'])).toEqual(platformNavigation.modules);
  });
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
