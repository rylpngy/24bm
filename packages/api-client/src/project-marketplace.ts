import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface ProjectMallPurchaseRecord {
  projectId: string;
  packageId: string;
  rfqId: string;
  orderId: string;
  snapshot: string;
  reason: string;
  actorId: string;
  createdAt: string;
}
export interface ProjectMallCheckout {
  revision: number;
  requestKey: string;
  reason: string;
  items: Array<{ skuId: string; quantity: number }>;
  expectedReceiptDate?: string;
  addressId?: string;
}
export async function projectMallSelection(project: string, id: string) {
  return (
    await customInstance<ApiEnvelope<ProjectMallPurchaseRecord | null>>({
      url: `/api/v1/buyer/projects/${encodeURIComponent(project)}/packages/${encodeURIComponent(id)}/mall-selection`,
      method: 'GET',
    })
  ).data;
}
export async function projectMallCheckout(
  project: string,
  id: string,
  data: ProjectMallCheckout,
) {
  return (
    await customInstance<ApiEnvelope<ProjectMallPurchaseRecord>>({
      url: `/api/v1/buyer/projects/${encodeURIComponent(project)}/packages/${encodeURIComponent(id)}/mall-checkout`,
      method: 'POST',
      data,
    })
  ).data;
}
