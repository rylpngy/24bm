import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhysicalAfterSalesPanel } from './physical-after-sales-panel';

describe('physical after-sales', () => {
  it('shows only server-authorized actions and immutable evidence downloads', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        stage: 'return_dispatch',
        actions: [],
        financialStatus: '等待签收与退款核对',
        events: [
          {
            id: 'e',
            kind: 'return_dispatch',
            quantity: 1,
            referenceNo: 'TRACK-1',
            note: '原件',
            fileName: 'receipt.pdf',
            sha256: 'abc123',
            actorRole: 'buyer',
            actorId: 'buyer1',
            createdAt: 'yesterday',
          },
        ],
      });
    const download = vi.fn().mockResolvedValue(undefined);
    render(
      <PhysicalAfterSalesPanel
        root="/buyer"
        id="a"
        quantity={1}
        canManage
        request={request}
        download={download}
      />,
    );
    expect(await screen.findByText('等待签收与退款核对')).toBeTruthy();
    expect(screen.queryByText('登记交接')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '凭证' }));
    await waitFor(() =>
      expect(download).toHaveBeenCalledWith(
        '/buyer/a/physical/e/file',
        'receipt.pdf',
      ),
    );
  });
  it('reports loading failure without pretending the case is complete', async () => {
    render(
      <PhysicalAfterSalesPanel
        root="/buyer"
        id="a"
        quantity={1}
        canManage
        request={vi.fn().mockRejectedValue(new Error('offline'))}
        download={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
    expect(screen.queryByText('登记交接')).toBeNull();
  });
});
