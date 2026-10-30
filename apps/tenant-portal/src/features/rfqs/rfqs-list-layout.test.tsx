import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { RfqsPage } from './rfqs-page';

const projects = vi.hoisted(() => Array.from({ length: 8 }, (_, index) => ({
  id: `rfq-${index + 1}-long-project-identifier-123456789`,
  title: `测试${String(index + 1).padStart(2, '0')}教学终端与实验采集设备询比项目完整名称`,
  status: index === 0 ? '定标审批中' : index === 1 ? '报价中' : '已开标',
  method: '询比', evaluationMethod: '综合评审', deadlineAt: '2026-11-03T10:00:00Z',
})));
vi.mock('@24bid/api-client', () => ({
  useRfqList: () => ({ data: { data: projects } }),
  usePurchaseDemandList: () => ({ data: { data: [] } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
}));
vi.mock('./rfq-project-detail', () => ({ RfqProjectDetail: ({ rfq }: { rfq: { id: string } }) => <p>已打开项目 {rfq.id}</p> }));
vi.mock('./rfq-create-wizard', () => ({ RfqCreateWizard: () => <p>新建询比</p> }));
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });
function show() {
  window.history.replaceState(null, '', '/?solution=ludong-poc&module=rfqs');
  render(<QueryClientProvider client={new QueryClient()}><RfqsPage /></QueryClientProvider>);
}

it('constrains columns, preserves full text and keeps compact detail actions', () => {
  show();
  const table = screen.getByRole('table', { name: '询比项目列表' });
  expect(table).toHaveClass('table-fixed', 'whitespace-nowrap');
  expect(table.querySelectorAll('col')).toHaveLength(7);
  expect(screen.getByTitle(projects[0].id)).toHaveClass('truncate');
  expect(screen.getByTitle(projects[0].title)).toHaveClass('truncate');
  expect(screen.getByTitle('定标审批中').parentElement).not.toHaveClass('flex-wrap');
  const buttons = within(table).getAllByRole('button', { name: /^详情：/ });
  expect(buttons).toHaveLength(6);
  expect(buttons[0]).toHaveTextContent(/^详情$/);
  expect(buttons[0]).toHaveClass('whitespace-nowrap', 'w-14');
  fireEvent.click(buttons[0]);
  expect(screen.getByText(`已打开项目 ${projects[0].id}`)).toBeVisible();
});

it('preserves pagination and continuous row numbers', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent(/^7$/);
  expect(screen.getByTitle(projects[7].title)).toBeVisible();
});

it('searches full project names despite visual truncation and resets pagination', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  fireEvent.change(screen.getByPlaceholderText('按标题 / 编号 / 方式 / 要求搜索'), { target: { value: '测试08' } });
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  expect(screen.getByTitle(projects[7].title)).toBeVisible();
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  expect(rows).toHaveLength(2);
  expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent(/^1$/);
});

it('retains status filtering', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '报价中' }));
  expect(screen.getByTitle(projects[1].title)).toBeVisible();
  expect(screen.queryByTitle(projects[0].title)).not.toBeInTheDocument();
});
