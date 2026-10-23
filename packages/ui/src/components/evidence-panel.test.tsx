import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EvidencePanel } from './evidence-panel';
afterEach(cleanup);
const props = () => ({ files: [{ id: 'a', round: 1, fileName: 'proof.pdf', size: 123, sha256: 'abc', uploaderName: '张三', createdAt: '2026-10-23T10:00:00' }], loading: false, busy: false, error: '', upload: vi.fn(), download: vi.fn(), refresh: vi.fn() });
it('keeps the buyer read-only and downloads the selected evidence', () => {
  const p = props(); render(<EvidencePanel {...p} />);
  expect(screen.queryByLabelText('上传整改材料')).toBeNull();
  expect(screen.getByText('第1轮 · proof.pdf')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '下载 proof.pdf' }));
  expect(p.download).toHaveBeenCalledWith(p.files[0]);
});
it('uploads a selected file and prevents clicks while busy', () => {
  const p = props(); const view = render(<EvidencePanel {...p} canUpload />);
  const file = new File(['proof'], 'proof.pdf');
  fireEvent.change(screen.getByLabelText('上传整改材料'), { target: { files: [file] } });
  expect(p.upload).toHaveBeenCalledWith(file);
  view.rerender(<EvidencePanel {...p} canUpload busy error="上传失败" />);
  expect((screen.getByLabelText('上传整改材料') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toBe('上传失败');
});
