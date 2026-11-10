import { customInstance, axiosInstance, downloadReport } from "./http-client";
import type { ApiEnvelope } from "./workflow-runtime";
export type AgencyMember = {
  userId: string;
  role: "EDITOR" | "VIEWER" | "DRAFTER" | "OFFICE";
};
export interface AgencyDraft {
  expectedVersion?: number;
  groupId?: string;
  title: string;
  businessCategory?: string;
  objectCode?: string;
  procurementMethod?: string;
  regime?: string;
  region?: string;
  operatingMode: string;
  departmentId?: string;
  ownerId?: string;
  budget?: string | null;
  ceiling?: string | null;
  currency: string;
  purchaser: Record<string, string>;
  entrustment: Record<string, string>;
  feeAgreement: Record<string, string>;
  supplement: Record<string, string>;
  members: AgencyMember[];
}
export interface AgencyPackage {
  id: string;
  createdBy?: string;
  groupId?: string;
  title: string;
  number?: string;
  status: string;
  version: number;
  workflowId?: string;
  ownerId?: string;
  budget?: string;
  currency: string;
  procurementMethod?: string;
  businessStatus: string;
  archiveCompletion: string;
  financialStatus: string;
}
export interface AgencyFileVersion {
  id: string;
  ordinal: number;
  status: string;
  attachmentId?: string;
  hash?: string;
  contentSize?: number;
  createdAt: string;
  reason?: string;
}
export interface AgencyFile {
  file: { id: string; name: string; category: string; visibility: string };
  versions: AgencyFileVersion[];
}
export interface AgencyReview {
  id: string;
  kind: string;
  status: string;
  workflowId?: string;
  createdAt: string;
  comment?: string;
  snapshotJson: string;
}
export interface AgencyDetail {
  record: AgencyPackage;
  data: AgencyDraft;
  members: { userId: string; role: string; name: string }[];
  reviews: AgencyReview[];
  history: {
    version: number;
    reason: string;
    actorId: string;
    createdAt: string;
    dataJson: string;
  }[];
  files: AgencyFile[];
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canManageFiles: boolean;
  businessStatus: string;
  archiveCompletion: string;
  financialStatus: string;
}
export interface AgencyGroup {
  id: string;
  name: string;
  tags: string;
}
export interface AgencyNumbering {
  pattern: string;
  timeZone: string;
  categories: string;
  objects: string;
  version: number;
}
export interface AgencyOptions {
  users: { id: string; name: string; departmentId: string }[];
  departments: { id: string; name: string }[];
  numbering: AgencyNumbering;
  procurementMethods: string[];
}
const base = "/api/v1/buyer/agency";
export async function agencyRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await customInstance<ApiEnvelope<T> & { success?: boolean }>(
    { url: base + path, method, data },
  );
  if (response.success === false) throw Error(response.message || "操作失败");
  return response.data!;
}
export const agencyOptions = () => agencyRequest<AgencyOptions>("/options");
export const agencyGroups = (keyword = "") =>
  agencyRequest<AgencyGroup[]>(
    "/groups?keyword=" + encodeURIComponent(keyword),
  );
export const agencyCreateGroup = (name: string, tags = "") =>
  agencyRequest<AgencyGroup>("/groups", "POST", { name, tags });
export const agencyDetail = (id: string) =>
  agencyRequest<AgencyDetail>("/packages/" + encodeURIComponent(id));
export const agencyList = (params: Record<string, string | number>) =>
  agencyRequest<{
    items: AgencyPackage[];
    total: number;
    page: number;
    pageSize: number;
  }>(
    "/packages?" +
      new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
  );
export const agencySave = (id: string | null, draft: AgencyDraft) =>
  agencyRequest<AgencyDetail>(
    id ? "/packages/" + encodeURIComponent(id) : "/packages",
    id ? "PUT" : "POST",
    draft,
  );
export const agencySubmit = (
  id: string,
  expectedVersion: number,
  idempotencyKey: string,
  formData: Record<string, unknown>,
) =>
  agencyRequest<AgencyDetail>(`/packages/${id}/submit`, "POST", {
    expectedVersion,
    idempotencyKey,
    formData,
  });
export const agencyWithdraw = (
  id: string,
  expectedVersion: number,
  reason: string,
) =>
  agencyRequest<AgencyDetail>(`/packages/${id}/withdraw`, "POST", {
    expectedVersion,
    reason,
  });
export const agencyChange = (
  id: string,
  proposed: AgencyDraft,
  idempotencyKey: string,
  reason: string,
  formData: Record<string, unknown>,
) =>
  agencyRequest<AgencyDetail>(`/packages/${id}/changes`, "POST", {
    proposed,
    idempotencyKey,
    reason,
    formData,
  });
export const agencyFileNew = (
  id: string,
  name: string,
  category: string,
  visibility: string,
) =>
  agencyRequest<AgencyFile>(`/packages/${id}/files`, "POST", {
    name,
    category,
    visibility,
  });
export const agencyFileNext = (
  id: string,
  expectedOrdinal: number,
  reason: string,
) =>
  agencyRequest<AgencyFileVersion>(`/files/${id}/versions`, "POST", {
    expectedOrdinal,
    reason,
  });
export const agencyFileCancel = (id: string, reason: string) =>
  agencyRequest<void>(`/file-versions/${id}/cancel`, "POST", { reason });
export async function agencyFileUpload(version: string, file: File) {
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw Error("File size must be between 1 byte and 10 MB");
  const envelope = await customInstance<
    ApiEnvelope<{ uploadUrl: string; storageKey: string }>
  >({
    url: "/api/v1/buyer/attachments/upload-ticket",
    method: "POST",
    data: {
      ownerType: "agency_file_version",
      ownerId: version,
      fileName: file.name,
      visibility: "buyer_internal",
    },
  });
  const ticket = envelope.data!;
  await axiosInstance.post(ticket.uploadUrl, await file.arrayBuffer(), {
    headers: { "Content-Type": "application/octet-stream" },
  });
  const registered = await customInstance<ApiEnvelope<{ id: string }>>({
    url: "/api/v1/buyer/attachments",
    method: "POST",
    data: {
      ownerType: "agency_file_version",
      ownerId: version,
      fileName: file.name,
      storageKey: ticket.storageKey,
      visibility: "buyer_internal",
    },
  });
  return agencyRequest<AgencyFileVersion>(
    `/file-versions/${version}/seal`,
    "POST",
    { attachmentId: registered.data!.id },
  );
}
export const agencyFileDownload = (id: string, name: string) =>
  downloadReport("/api/v1/buyer/attachments/" + id + "/download", name);

export const agencyBatch = (packages: AgencyDraft[], idempotencyKey: string) =>
  agencyRequest<AgencyDetail[]>("/packages/batch", "POST", {
    packages,
    idempotencyKey,
  });
