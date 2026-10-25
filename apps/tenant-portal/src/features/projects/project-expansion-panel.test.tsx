import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectExpansionPanel } from './project-expansion-panel';
const f = vi.hoisted(() => ({
  pending: false,
  open: false,
  manage: true,
  fail: false,
  list: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({
    can: (p: string) => f.manage || p.endsWith(':read'),
  }),
}));
vi.mock('../attachments/owner-attachments', () => ({
  OwnerAttachments: () => null,
}));
vi.mock('../workflow/workflow-instance-panel', () => ({
  WorkflowStatusPanel: () => null,
}));
vi.mock('../workflow/workflow-submit-dialog', () => ({
  WorkflowSubmitDialog: () => null,
}));
vi.mock('@24bid/api-client', () => ({
  projectPackages: () =>
    f.fail ? Promise.reject(Error('offline')) : Promise.resolve([]),
  projectPackageBalances: () =>
    Promise.resolve([
      { materialId: 'm1', approved: 3, allocated: 0, remaining: 3 },
    ]),
  projectChanges: (_id: string, page: number) => {
    f.list(page);
    return Promise.resolve({
      items: [],
      total: 11,
      page,
      pageSize: 10,
      pending: f.pending,
      hasOpenChange: f.open,
    });
  },
  projectChange: vi.fn(),
  projectChangeSave: vi.fn(),
  projectChangeAction: vi.fn(),
  projectPackageSave: (...args: unknown[]) => {
    f.save(...args);
    return Promise.resolve({});
  },
  projectPackageAction: vi.fn(),
  projectPackageExecute: vi.fn(),
  projectPackageLink: vi.fn(),
  projectPackageExecution: vi.fn(),
  usePurchaseDemandList: () => ({ data: { data: [] } }),
}));
const project = {
  id: 'p1',
  title: '项目',
  status: 'approved',
  revision: 3,
  plannedAmount: 300,
  departmentId: 'd1',
  departmentName: '部门',
  ownerName: '负责人',
  ownerId: 'u1',
  period: '2026',
  fundingSource: '预算',
  purpose: '用途',
  projectNo: 'P1',
  createdBy: 'u1',
};
const lines = [
  {
    materialId: 'm1',
    materialName: '电脑',
    unit: '台',
    specification: '标准',
    quantity: 3,
    unitPrice: 100,
    purpose: '办公',
  },
];
function show() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectExpansionPanel
        project={project}
        lines={lines}
        demands={[]}
        onChanged={async () => {}}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  f.pending = false;
  f.open = false;
  f.fail = false;
  f.manage = true;
  f.list.mockClear();
  f.save.mockClear();
  history.replaceState(null, '', '/?module=projects');
});
afterEach(cleanup);
describe('project packages and changes', () => {
  it('blocks new packages while any change is pending even on a different result page', async () => {
    f.pending = true;
    show();
    await waitFor(() => expect(f.list).toHaveBeenCalledWith(1));
    await screen.findByText(/立项变更正在审批/);
    expect(screen.queryByRole('button', { name: '新建分包' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '立项变更' }));
    fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
    await waitFor(() => expect(f.list).toHaveBeenCalledWith(2));
    expect(screen.queryByRole('button', { name: '申请立项变更' })).toBeNull();
  });
  it('saves a real allocation payload with optimistic revision and closes its modal', async () => {
    show();
    const create = await screen.findByRole('button', { name: '新建分包' });
    await waitFor(() => expect(create.hasAttribute('disabled')).toBe(false));
    fireEvent.click(create);
    fireEvent.change(screen.getByLabelText('分包名称'), {
      target: { value: '第一包' },
    });
    const quantity = screen.getByRole('spinbutton');
    await waitFor(() => expect(quantity.hasAttribute('disabled')).toBe(false));
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存分包' }));
    await waitFor(() => expect(f.save).toHaveBeenCalled());
    expect(f.save.mock.calls[0][1]).toMatchObject({
      projectRevision: 3,
      revision: 0,
      title: '第一包',
      lines: [{ materialId: 'm1', quantity: 2 }],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('fails closed on package load errors and hides writes for read-only users', async () => {
    f.fail = true;
    show();
    await screen.findByText(/分包.*加载失败/);
    expect(screen.queryByRole('button', { name: '新建分包' })).toBeNull();
    cleanup();
    f.fail = false;
    f.manage = false;
    show();
    await waitFor(() => expect(f.list).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '新建分包' })).toBeNull();
  });
  it('does not create parallel change drafts when another open draft exists', async () => {
    f.open = true;
    show();
    await waitFor(() => expect(f.list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '立项变更' }));
    expect(
      (
        await screen.findByRole('button', { name: '申请立项变更' })
      ).hasAttribute('disabled'),
    ).toBe(true);
  });
});
