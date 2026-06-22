import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract attachment signed URL UI', () => {
  it('adds Java attachment upload ticket and download link APIs to the frontend client', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('AttachmentUploadTicketRecord');
    expect(client).toContain('AttachmentDownloadLinkRecord');
    expect(client).toContain('createBuyerAttachmentUploadTicket');
    expect(client).toContain('createBuyerAttachmentDownloadLink');
    expect(client).toContain("buyerRequest<JavaAttachmentUploadTicketDto>('/api/v1/buyer/attachments/upload-ticket'");
    expect(client).toContain("`/api/v1/buyer/attachments/${attachmentId}/download-link`");
  });

  it('upgrades the contract attachment panel with upload ticket and download link actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('contractAttachmentUploadTicketsById');
    expect(app).toContain('contractAttachmentDownloadLinksById');
    expect(app).toContain('createBuyerContractAttachmentUploadTicket');
    expect(app).toContain('createBuyerContractAttachmentDownloadLink');
    expect(app).toContain('生成上传凭证');
    expect(app).toContain('生成下载签名');
    expect(app).toContain('uploadUrl');
    expect(app).toContain('downloadUrl');
  });

  it('records the signed URL round in stage-five documentation', () => {
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(checklist).toContain('| 16 | 合同附件上传凭证与下载签名 |');
    expect(checklist).toContain('第16轮已新增合同附件上传凭证和下载签名入口');
    expect(walkthrough).toContain('合同附件上传凭证与下载签名');
  });
});
