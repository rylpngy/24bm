import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierAdmissionSubmitDialog } from './supplier-admission-submit-dialog';

const mocks = vi.hoisted(() => ({ read: true }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.read }) }));
const old = { status: 'rejected', formData: { evidence: '旧材料', removed: '旧字段' }, events: [{ action: 'rejected', comment: '补充证明材料' }] };
vi.mock('@24bid/api-client', () => ({
  useWorkflowBusinessHistory: (type?: string) => ({ data: { data: type ? old : undefined } }),
  useWorkflowRuntimePublishedForm: () => ({ data: { data: { definitionVersionId: 'version-2', formSchema: JSON.stringify({ fields: [{ id: 'evidence', label: '材料说明', type: 'textarea', required: true }] }) } } }),
}));
afterEach(() => { cleanup(); mocks.read = true; });
it('shows rejection reason and restores only current schema fields on resubmit', () => {
  const submit = vi.fn();
  render(<SupplierAdmissionSubmitDialog relationId="rel-1" title="供应商" onClose={() => {}} onSubmit={submit} />);
  expect(screen.getByText(/补充证明材料/)).toBeTruthy();
  expect((screen.getByLabelText('材料说明', { exact: false }) as HTMLTextAreaElement).value).toBe('旧材料');
  fireEvent.change(screen.getByLabelText('材料说明', { exact: false }), { target: { value: '已补材料' } });
  fireEvent.click(screen.getByRole('button', { name: '确认提交' }));
  expect(submit).toHaveBeenCalledWith({ evidence: '已补材料' });
});
it('does not require workflow-read permission to fill a new application', () => {
  mocks.read = false;
  render(<SupplierAdmissionSubmitDialog relationId="rel-1" title="供应商" onClose={() => {}} onSubmit={() => {}} />);
  expect((screen.getByLabelText('材料说明', { exact: false }) as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByRole('button', { name: '确认提交' }) as HTMLButtonElement).disabled).toBe(false);
});
