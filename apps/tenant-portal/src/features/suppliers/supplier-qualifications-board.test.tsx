import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierQualificationsBoard } from './supplier-qualifications-board';
vi.mock('./qualification-review-panel', () => ({ QualificationReviewPanel: () => null }));

const mocks = vi.hoisted(() => ({ listError: false, certError: false, retry: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useBuyerSupplierList: () => ({ isError: mocks.listError, refetch: mocks.retry, data: { data: [
    { id: 'pending', supplierName: '待准入企业', status: '待准入' },
    { id: 'approved', supplierName: '合作企业', status: '已准入' },
  ] } }),
  useBuyerSupplierListRelationQualifications: () => ({ isError: mocks.certError, refetch: mocks.retry, data: { data: [] } }),
}));
afterEach(() => { cleanup(); mocks.listError = false; mocks.certError = false; vi.clearAllMocks(); });

it('includes pending suppliers and filters admission status', () => {
  const open = vi.fn();
  render(<SupplierQualificationsBoard onOpen={open} />);
  fireEvent.click(screen.getByRole('button', { name: /待准入企业.*详情/ }));
  expect(open).toHaveBeenCalledWith('pending');
  fireEvent.change(screen.getByRole('combobox', { name: '准入状态' }), { target: { value: '已准入' } });
  expect(screen.queryByText('待准入企业')).toBeNull();
  expect(screen.getByText('合作企业')).toBeTruthy();
});

it('shows a retry instead of an empty ledger when the supplier request fails', () => {
  mocks.listError = true;
  render(<SupplierQualificationsBoard onOpen={() => {}} />);
  expect(screen.getByRole('alert').textContent).toContain('供应商台账加载失败');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(mocks.retry).toHaveBeenCalledOnce();
  expect(screen.queryByText('暂无资质证照。')).toBeNull();
});

it('does not present a failed certificate request as no qualifications', () => {
  mocks.certError = true;
  render(<SupplierQualificationsBoard onOpen={() => {}} />);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(screen.queryByText('暂无资质证照。')).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: '重试' })[0]);
  expect(mocks.retry).toHaveBeenCalledOnce();
});
