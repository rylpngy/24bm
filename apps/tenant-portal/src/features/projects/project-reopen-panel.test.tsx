import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectReopenPanel } from './project-reopen-panel';
import { ProjectReopenEvidence } from './project-reopen-evidence';
import type { ProcProject } from '@24bid/api-client';

const f = vi.hoisted(() => ({
  manage: true,
  block: false,
  status: 'closed',
  submit: vi.fn(),
  preview: vi.fn(),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: () => f.manage }),
}));
vi.mock('@24bid/api-client', () => ({
  projectReopenPreview: async (_id: string, lot?: string) => {
    f.preview(lot);
    return {
      projectStatus: f.status,
      period: '2027',
      restoreAmount: 100,
      funds: [
        {
          fundId: 'fund',
          name: '项目专项资金',
          revision: 1,
          restoreAmount: 100,
        },
      ],
      packages: [{ id: 'lot', title: '原结项分包', revision: 5 }],
      blockers: f.block ? ['当前可用额度不足以恢复已释放责任'] : [],
    };
  },
  projectLifecycleSubmit: async (...args: unknown[]) => f.submit(...args),
  projectReopenArchive: vi.fn(),
}));
vi.mock('../workflow/workflow-submit-dialog', () => ({
  WorkflowSubmitDialog: ({
    onSubmit,
  }: {
    onSubmit: (data: Record<string, unknown>) => void;
  }) => (
    <button onClick={() => onSubmit({ reason: '审批表单' })}>
      确认重开表单
    </button>
  ),
}));
beforeEach(() => {
  f.manage = true;
  f.block = false;
  f.status = 'closed';
  vi.clearAllMocks();
});
afterEach(cleanup);
const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectReopenPanel
        project={{ id: 'p', status: f.status, revision: 8 } as ProcProject}
        onChanged={async () => {}}
      />
    </QueryClientProvider>,
  );
it('submits the explicitly selected closed package revision through independent workflow', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '申请项目重开' }));
  await screen.findByText('项目专项资金');
  fireEvent.change(screen.getByLabelText('重开范围'), {
    target: { value: 'lot' },
  });
  await waitFor(() => expect(f.preview).toHaveBeenLastCalledWith('lot'));
  fireEvent.change(screen.getByLabelText('重开原因'), {
    target: { value: '结项后补充清算核对' },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '提交重开审批' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: '提交重开审批' }));
  fireEvent.click(screen.getByRole('button', { name: '确认重开表单' }));
  await waitFor(() =>
    expect(f.submit).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({
        kind: 'reopen',
        revision: 8,
        packageId: 'lot',
        packageRevision: 5,
        formData: { reason: '审批表单' },
      }),
    ),
  );
});
it('keeps the current source capacity failure visible and prevents submission', async () => {
  f.block = true;
  show();
  fireEvent.click(screen.getByRole('button', { name: '申请项目重开' }));
  await screen.findByText('当前可用额度不足以恢复已释放责任');
  fireEvent.change(screen.getByLabelText('重开原因'), {
    target: { value: '申请' },
  });
  expect(screen.getByRole('button', { name: '提交重开审批' })).toBeDisabled();
});
it('does not expose write controls to read-only users', () => {
  f.manage = false;
  show();
  expect(screen.queryByRole('button', { name: '申请项目重开' })).toBeNull();
});
it('renders preserved closure status, scope and responsibility evidence without combining amounts', () => {
  render(
    <ProjectReopenEvidence
      snapshot={JSON.stringify({
        reopen: {
          project: { status: 'terminated' },
          packageId: 'lot',
          packages: [{ id: 'lot', title: '原结项分包' }],
          period: '2027',
          funding: [{ fundId: 'f', name: '原专项来源', restoreAmount: 100 }],
        },
      })}
    />,
  );
  expect(screen.getByText('已终止')).toBeTruthy();
  expect(screen.getByText('原结项分包')).toBeTruthy();
  expect(screen.getByText('原专项来源')).toBeTruthy();
});
