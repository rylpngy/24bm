import { customInstance } from './http-client';

export interface AttachmentIntegrity {
  attachmentId: string;
  status: 'verified' | 'unverified' | 'mismatch' | 'missing' | 'unavailable' | 'invalid_path';
  message: string; expectedSize: number | null; actualSize: number | null; checkedAt: string;
}

export function checkAttachmentIntegrity(id: string) {
  return customInstance<{ data: AttachmentIntegrity }>({
    url: `/api/v1/buyer/attachments/${encodeURIComponent(id)}/integrity-check`, method: 'POST',
  });
}
