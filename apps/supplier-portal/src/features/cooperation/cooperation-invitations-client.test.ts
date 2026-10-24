import { expect, it, vi } from 'vitest';
import { customInstance } from '../../../../../packages/api-client/src/http-client';
import { listSupplierCooperationInvitations, respondSupplierCooperationInvitation } from '../../../../../packages/api-client/src/supplier-cooperation-invitations';
vi.mock('../../../../../packages/api-client/src/http-client', () => ({ customInstance: vi.fn() }));
it('lists through the authenticated supplier context, never a caller-supplied enterprise', async () => {
  const signal = new AbortController().signal; await listSupplierCooperationInvitations(signal);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/supplier/cooperation-invitations', method: 'GET', signal });
});
it.each(['accept', 'decline'] as const)('posts only %s to the encoded invitation', async action => {
  await respondSupplierCooperationInvitation('i/a', action);
  expect(customInstance).toHaveBeenLastCalledWith({ url: '/api/v1/supplier/cooperation-invitations/i%2Fa/respond', method: 'POST', data: { action } });
});
