import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';

// 统一工作流门面的手写契约。它与 OpenAPI 生成客户端并存，直到下一次后端
// OpenAPI 导出后由生成代码接管；业务页面只依赖这里的稳定语义。
export interface ApiEnvelope<T> {
  data?: T;
  message?: string;
}

export interface WorkflowProcessDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status: string;
  businessType?: string;
  activeVersionId?: string;
  formSchema: string;
  flowSchema: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface WorkflowDefinitionVersion {
  id: string;
  businessType: string;
  versionNo: number;
  status: string;
  flowableProcessDefinitionId?: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface WorkflowTask {
  taskId: string;
  workflowInstanceId: string;
  businessType: string;
  businessId: string;
  taskName: string;
  taskDefinitionKey: string;
  assigneeId?: string;
  candidateUserIds: string[];
  candidateRoleIds: string[];
  amount?: number;
  departmentId?: string;
  createdAt?: string;
}

export interface WorkflowTaskEvent {
  id: string;
  flowableTaskId?: string;
  nodeId?: string;
  nodeName?: string;
  action: 'created' | 'claimed' | 'approved' | 'rejected' | 'completed';
  actorId?: string;
  actorName?: string;
  comment?: string;
  createdAt?: string;
}

export interface WorkflowAttachment {
  id: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
  visibility?: string;
  createdAt?: string;
}

export interface WorkflowInstanceHistory {
  workflowInstanceId: string;
  businessType: string;
  businessId: string;
  definitionVersionId: string;
  flowableProcessInstanceId: string;
  status: 'processing' | 'approved' | 'rejected' | 'cancelled';
  initiatorId: string;
  initiatorName?: string;
  completedBy?: string;
  completedByName?: string;
  departmentId?: string;
  amount?: number;
  formData: Record<string, unknown>;
  businessSnapshot: Record<string, unknown>;
  attachments: WorkflowAttachment[];
  currentTask?: WorkflowTask;
  createdAt?: string;
  completedAt?: string;
  events: WorkflowTaskEvent[];
}

export type WorkflowLedgerView = 'pending' | 'processed' | 'initiated' | 'all';

export interface WorkflowInstanceLedgerItem {
  workflowInstanceId: string;
  businessType: string;
  businessId: string;
  definitionVersionId: string;
  status: 'processing' | 'approved' | 'rejected' | 'cancelled';
  initiatorId: string;
  initiatorName?: string;
  completedBy?: string;
  completedByName?: string;
  departmentId?: string;
  amount?: number;
  currentTask?: WorkflowTask;
  createdAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface WorkflowPublishedForm {
  businessType: string;
  definitionVersionId?: string;
  formSchema: string;
  publishedAt?: string;
}

export interface WorkflowProcessDefinitionDraft {
  name: string;
  description?: string;
  icon?: string;
  businessType?: string;
}

export interface WorkflowProcessDefinitionUpdate {
  name: string;
  description?: string;
  status: 'draft' | 'disabled';
  formSchema: string;
  flowSchema: string;
  businessType?: string;
}

const processDefinitionsKey = ['/api/v1/buyer/process-definitions'] as const;
const workflowTasksKey = ['/api/v1/buyer/workflow/tasks'] as const;

export const listWorkflowProcessDefinitions = (signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowProcessDefinition[]>>({
    url: '/api/v1/buyer/process-definitions',
    method: 'GET',
    signal,
  });

export const getWorkflowProcessDefinition = (id: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowProcessDefinition>>({
    url: `/api/v1/buyer/process-definitions/${id}`,
    method: 'GET',
    signal,
  });

export const createWorkflowProcessDefinition = (data: WorkflowProcessDefinitionDraft) =>
  customInstance<ApiEnvelope<WorkflowProcessDefinition>>({
    url: '/api/v1/buyer/process-definitions',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const updateWorkflowProcessDefinition = (
  id: string,
  data: WorkflowProcessDefinitionUpdate,
) =>
  customInstance<ApiEnvelope<WorkflowProcessDefinition>>({
    url: `/api/v1/buyer/process-definitions/${id}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const publishWorkflowProcessDefinition = (id: string) =>
  customInstance<ApiEnvelope<WorkflowProcessDefinition>>({
    url: `/api/v1/buyer/process-definitions/${id}/publish`,
    method: 'POST',
  });

export const listWorkflowDefinitionVersions = (id: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowDefinitionVersion[]>>({
    url: `/api/v1/buyer/process-definitions/${id}/versions`,
    method: 'GET',
    signal,
  });

export function useWorkflowProcessDefinitions() {
  return useQuery({ queryKey: processDefinitionsKey, queryFn: ({ signal }) => listWorkflowProcessDefinitions(signal) });
}

export function useWorkflowProcessDefinition(id?: string) {
  return useQuery({
    queryKey: [...processDefinitionsKey, id],
    queryFn: ({ signal }) => getWorkflowProcessDefinition(id!, signal),
    enabled: Boolean(id),
  });
}

export function useWorkflowProcessDefinitionVersions(id?: string) {
  return useQuery({
    queryKey: [...processDefinitionsKey, id, 'versions'],
    queryFn: ({ signal }) => listWorkflowDefinitionVersions(id!, signal),
    enabled: Boolean(id),
  });
}

export const useWorkflowProcessDefinitionCreate = () =>
  useMutation({ mutationKey: ['workflow-process-definition-create'], mutationFn: createWorkflowProcessDefinition });

export const useWorkflowProcessDefinitionUpdate = () =>
  useMutation({
    mutationKey: ['workflow-process-definition-update'],
    mutationFn: ({ id, data }: { id: string; data: WorkflowProcessDefinitionUpdate }) =>
      updateWorkflowProcessDefinition(id, data),
  });

export const useWorkflowProcessDefinitionPublish = () =>
  useMutation({
    mutationKey: ['workflow-process-definition-publish'],
    mutationFn: publishWorkflowProcessDefinition,
  });

export const listUnifiedWorkflowTasks = (signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowTask[]>>({
    url: '/api/v1/buyer/workflow/tasks',
    method: 'GET',
    signal,
  });

export const completeUnifiedWorkflowTask = (
  taskId: string,
  data: { action: 'approve' | 'reject'; comment?: string },
) =>
  customInstance<ApiEnvelope<WorkflowInstanceHistory>>({
    url: `/api/v1/buyer/workflow/tasks/${taskId}/complete`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const getUnifiedWorkflowInstanceHistory = (workflowInstanceId: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowInstanceHistory>>({
    url: `/api/v1/buyer/workflow/instances/${workflowInstanceId}/history`,
    method: 'GET',
    signal,
  });

export const getUnifiedWorkflowBusinessHistory = (
  businessType: string,
  businessId: string,
  signal?: AbortSignal,
) =>
  customInstance<ApiEnvelope<WorkflowInstanceHistory | null>>({
    url: `/api/v1/buyer/workflow/instances/business/${businessType}/${businessId}/history`,
    method: 'GET',
    signal,
  });

export const listUnifiedWorkflowInstances = (view: WorkflowLedgerView, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowInstanceLedgerItem[]>>({
    url: '/api/v1/buyer/workflow/instances',
    method: 'GET',
    params: { view, limit: 200 },
    signal,
  });

export const getUnifiedWorkflowPublishedForm = (businessType: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<WorkflowPublishedForm>>({
    url: `/api/v1/buyer/workflow/definitions/${businessType}/form`,
    method: 'GET',
    signal,
  });

export function useWorkflowRuntimeTasks(enabled = true) {
  return useQuery({ queryKey: workflowTasksKey, queryFn: ({ signal }) => listUnifiedWorkflowTasks(signal), enabled });
}

export function useUnifiedWorkflowInstanceHistory(workflowInstanceId?: string) {
  return useQuery({
    queryKey: ['/api/v1/buyer/workflow/instances', workflowInstanceId, 'history'],
    queryFn: ({ signal }) => getUnifiedWorkflowInstanceHistory(workflowInstanceId!, signal),
    enabled: Boolean(workflowInstanceId),
  });
}

export function useWorkflowBusinessHistory(businessType?: string, businessId?: string) {
  return useQuery({
    queryKey: ['/api/v1/buyer/workflow/instances/business', businessType, businessId, 'history'],
    queryFn: ({ signal }) => getUnifiedWorkflowBusinessHistory(businessType!, businessId!, signal),
    enabled: Boolean(businessType && businessId),
  });
}

export function useWorkflowInstancesLedger(view: WorkflowLedgerView) {
  return useQuery({
    queryKey: ['/api/v1/buyer/workflow/instances', view],
    queryFn: ({ signal }) => listUnifiedWorkflowInstances(view, signal),
  });
}

export function useWorkflowRuntimePublishedForm(businessType: string, enabled = true) {
  return useQuery({
    queryKey: ['/api/v1/buyer/workflow/definitions', businessType, 'form'],
    queryFn: ({ signal }) => getUnifiedWorkflowPublishedForm(businessType, signal),
    enabled,
  });
}

export const useUnifiedWorkflowCompleteTask = () =>
  useMutation({
    mutationKey: ['unified-workflow-complete-task'],
    mutationFn: ({ taskId, data }: { taskId: string; data: { action: 'approve' | 'reject'; comment?: string } }) =>
      completeUnifiedWorkflowTask(taskId, data),
  });

export const submitWorkflowPurchaseDemand = (
  demandId: string,
  formData: Record<string, unknown>,
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/demands/${demandId}/submit`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { formData },
  });

export const useWorkflowPurchaseDemandSubmit = () =>
  useMutation({
    mutationKey: ['workflow-purchase-demand-submit'],
    mutationFn: ({ demandId, formData }: { demandId: string; formData: Record<string, unknown> }) =>
      submitWorkflowPurchaseDemand(demandId, formData),
  });

export const submitWorkflowBuyerSupplierAdmission = (
  relationId: string,
  formData: Record<string, unknown>,
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/suppliers/${relationId}/submit`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { formData },
  });

export const useWorkflowBuyerSupplierAdmissionSubmit = () =>
  useMutation({
    mutationKey: ['workflow-buyer-supplier-admission-submit'],
    mutationFn: ({ relationId, formData }: { relationId: string; formData: Record<string, unknown> }) =>
      submitWorkflowBuyerSupplierAdmission(relationId, formData),
  });

export const submitWorkflowRfqAward = (
  rfqId: string,
  data: { quoteId: string; reason: string; formData: Record<string, unknown> },
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/rfqs/${rfqId}/award`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const useWorkflowRfqAwardSubmit = () =>
  useMutation({
    mutationKey: ['workflow-rfq-award-submit'],
    mutationFn: ({
      rfqId,
      quoteId,
      reason,
      formData,
    }: {
      rfqId: string;
      quoteId: string;
      reason: string;
      formData: Record<string, unknown>;
    }) => submitWorkflowRfqAward(rfqId, { quoteId, reason, formData }),
  });

export const submitWorkflowContractApproval = (
  contractId: string,
  formData: Record<string, unknown>,
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/contracts/${contractId}/approval`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { formData },
  });

export const useWorkflowContractApprovalSubmit = () =>
  useMutation({
    mutationKey: ['workflow-contract-approval-submit'],
    mutationFn: ({ contractId, formData }: { contractId: string; formData: Record<string, unknown> }) =>
      submitWorkflowContractApproval(contractId, formData),
  });

export const updateWorkflowPaymentRequestStatus = (
  paymentRequestId: string,
  data: { requestStatus: string; formData: Record<string, unknown> },
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/payment-requests/${paymentRequestId}/status`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const useWorkflowPaymentRequestStatusUpdate = () =>
  useMutation({
    mutationKey: ['workflow-payment-request-status-update'],
    mutationFn: ({
      paymentRequestId,
      requestStatus,
      formData,
    }: {
      paymentRequestId: string;
      requestStatus: string;
      formData: Record<string, unknown>;
    }) => updateWorkflowPaymentRequestStatus(paymentRequestId, { requestStatus, formData }),
  });

export const createWorkflowPaymentRequest = (data: {
  invoiceId: string;
  requestStatus: string;
  paymentBatchNo: string;
  remark?: string;
  formData: Record<string, unknown>;
}) =>
  customInstance<ApiEnvelope<unknown>>({
    url: '/api/v1/buyer/payment-requests',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const useWorkflowPaymentRequestCreate = () =>
  useMutation({
    mutationKey: ['workflow-payment-request-create'],
    mutationFn: createWorkflowPaymentRequest,
  });

export const updateWorkflowPaymentBatchStatus = (
  paymentBatchNo: string,
  data: { batchStatus: string; formData: Record<string, unknown> },
) =>
  customInstance<ApiEnvelope<unknown>>({
    url: `/api/v1/buyer/payment-batches/${paymentBatchNo}/status`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const useWorkflowPaymentBatchStatusUpdate = () =>
  useMutation({
    mutationKey: ['workflow-payment-batch-status-update'],
    mutationFn: ({
      paymentBatchNo,
      batchStatus,
      formData,
    }: {
      paymentBatchNo: string;
      batchStatus: string;
      formData: Record<string, unknown>;
    }) => updateWorkflowPaymentBatchStatus(paymentBatchNo, { batchStatus, formData }),
  });

export const createWorkflowPaymentArchiveException = (data: {
  paymentBatchNo: string;
  exceptionType: string;
  exceptionReason: string;
  formData: Record<string, unknown>;
}) =>
  customInstance<ApiEnvelope<unknown>>({
    url: '/api/v1/buyer/payment-archive-exception-requests',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  });

export const useWorkflowPaymentArchiveExceptionCreate = () =>
  useMutation({
    mutationKey: ['workflow-payment-archive-exception-create'],
    mutationFn: createWorkflowPaymentArchiveException,
  });

export const workflowRuntimeQueryKeys = {
  processDefinitions: processDefinitionsKey,
  tasks: workflowTasksKey,
};
