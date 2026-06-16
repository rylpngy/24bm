import { describe, expect, it } from 'vitest';
import {
  adminRoleNavigation,
  buyerAdminModules,
  defaultAdminRole,
} from './adminNavigation';

describe('admin navigation', () => {
  it('defaults stage three to the buyer admin workspace', () => {
    expect(defaultAdminRole).toBe('buyer');
  });

  it('exposes the stage three buyer admin modules in order', () => {
    expect(buyerAdminModules.map((module) => module.id)).toEqual([
      'dashboard',
      'demands',
      'approvals',
      'suppliers',
      'materials',
      'rfqs',
      'quotes',
      'orders',
      'receipts',
      'invoices',
      'audit',
    ]);
  });

  it('keeps platform and supplier role menus available from the admin shell', () => {
    expect(adminRoleNavigation.map((role) => role.id)).toEqual(['platform', 'buyer', 'supplier']);
    expect(adminRoleNavigation.find((role) => role.id === 'platform')?.modules.map((module) => module.id)).toEqual([
      'overview',
      'tenants',
      'reviews',
      'announcements',
    ]);
    expect(adminRoleNavigation.find((role) => role.id === 'supplier')?.modules.map((module) => module.id)).toEqual([
      'overview',
      'opportunities',
      'quotes',
      'orders',
      'invoices',
      'profile',
    ]);
  });
});
