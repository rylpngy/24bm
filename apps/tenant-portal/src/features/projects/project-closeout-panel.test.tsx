import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { ProjectCloseoutPanel } from './project-closeout-panel';
const f = vi.hoisted(() => ({
  manage: true,
  fail: false,
  write: vi.fn(),
  history: vi.fn(),
  monitor: vi.fn(),
  download: vi.fn(),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({
    can: (p: string) => f.manage || p.endsWith(':read'),
  }),
}));
const row = {
  packageId: 'lot1',
  title: '设备包',
  status: 'ready',
  revision: 3,
  canRework: true,
  canStop: false,
  milestones: [
    {
      key: 'demand',
      title: '需求审批通过',
      dueDate: null,
      complete: false,
      overdue: false,
      evidence: '待审批',
    },
  ],
  blockers: [],
};
vi.mock('@24bid/api-client', () => ({
  projectMonitor: () => {
    f.monitor();
    return f.fail
      ? Promise.reject(Error('offline'))
      : Promise.resolve({
          packages: [row],
          overdueCount: 0,
          unallocatedAmount: 100,
        });
  },
  projectAdjustmentHistory: (_p: string, page: number) => {
    f.history(page);
    return Promise.resolve({ items: [], total: 21 });
  },
  projectCloseoutAction: (...args: unknown[]) => f.write(...args),
  downloadReport: (...args: unknown[]) => f.download(...args),
}));
const project = {
  id: 'p1',
  title: '项目',
  status: 'approved',
  revision: 4,
  plannedAmount: 300,
  departmentId: 'd1',
  departmentName: '部门',
  ownerId: 'u1',
  ownerName: '负责人',
  period: '2026',
  fundingSource: '资金',
  purpose: '用途',
  projectNo: 'P1',
  createdBy: 'u1',
};
function show(status = 'approved') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectCloseoutPanel
        project={{ ...project, status }}
        onChanged={async () => {}}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  f.manage = true;
  f.fail = false;
  f.write.mockReset().mockResolvedValue({});
  f.history.mockClear();
  f.monitor.mockClear();
  f.download.mockClear();
});
afterEach(cleanup);
describe('project execution closeout', () => {
  it('loads monitoring explicitly and honors server operation boundaries', async () => {
    show();
    expect(f.monitor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('设备包');
    expect(
      screen.getByRole('button', { name: '终止' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: '重编' }).hasAttribute('disabled'),
    ).toBe(false);
  });
  it('submits planned dates with current revision and reason', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('设备包');
    fireEvent.click(screen.getByRole('button', { name: '计划' }));
    fireEvent.change(screen.getByLabelText('计划完成日期'), {
      target: {
        value: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      },
    });
    fireEvent.change(screen.getByLabelText('计划调整原因'), {
      target: { value: '协调实施进度' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
    await waitFor(() => expect(f.write).toHaveBeenCalled());
    expect(f.write.mock.calls[0]).toMatchObject([
      'p1',
      'lot1',
      'milestones',
      { revision: 3, milestone: 'demand', reason: '协调实施进度' },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('retains denied mutation feedback in the confirmation dialog', async () => {
    f.write.mockRejectedValue(Error('只能由原发起人撤回'));
    show();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('设备包');
    fireEvent.click(screen.getByRole('button', { name: '重编' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '核对设备范围' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await screen.findAllByText('只能由原发起人撤回');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('uses server pagination for adjustment history', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('设备包');
    fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
    await waitFor(() => expect(f.history).toHaveBeenCalledWith(2));
  });
  it('fails closed on monitor errors and hides writes for read-only users', async () => {
    f.fail = true;
    show();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('执行监控加载失败或缺少源业务权限，请刷新重试。');
    expect(screen.queryByText('设备包')).toBeNull();
    cleanup();
    f.fail = false;
    f.manage = false;
    show();
    fireEvent.click(screen.getByRole('button', { name: '展开执行监控' }));
    await screen.findByText('设备包');
    expect(screen.queryByRole('button', { name: '计划' })).toBeNull();
  });
  it('offers protected whole-project archive only for terminal projects', async () => {
    show();
    expect(screen.queryByRole('button', { name: '整项目档案' })).toBeNull();
    cleanup();
    show('closed');
    fireEvent.click(screen.getByRole('button', { name: '整项目档案' }));
    await waitFor(() =>
      expect(f.download).toHaveBeenCalledWith(
        '/api/v1/buyer/projects/p1/archive/download',
        '项目档案.zip',
      ),
    );
  });
});
