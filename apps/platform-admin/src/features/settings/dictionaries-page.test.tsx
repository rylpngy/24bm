import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DictionariesPage } from './dictionaries-page';

const state = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), error: false, pending: false,
  type: 'announcement_audience', entry: { code: 'buyer', label: '采购方', sortOrder: 20, status: 'active' } }));
vi.mock('@24bid/api-client', () => ({
  usePlatformDictionaryTypes: () => ({ data: { data: [{ type: state.type, entryCount: 1, activeCount: 1 }] }, isError: state.error }),
  usePlatformDictionaryEntries: () => ({ data: { data: [state.entry] } }),
  usePlatformDictionaryCreate: () => ({ mutate: state.create }),
  usePlatformDictionaryUpdate: () => ({ mutate: state.update, isPending: state.pending }),
}));
beforeEach(() => { vi.clearAllMocks(); state.error = false; state.pending = false; state.type = 'announcement_audience'; state.entry = { code: 'buyer', label: '采购方', sortOrder: 20, status: 'active' };
  state.update.mockImplementation(({ data }, callbacks) => { state.entry = { ...state.entry, ...data }; callbacks.onSuccess(); });
});
afterEach(cleanup);
const show = (canManage = false) => render(<QueryClientProvider client={new QueryClient()}><DictionariesPage {...{ canManage }} /></QueryClientProvider>);
it('read-only dictionary users see labels without editable fields or write actions', () => {
  show(); expect(screen.getByText('采购方')).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: '新增条目' })).toBeNull();
  expect(screen.queryByRole('button', { name: '停用' })).toBeNull();
});
it('fixed dictionaries cannot add unsupported codes', () => {
  show(true); expect(screen.queryByRole('button', { name: '新增条目' })).toBeNull();
  expect(screen.getByLabelText('名称-buyer')).toBeTruthy();
});
it('successful edits clear drafts so later toggles cannot resurrect stale labels', async () => {
  show(true); fireEvent.change(screen.getByLabelText('名称-buyer'), { target: { value: '采购企业' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '保存' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '停用' }));
  expect(state.update.mock.calls[1][0].data.label).toBe('采购企业');
});
it('failed writes retain the draft and display the actual error', async () => {
  state.update.mockImplementation((_args, callbacks) => callbacks.onError({ response: { data: { message: '并发冲突' } } }));
  show(true); fireEvent.change(screen.getByLabelText('名称-buyer'), { target: { value: '草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('并发冲突');
  expect(screen.getByLabelText('名称-buyer')).toHaveValue('草稿');
});
it('loading errors do not show stale entries', () => {
  state.error = true; show(true);
  expect(screen.getByRole('alert')).toHaveTextContent('字典加载失败');
  expect(screen.queryByLabelText('名称-buyer')).toBeNull();
});
it('locks editable fields and type switching while a dictionary write is pending', () => {
  state.pending = true; show(true);
  expect(screen.getByLabelText('名称-buyer')).toBeDisabled();
  expect(screen.getByLabelText('排序-buyer')).toBeDisabled();
  expect(screen.getByRole('button', { name: /announcement_audience/ })).toBeDisabled();
});
