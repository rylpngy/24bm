import { describe, expect, it } from 'vitest';
import { portalHref } from './portal-href';

describe('portal business navigation', () => {
  it('preserves the solution without leaking prior detail or finance parameters', () => {
    const url = new URL(portalHref({ module: 'orders', recordId: 'order-1' }, '?solution=ludong-poc&recordId=old&financeView=batches&view=review'), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ module: 'orders', recordId: 'order-1', solution: 'ludong-poc' });
  });
  it('leaves the base system independent of a solution', () => {
    expect(portalHref({ module: 'invoices', recordId: 'invoice-1' }, '?module=contracts')).toBe('/?module=invoices&recordId=invoice-1');
  });
});
