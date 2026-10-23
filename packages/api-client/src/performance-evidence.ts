import { useMutation, useQuery } from '@tanstack/react-query';
import { customInstance, downloadReport } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface PerformanceEvidence {
  id: string; round: number; fileName: string; size: number; sha256: string; uploaderName: string; createdAt: string;
}
export function usePerformanceEvidence(taskId: string, version: number, relationId?: string) {
  const root = relationId
    ? `/api/v1/buyer/suppliers/${encodeURIComponent(relationId)}/performance-tasks/${encodeURIComponent(taskId)}/evidence`
    : `/api/v1/supplier/performance-tasks/${encodeURIComponent(taskId)}/evidence`;
  const query = useQuery({ queryKey: [root, version], queryFn: ({ signal }) => customInstance<ApiEnvelope<PerformanceEvidence[]>>({ url: root, signal }) });
  const upload = useMutation({ mutationFn: async (file: File) => {
    if (relationId) throw new Error('采购方不可上传供应商整改材料');
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过10MB的非空文件');
    return customInstance({ url: root, method: 'POST', params: { expectedVersion: version, fileName: file.name }, headers: { 'Content-Type': 'application/octet-stream' }, data: file });
  }, onSuccess: async () => { await query.refetch(); } });
  const download = useMutation({ mutationFn: (file: PerformanceEvidence) => downloadReport(`${root}/${encodeURIComponent(file.id)}/download`, file.fileName) });
  const failure = upload.error ?? download.error ?? query.error;
  const error = failure ? (failure as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (failure as Error).message ?? '材料操作失败，请重试' : '';
  return { files: query.data?.data ?? [], loading: query.isLoading, busy: upload.isPending || download.isPending,
    error, upload: (file: File) => upload.mutate(file), download: (file: PerformanceEvidence) => download.mutate(file), refresh: () => void query.refetch() };
}
