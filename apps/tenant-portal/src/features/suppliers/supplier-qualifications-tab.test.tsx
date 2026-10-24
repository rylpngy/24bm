import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierQualificationsTab } from './supplier-qualifications-tab';

const mocks = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
vi.mock('@24bid/api-client', () => ({ downloadReport: mocks.download, buyerQualificationArchive: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => false }) }));
vi.mock('./qualification-review-panel', () => ({ QualificationReviewPanel: () => null }));
vi.mock('./qualification-supplement-panel', () => ({ QualificationSupplementPanel: () => null }));
vi.mock('../attachments/owner-attachments', () => ({ OwnerAttachments: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function dateIn(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function mount() {
  mocks.query.mockReturnValue({ data: [
    { id: 'expired', qualificationType: '过期执照', expiresAt: dateIn(-1), status: 'active', fileName: '原件.pdf' },
    { id: 'due', qualificationType: '临期许可', expiresAt: dateIn(5), status: 'active' },
    { id: 'unknown', qualificationType: '待补日期', status: 'active' },
    { id: 'old', qualificationType: '旧版执照', expiresAt: dateIn(-1), status: 'inactive', fileName: '旧版.pdf' },
  ] });
  render(<SupplierQualificationsTab relationId="relation-1" />);
}
it('separates historical certificates from current expiry filters', () => {
  mount();
  expect(screen.queryByText('旧版执照')).toBeNull();
  fireEvent.change(screen.getByLabelText('证照有效期'), { target: { value: 'expired' } });
  expect(screen.getByText('过期执照')).toBeTruthy();
  expect(screen.queryByText('临期许可')).toBeNull();
  fireEvent.change(screen.getByLabelText('证照有效期'), { target: { value: 'expiring' } });
  expect(screen.getByText('临期许可')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('证照有效期'), { target: { value: 'unknown' } });
  expect(screen.getByText('待补日期')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /历史\/停用/ }));
  expect(screen.getByText('旧版执照')).toBeTruthy();
  expect(screen.queryByText('过期执照')).toBeNull();
  expect((screen.getByLabelText('证照有效期') as HTMLSelectElement).value).toBe('all');
  expect(screen.getByText('非当前资质')).toBeTruthy();
});
it('downloads historical originals through the authorized relation endpoint and reports failures', async () => {
  mount(); mocks.download.mockRejectedValue(new Error('denied'));
  fireEvent.click(screen.getByRole('tab', { name: /历史\/停用/ }));
  fireEvent.click(screen.getByRole('button', { name: '下载原件' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('原件下载失败'));
  expect(mocks.download).toHaveBeenCalledWith('/api/v1/buyer/suppliers/relation-1/qualifications/old/download', '旧版.pdf');
});
it('paginates certificates and resets pagination after filtering', () => {
  mocks.query.mockReturnValue({ data: Array.from({ length: 9 }, (_, i) => ({ id: String(i), qualificationType: `证书-${i}`, status: 'active', expiresAt: i === 0 ? undefined : dateIn(60) })) });
  render(<SupplierQualificationsTab relationId="relation-1" />);
  expect(screen.queryByText('证书-8')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  expect(screen.getByText('证书-8')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('证照有效期'), { target: { value: 'unknown' } });
  expect(screen.getByText('证书-0')).toBeTruthy();
  expect(screen.queryByText('证书-8')).toBeNull();
});
