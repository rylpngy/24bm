import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuditPage } from './audit-page';

vi.mock('@24bid/api-client', () => ({
  useAuditLogList: () => ({ data: { data: [
    { id: 'audit-1', action: 'supplier_evaluation.created', targetType: 'buyer_supplier_relation', targetId: 'relation-a', actorId: 'reviewer-a', detail: '综合分=89.25', createdAt: '2026-10-23T04:00:00Z' },
    { id: 'audit-2', action: 'supplier_cooperation_tier.confirmed', targetType: 'buyer_supplier_relation', targetId: 'relation-a', actorId: 'reviewer-a', detail: '合作层级=优选，依据分数=89.25', createdAt: '2026-10-23T04:01:00Z' },
  ] } }),
}));
afterEach(cleanup);

it('shows readable supplier evaluation and tier audit actions with details', () => {
  render(<AuditPage />);
  expect(screen.getAllByText('供应商绩效考核·创建').length).toBeGreaterThan(0);
  expect(screen.getAllByText('供应商合作调级·确认').length).toBeGreaterThan(0);
  expect(screen.getAllByText('合作层级=优选，依据分数=89.25').length).toBeGreaterThan(0);
});
