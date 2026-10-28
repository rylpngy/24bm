import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { RfqsPage } from './rfqs-page';

vi.mock('@24bid/api-client', () => ({
  useRfqList: () => ({ data: { data: [{ id: 'rfq-1', title: '导航验收询比', status: '草稿' }] } }),
  usePurchaseDemandList: () => ({ data: { data: [] } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
}));
vi.mock('./rfq-project-detail', () => ({ RfqProjectDetail: ({ onBack, onResumeDraft }: { onBack: () => void; onResumeDraft: () => void }) => <div>询比详情样本<button onClick={onBack}>返回询比项目列表</button><button onClick={onResumeDraft}>继续编辑草稿</button></div> }));
vi.mock('./rfq-create-wizard', () => ({ RfqCreateWizard: () => <p>询比草稿编辑样本</p> }));
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

it.each(['返回询比项目列表', '继续编辑草稿'])('clears the deep-link record on %s without losing the solution', (action) => {
  window.history.replaceState(null, '', '/?solution=ludong-poc&module=rfqs&recordId=rfq-1');
  render(<QueryClientProvider client={new QueryClient()}><RfqsPage /></QueryClientProvider>);
  expect(screen.getByText('询比详情样本')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: action }));
  expect(screen.queryByText('询比详情样本')).not.toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('recordId')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('solution')).toBe('ludong-poc');
  if (action === '继续编辑草稿') expect(screen.getByText('询比草稿编辑样本')).toBeVisible();
  else expect(screen.getByText('询比项目')).toBeVisible();
});
