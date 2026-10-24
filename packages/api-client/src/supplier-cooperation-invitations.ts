import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
import type { SupplierInvitationResponse } from './generated/model/supplierInvitationResponse';

export interface SupplierCooperationInvitation extends SupplierInvitationResponse { buyerName: string }
export type SupplierInvitationAction = 'accept' | 'decline';
export const supplierCooperationInvitationsKey = ['/api/v1/supplier/cooperation-invitations'] as const;
export const listSupplierCooperationInvitations = (signal?: AbortSignal) =>
  customInstance<ApiEnvelope<SupplierCooperationInvitation[]>>({ url: supplierCooperationInvitationsKey[0], method: 'GET', signal });
export const respondSupplierCooperationInvitation = (id: string, action: SupplierInvitationAction) =>
  customInstance<ApiEnvelope<SupplierCooperationInvitation>>({
    url: `${supplierCooperationInvitationsKey[0]}/${encodeURIComponent(id)}/respond`, method: 'POST', data: { action },
  });
