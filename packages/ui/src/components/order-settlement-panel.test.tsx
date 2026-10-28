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
it('offers supplemental clearing as a new application referencing the completed version', () => {
  const s = state();
  s.data.preview.baseline = JSON.stringify({
    previousSettlementId: 'completed-1',
    lines: [],
    allocationRequired: true,
    invoiceBasis: [{ source: 'i', label: '原发票', face: 100, paid: 60 }],
  });
  render(<OrderSettlementPanel state={s} canManage onAgreement={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '发起补充清算' }));
  fireEvent.change(screen.getByLabelText('清算原因'), {
    target: { value: '双方补充协议' },
  });
  fireEvent.change(screen.getByLabelText('原发票清算货款'), {
    target: { value: '50' },
  });
  fireEvent.submit(screen.getByLabelText('清算原因').closest('form')!);
  expect(s.propose).toHaveBeenCalledWith(
    expect.objectContaining({
      previousSettlementId: 'completed-1',
      allocations: [{ source: 'i', goodsAmount: 50 }],
    }),
  );
});
it('keeps funded finance read-only when budget source details are not authorized', () => {
  const s = state();
  s.detail.record.status = 'approved';
  render(
    <OrderSettlementPanel
      state={{ ...s, detail: { ...s.detail, fundingRequired: true } }}
      canManage
      canFinance
      onAgreement={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    '专项清算需要预算查看权限',
  );
  expect(screen.queryByText('登记实际清算凭证')).toBeNull();
  expect(screen.queryByRole('button', { name: '登记凭证' })).toBeNull();
});
it('renders explicit invoice allocation inputs and post-return retained quantities', () => {
  const s = state();
  s.data.preview.baseline = JSON.stringify({
    allocationRequired: true,
    invoiceBasis: [
      { source: 'i1', label: '发票一', face: 100, paid: 100 },
      { source: '~unbilled', label: '未开票货款', face: 100, paid: 0 },
    ],
    lines: [
      {
        id: 'line',
        description: '电脑',
        quantity: 3,
        received: 3,
        retainedQuantity: 2,
        cancelledQuantity: 1,
        unitPrice: 100,
      },
    ],
  });
  render(<OrderSettlementPanel state={s} canManage onAgreement={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '发起合同清算' }));
  expect(
    screen.getByRole('spinbutton', { name: '发票一清算货款' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('spinbutton', { name: '未开票货款清算货款' }),
  ).toBeTruthy();
  const row = screen.getByText('电脑').closest('tr')!;
  expect(row.children[2].textContent).toBe('2');
  expect(row.children[3].textContent).toBe('1');
});
it('no-contract creation uses order permission while contract creation remains restricted', () => {
  const s = state();
  const view = render(
    <OrderSettlementPanel
      state={s}
      canManage
      canContractManage={false}
      onAgreement={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: '发起合同清算' })).toBeNull();
  const noContract = {
    ...s,
    data: { ...s.data, preview: { ...s.data.preview, contractId: undefined } },
    detail: { ...s.detail, record: { ...s.detail.record, contractId: null } },
  };
  view.rerender(
    <OrderSettlementPanel
      state={noContract}
      canManage
      canContractManage={false}
      onAgreement={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: '发起订单清算' })).toBeTruthy();
});
it('shows each invoice balance even when aggregate net is balanced', () => {
  const s = state();
  s.detail.record.snapshot = JSON.stringify({
    invoicePlan: [
      { source: 'a', label: '已付发票', face: 100, paid: 100, target: 0 },
      { source: 'b', label: '待付发票', face: 100, paid: 0, target: 100 },
    ],
  });
  s.detail.record.status = 'approved';
  render(
    <OrderSettlementPanel
      state={s}
      canManage
      canFinance
      onAgreement={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('combobox', { name: /^发票或款项归属/ }),
  ).toBeTruthy();
  expect(
    screen.getByText('已付发票', { selector: 'td' }).closest('tr')!.children[3]
      .textContent,
  ).toContain('100.00');
  expect(
    screen.getByText('待付发票', { selector: 'td' }).closest('tr')!.children[4]
      .textContent,
  ).toContain('100.00');
});
