import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectLifecyclePanel } from './project-lifecycle-panel';
import type { ProcProject } from '@24bid/api-client';

const f = vi.hoisted(() => ({
  blocked: false,
  manage: true,
  fail: false,
  paid: false,
  unknown: false,
  preview: vi.fn(),
  page: vi.fn(),
  submit: vi.fn(),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({
    can: (p: string) => f.manage || p.endsWith(':read'),
  }),
}));
vi.mock('../workflow/workflow-instance-panel', () => ({
  WorkflowStatusPanel: ({ businessType }: { businessType: string }) => (
    <p>{businessType}</p>
  ),
}));
vi.mock('../workflow/workflow-submit-dialog', () => ({
  WorkflowSubmitDialog: ({
    onSubmit,
  }: {
    onSubmit: (d: Record<string, unknown>) => void;
  }) => (
    <button onClick={() => onSubmit({ reference: 'verified' })}>
      确认动态表单
    </button>
  ),
}));
vi.mock('@24bid/api-client', () => ({
  projectLifecyclePreview: () => {
    f.preview();
    return f.fail
      ? Promise.reject(Error('offline'))
      : Promise.resolve({
          businessPeriod: '2026',
          effectivePeriod: '2027',
          amount: 400,
          paidAmount: f.unknown ? null : f.paid ? 150 : 0,
          transferAmount: f.unknown ? null : f.paid ? 250 : 400,
          payments: [],
          sources: f.paid
            ? [
                { period: '2026', pending: 0, committed: 100, paidAmount: 100 },
                { period: '2027', pending: 0, committed: 300, paidAmount: 50 },
              ]
            : [],
          carryoverBlockers:
            f.blocked || f.unknown ? ['付款资料无法核验，不能迁移'] : [],
          liquidationBlockers: ['订单未结清'],
        });
  },
  projectLifecycleHistory: (_id: string, page: number) => {
    f.page(page);
    return Promise.resolve({
      items: [
        {
          id: 'r1',
          kind: 'carryover',
          sourcePeriod: '2026',
          targetPeriod: '2027',
          amount: 400,
          status: 'approved',
          reason: '年度承接',
          revision: 2,
        },
      ],
      total: 11,
      page,
      pageSize: 10,
    });
  },
  projectLifecycleSubmit: (...args: unknown[]) => {
    f.submit(...args);
    return Promise.resolve({});
  },
  projectLifecycleWithdraw: vi.fn(),
}));
const p = {
  id: 'p1',
  period: '2026',
  revision: 4,
  status: 'approved',
} as ProcProject;
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectLifecyclePanel project={p} onChanged={async () => {}} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  f.blocked = false;
  f.manage = true;
  f.fail = false;
  f.paid = false;
  f.unknown = false;
  vi.clearAllMocks();
});
afterEach(cleanup);
describe('project lifecycle', () => {
  it('loads only on expand and paginates real history separately from business year', async () => {
    show();
    expect(f.preview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    expect(screen.getByText('立项年度 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
    await waitFor(() => expect(f.page).toHaveBeenCalledWith(2));
    fireEvent.click(await screen.findByRole('button', { name: '详情' }));
    expect(await screen.findByText('project_carryover')).toBeTruthy();
  });
  it('requires reason and submits the published dynamic workflow fields', async () => {
    show();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    fireEvent.click(screen.getByText('申请跨年度承接'));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: '提交审批' }),
    ).toBeDisabled();
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: '申请原因' }),
      { target: { value: '经过复核的年度责任' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '提交审批' }));
    fireEvent.click(screen.getByText('确认动态表单'));
    await waitFor(() =>
      expect(f.submit).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          revision: 4,
          kind: 'carryover',
          targetPeriod: String(Math.max(2028, new Date().getFullYear())),
          reason: '经过复核的年度责任',
          formData: { reference: 'verified' },
        }),
      ),
    );
  });
  it('shows financial blockers without presenting a clickable invalid submit', async () => {
    f.blocked = true;
    show();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    fireEvent.click(screen.getByText('申请跨年度承接'));
    expect(screen.getByText('付款资料无法核验，不能迁移')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '申请原因' }), {
      target: { value: '不能越过资金核对' },
    });
    expect(screen.getByRole('button', { name: '提交审批' })).toBeDisabled();
  });
  it('does not expose management commands to read-only users', async () => {
    f.manage = false;
    show();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    expect(screen.queryByText('申请跨年度承接')).toBeNull();
    expect(screen.queryByText('申请已有订单终止清算')).toBeNull();
  });
  it('separates historical paid expense from current responsibility without disabling paid carryover', async () => {
    f.paid = true;
    show();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    const table = screen.getByRole('table', { name: '逐年预算责任分摊' });
    expect(within(table).getByText('2026 · 历史')).toBeTruthy();
    expect(within(table).getByText('2027 · 当前')).toBeTruthy();
    expect(screen.getByText('¥150.00')).toBeTruthy();
    expect(screen.getByText('¥250.00')).toBeTruthy();
    fireEvent.click(screen.getByText('申请跨年度承接'));
    fireEvent.change(screen.getByRole('textbox', { name: '申请原因' }), {
      target: { value: '仅承接未支付责任' },
    });
    expect(screen.getByRole('button', { name: '提交审批' })).not.toBeDisabled();
    expect(screen.getByText(/已冻结付款不能直接冲销/)).toBeTruthy();
  });
  it('keeps unknown payments and transfer amount unknown instead of presenting zero', async () => {
    f.unknown = true;
    show();
    fireEvent.click(screen.getByText('展开办理台账'));
    await screen.findByText('当前责任年度 2027');
    const values = screen.getByText('已核实净付款', {
      selector: 'dt',
    }).parentElement!;
    expect(values.textContent).toContain('待核对');
    expect(values.textContent).not.toContain('¥0.00');
    fireEvent.click(screen.getByText('申请跨年度承接'));
    expect(screen.getByText('付款资料无法核验，不能迁移')).toBeTruthy();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeDisabled();
  });
});
