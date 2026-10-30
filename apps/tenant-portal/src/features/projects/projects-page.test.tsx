import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './projects-page';
const f = vi.hoisted(() => ({
  manage: true,
  read: true,
  fail: false,
  save: vi.fn(),
  list: vi.fn(),
}));
const project = {
  id: 'p1',
  projectNo: 'PRJ-2026-01',
  title: '设备更新项目',
  departmentName: '部门A',
  ownerName: '项目负责人',
  departmentId: 'd1',
  ownerId: 'u1',
  period: '2026',
  fundingSource: '年度预算',
  purpose: '设备更新',
  plannedAmount: 200,
  status: 'draft',
  revision: 1,
  createdBy: 'u1',
};
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({
    can: (p: string) => f.read && (f.manage || p.endsWith(':read')),
  }),
}));
vi.mock('../../lib/auth-store', () => ({
  useAuthStore: (s: (v: unknown) => unknown) =>
    s({ session: { userId: 'u1' } }),
}));
vi.mock('../attachments/owner-attachments', () => ({
  OwnerAttachments: () => <p>项目附件台账</p>,
}));
vi.mock('../workflow/workflow-instance-panel', () => ({
  WorkflowStatusPanel: () => <p>立项审批历史</p>,
}));
vi.mock('../workflow/workflow-submit-dialog', () => ({
  WorkflowSubmitDialog: () => <p>独立立项表单</p>,
}));
vi.mock('@24bid/api-client', () => ({
  projectList: (...args: unknown[]) => {
    f.list(...args);
    return f.fail
      ? Promise.reject(Error('Offline'))
      : Promise.resolve({ items: [project], total: 11 });
  },
  projectDetail: () => Promise.resolve({ project, lines: [] }),
  projectSave: (...args: unknown[]) => f.save(...args),
  projectAction: vi.fn(),
  projectLinkDemand: vi.fn(),
  projectCreateExecution: vi.fn(),
  projectOptions: () =>
    Promise.resolve({
      departments: [{ id: 'd1', name: '部门A', status: 'active' }],
      users: [
        { id: 'u1', name: '项目负责人', departmentId: 'd1', status: 'active' },
      ],
    }),
  projectDemands: () => Promise.resolve([]),
  projectExecution: () =>
    Promise.resolve({
      documents: [],
      demands: [],
      demandAmount: 0,
      orderAmount: 0,
      invoicedAmount: 0,
      paidAmount: 0,
      warnings: [],
      canClose: false,
    }),
  projectBudget: () => Promise.reject(Error('No financial scope')),
  useMaterialList: () => ({
    data: {
      data: [
        {
          id: 'm1',
          name: '计算机',
          unit: '台',
          specification: '标准',
          referencePrice: 100,
        },
      ],
    },
  }),
  usePurchaseDemandList: () => ({ data: { data: [] } }),
}));
beforeEach(() => {
  f.manage = true;
  f.read = true;
  f.fail = false;
  f.save.mockClear();
  f.list.mockClear();
  history.replaceState(null, '', '/?module=projects');
});
afterEach(cleanup);
const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectsPage />
    </QueryClientProvider>,
  );
describe('project workspace', () => {
  it('loads server pagination and applies search without local truncation', async () => {
    show();
    await screen.findAllByText(/设备更新项目/);
    fireEvent.change(screen.getByPlaceholderText('按编号 / 标题 / 资金来源搜索'), {
      target: { value: '设备' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    await waitFor(() => expect(f.list).toHaveBeenCalledWith(1, '', '设备', 8));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /下一页/ }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
    await waitFor(() => expect(f.list).toHaveBeenCalledWith(2, '', '设备', 8));
    fireEvent.click(screen.getByRole('button', { name: '立项审批中' }));
    await waitFor(() => expect(f.list).toHaveBeenCalledWith(1, 'submitted', '设备', 8));
  });
  it('separates detail from editing and shows unavailable financial data as an error', async () => {
    show();
    await screen.findAllByText(/设备更新项目/);
    fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);
    await screen.findByText('立项审批历史');
    expect(screen.queryByRole('form', { name: '项目申报表' })).toBeNull();
    await screen.findByText('预算读取失败，请刷新重试。');
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    await screen.findByRole('form', { name: '项目申报表' });
    expect(screen.queryByText('立项审批历史')).toBeNull();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('hides creation for read-only users and denies unpermitted pages', async () => {
    f.manage = false;
    show();
    await screen.findAllByText(/设备更新项目/);
    expect(screen.queryByRole('button', { name: '新建项目' })).toBeNull();
    cleanup();
    f.read = false;
    show();
    expect(screen.getByText('无项目库查看权限。')).toBeTruthy();
  });
  it('does not show stale list rows on read failure', async () => {
    f.fail = true;
    show();
    await screen.findByText('项目列表加载失败，请刷新重试。');
    expect(screen.queryByText('设备更新项目')).toBeNull();
  });
});
