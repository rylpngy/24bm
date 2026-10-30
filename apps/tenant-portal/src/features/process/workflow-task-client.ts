import { axiosInstance } from '@24bid/api-client';

export interface TaskTiming {
  dueAt?: string;
  additionalReview?: boolean;
  additionalRejected?: boolean;
  reworkSupported?: boolean;
}
export interface AdditionalReview {
  id: string;
  nodeId: string;
  requesterName: string;
  reviewerName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewData: string;
  createdAt: string;
  completedAt?: string;
}
const unwrap = async <T>(request: Promise<{data: {data: T}}>) => (await request).data.data;
export const workflowTaskClient = {
  timing: (taskId: string) => unwrap<TaskTiming>(axiosInstance.get(`/api/v1/buyer/workflow/tasks/${taskId}/timing`)),
  targets: (taskId: string) => unwrap<{nodeId: string; name: string}[]>(axiosInstance.get(`/api/v1/buyer/workflow/tasks/${taskId}/return-targets`)),
  additional: (taskId: string) => unwrap<AdditionalReview | null>(axiosInstance.get(`/api/v1/buyer/workflow/tasks/${taskId}/additional-current`)),
  additionalHistory: (instanceId: string) => unwrap<AdditionalReview[]>(axiosInstance.get(`/api/v1/buyer/workflow/instances/${instanceId}/additional-reviews`)),
  requestAdditional: (taskId: string, reviewerId: string, reason: string) => axiosInstance.post(`/api/v1/buyer/workflow/tasks/${taskId}/additional-reviews`, {reviewerId, reason}),
  decideAdditional: (taskId: string, reviewId: string, action: 'approve' | 'reject', comment: string) => axiosInstance.post(`/api/v1/buyer/workflow/tasks/${taskId}/additional-decision`, {reviewId, action, comment}),
  returnTask: (taskId: string, targetNodeId: string, reason: string) => axiosInstance.post(`/api/v1/buyer/workflow/tasks/${taskId}/return`, {targetNodeId, reason}),
  withdraw: (instanceId: string, reason: string) => axiosInstance.post(`/api/v1/buyer/workflow/instances/${instanceId}/withdraw-ludong-application`, {reason}),
};
export function workflowOperationError(error: unknown, fallback: string) {
  return (error as {response?: {data?: {message?: string}}} | null)?.response?.data?.message || fallback;
}
