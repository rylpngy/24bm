import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TendersPage } from './tenders-page';

const state = vi.hoisted(() => ({ manage: false, failed: false, suppliersEnabled: false, awarded: false, mixed: false,
  noneEligible: false, evaluatorCounts: [1], submitScores: vi.fn(),
}));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.manage }) }));
vi.mock('@24bid/api-client', async (original) => {
  const api = await original<Record<string, unknown>>();
  const mocks: Record<string, unknown> = {};
  for (const name of ['Create', 'Update', 'Publish', 'Distribute', 'Open', 'Fail', 'Rebid', 'SetPrequalificationRequired', 'ReviewPrequalification', 'Award', 'Execute', 'FormCommittee', 'SubmitScores', 'SendInquiry']) {
    mocks[`useBuyerTender${name}`] = () => ({});
  }
  return { ...api, ...mocks,
    useBuyerTenderSubmitScores: () => ({ mutate: state.submitScores }),
    useBuyerTenderList: () => ({ isError: state.failed, data: { data: [{ id: 't-1', title: '只读招标', status: state.mixed ? '评标中' : state.awarded ? '已定标' : '编制中', tenderNo: 'T001',
      awardedBidId: state.awarded ? 'b-1' : null,
      openedAt: state.awarded || state.mixed ? '2026-01-01' : null,
      bids: state.mixed ? [
        { id: 'valid', bidAmount: 100, supplierName: '有效供应商', sealedStatus: '已开启', evaluationEligible: !state.noneEligible },
        ...['指纹异常', '迟到', '无资格', '资格未知'].map((name, i) => ({
          id: `invalid-${i}`, bidAmount: 100, supplierName: name, sealedStatus: '已开启',
          evaluationEligible: i === 3 ? undefined : false,
        })),
      ] : [{ id: 'b-1', bidAmount: 100, supplierName: '供应商' }],
      evaluators: state.mixed ? state.evaluatorCounts.map((scoredCount, i) => ({
        id: `e-${i + 1}`, evaluatorName: i === 0 ? '评委一' : `评委${i + 1}`, scoredCount,
      })) : [],
      evaluationSummary: [{ bidId: 'b-1', effectiveAmount: 80 }],
    }] } }),
    useBuyerEsignSign: () => ({}),
    useBuyerEsignList: () => ({ data: { data: [] } }),
    useRfqListAnnouncements: () => ({ data: { data: [] } }),
    useBuyerAttachmentList: () => ({ data: { data: [] } }),
    useBuyerSupplierList: (_: unknown, options: { query: { enabled: boolean } }) => {
      state.suppliersEnabled = options.query.enabled;
      return { data: { data: [] } };
    },
  };
});
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); state.manage = false; state.failed = false; state.awarded = false; state.mixed = false; state.noneEligible = false; state.evaluatorCounts = [1]; state.submitScores.mockClear(); });

it('opens a linked tender directly and clears only its record when returning', () => {
  window.history.replaceState(null, '', '/?module=tenders&recordId=t-1&solution=base');
  show();
  expect(screen.getByRole('heading', { name: '只读招标' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '返回招标台账' }));
  expect(new URLSearchParams(window.location.search).get('recordId')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('solution')).toBe('base');
});

it('does not silently fall back to the list for an unavailable linked tender', () => {
  window.history.replaceState(null, '', '/?module=tenders&recordId=missing');
  show();
  expect(screen.getByText('未找到该招标项目或无权查看。')).toBeVisible();
});
const show = () => render(<QueryClientProvider client={new QueryClient()}><TendersPage /></QueryClientProvider>);

it('does not expose edit or create actions to read-only users', () => {
  show();
  expect(screen.getAllByText('只读招标').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /新建/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /编辑/ })).toBeNull();
  expect(state.suppliersEnabled).toBe(false);
});

it('shows a failure instead of cached tender data', () => {
  state.failed = true;
  show();
  expect(screen.queryByText('只读招标')).toBeNull();
  expect(screen.getByText(/加载失败/)).toBeTruthy();
});

it('shows the effective awarded amount after a revised quote', () => {
  state.awarded = true;
  show();
  fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
  const label = screen.getByText('中标价');
  expect(label.parentElement?.textContent).toContain('80');
  expect(label.parentElement?.textContent).not.toContain('100');
});

it('renders and submits only authoritative eligible bids in a mixed opening roll', () => {
  state.manage = true; state.mixed = true;
  show();
  fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
  expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  for (const name of ['指纹异常', '迟到', '无资格', '资格未知']) {
    expect(screen.queryByLabelText(`技术分-${name}`)).toBeNull();
    expect(screen.queryByRole('option', { name })).toBeNull();
  }
  expect(screen.getByText('委员会 1 人 · 已交卷 1 人')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('技术分-有效供应商'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('商务分-有效供应商'), { target: { value: '90' } });
  fireEvent.click(screen.getByRole('button', { name: '提交「评委一」评分' }));
  expect(state.submitScores).toHaveBeenCalledWith({ tenderId: 't-1', data: {
    evaluatorId: 'e-1', lines: [{ bidId: 'valid', technicalScore: 80, commercialScore: 90, comment: undefined }],
  } }, expect.anything());
});

it('does not submit or report completed evaluators when no opened bid is eligible', () => {
  state.manage = true; state.mixed = true; state.noneEligible = true;
  show();
  fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
  expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  expect(screen.getByText('委员会 1 人 · 已交卷 0 人')).toBeTruthy();
  const submit = screen.getByRole('button', { name: '提交「评委一」评分' });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(submit);
  expect(state.submitScores).not.toHaveBeenCalled();
});

it.each([
  { counts: [1, 1, 1], noneEligible: false, completed: 3 },
  { counts: [1, 1, 0], noneEligible: false, completed: 2 },
  { counts: [1, 1, 1], noneEligible: true, completed: 0 },
])('uses authoritative eligibility for three-evaluator stepper progress: $completed/3', ({ counts, noneEligible, completed }) => {
  state.mixed = true; state.evaluatorCounts = counts; state.noneEligible = noneEligible;
  show();
  fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
  expect(screen.getByText(`评委交卷 ${completed}/3`)).toBeTruthy();
  expect(screen.getByText(`委员会 3 人 · 已交卷 ${completed} 人`)).toBeTruthy();
  expect(screen.getByText('已开启投标 5 份')).toBeTruthy();
});
