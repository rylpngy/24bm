import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderSettlementPanel } from './order-settlement-panel';
afterEach(cleanup);
function state() {
  const entry = {
    id: 'e',
    orderId: 'o',
    contractId: 'c',
    kind: 'reduction',
    reason: '终止未履行余额',
    snapshot: '{"assessment":{"lines":[]}}',
    goodsAmount: 100,
    compensationAmount: 0,
    finalAmount: 100,
    initialPaid: 0,
    status: 'supplier_pending',
    revision: 1,
    createdBy: 'buyer',
    createdAt: new Date().toISOString(),
    agreementName: 'agreement.pdf',
  };
  return {
    data: {
      preview: {
        contractId: 'c',
        baseline: '{"lines":[]}',
        blockers: [] as string[],
      },
      items: [entry],
      total: 1,
      actorId: 'buyer',
    },
    loading: false,
    loadError: false,
    page: 1,
    setPage: vi.fn(),
    busy: false,
    error: '',
    selected: 'e',
    setSelected: vi.fn(),
    detail: {
      record: entry,
      evidence: [],
      netPaid: 0,
      refundDue: 0,
      paymentDue: 100,
      blockers: ['实际净付款尚未等于约定清算金额'],
    },
    detailLoading: false,
    detailError: false,
    refresh: vi.fn(),
    propose: vi.fn().mockResolvedValue(true),
    act: vi.fn().mockResolvedValue(true),
    evidence: vi.fn().mockResolvedValue(true),
  };
}
it('supplier sees confirmation but not buyer internal or financial controls', () => {
  const s = state();
  render(
    <OrderSettlementPanel state={s} supplier canManage onAgreement={vi.fn()} />,
  );
  expect(screen.getByRole('button', { name: '同意方案' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '提交内部审批' })).toBeNull();
  expect(screen.queryByText('登记实际清算凭证')).toBeNull();
});
it('buyer cannot consent as supplier, and must enter a reason before withdrawal', () => {
  const s = state();
  render(<OrderSettlementPanel state={s} canManage onAgreement={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '同意方案' })).toBeNull();
  const b = screen.getByRole('button', {
    name: '撤回申请',
  }) as HTMLButtonElement;
  expect(b.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('办理意见'), {
    target: { value: '补充材料' },
  });
  fireEvent.click(b);
  expect(s.act).toHaveBeenCalledWith(s.detail.record, 'withdraw', '补充材料');
});
it('approved settlement requires finance permission and complete monetary evidence', () => {
  const s = state();
  s.detail.record.status = 'approved';
  const view = render(
    <OrderSettlementPanel state={s} canManage onAgreement={vi.fn()} />,
  );
  expect(screen.queryByText('登记实际清算凭证')).toBeNull();
  view.rerender(
    <OrderSettlementPanel
      state={s}
      canManage
      canFinance
      onAgreement={vi.fn()}
    />,
  );
  expect(
    (
      screen.getByRole('button', {
        name: '完成清算并归档合同',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByText('实际净付款尚未等于约定清算金额')).toBeTruthy();
});
it('keeps detail errors visible and prevents stale detail actions', () => {
  const s = state();
  s.detailError = true;
  render(<OrderSettlementPanel state={s} canManage onAgreement={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toContain('详情加载失败');
  expect(screen.queryByRole('button', { name: '撤回申请' })).toBeNull();
});
