import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { BudgetsPage } from './budgets-page';

const state = vi.hoisted(() => ({ disbursed: null as number | null, pendingAllocationAmount: 1800, unverifiedPaymentCount: 0 }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => false }) }));
vi.mock('@24bid/api-client', () => ({
  useBuyerBudgetBudgets: () => ({ data: { data: [{ id: 'b', departmentName: '部门A', period: '2026',
    totalAmount: 1200, committed: 1200, pending: 0, remaining: 0,
    disbursed: state.disbursed, pendingAllocationAmount: state.pendingAllocationAmount, unverifiedPaymentCount: state.unverifiedPaymentCount }] } }),
  useBuyerBudgetUpsert: () => ({}), useDepartmentList: () => ({}),
}));
function show() { render(<QueryClientProvider client={new QueryClient()}><BudgetsPage /></QueryClientProvider>); }

it('labels unallocated related payments with their real amount and warns against summing across departments', () => {
  state.unverifiedPaymentCount = 0;
  state.disbursed = null; state.pendingAllocationAmount = 1800;
  show();
  expect(screen.getByText('待分摊')).toBeTruthy();
  expect(screen.getByText(/关联付款净额 ¥1,800 待分摊/)).toBeTruthy();
  expect(screen.getByText(/在涉及部门重复展示，不可相加/)).toBeTruthy();
});

it('labels the allocated amount as net payment ledger apportioned by demand budgets, never milestone status', () => {
  state.unverifiedPaymentCount = 0;
  state.disbursed = 1200; state.pendingAllocationAmount = 0;
  show();
  expect(screen.getByText('实付(付款净流水按需求预算分摊)')).toBeTruthy();
  expect(screen.getByText(/已实际支付 ¥1,200/)).toBeTruthy();
  expect(screen.queryByText(/待分摊/)).toBeNull();
});

it('distinguishes historical paid status without ledger from invalid budget weights and never invents an amount', () => {
  state.disbursed = null; state.pendingAllocationAmount = 0; state.unverifiedPaymentCount = 1;
  show();
  expect(screen.getByText('待核对')).toBeTruthy();
  expect(screen.getByText(/历史付款缺流水：1 张发票，实付金额待核对/)).toBeTruthy();
  expect(screen.queryByText(/预算缺失或非正/)).toBeNull();
});
