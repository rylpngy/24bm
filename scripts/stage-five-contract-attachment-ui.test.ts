import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract attachment entry', () => {
  it('wires buyer attachment APIs through the Java client for contract metadata', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('JavaAttachmentDto');
    expect(client).toContain('CreateAttachmentPayload');
    expect(client).toContain('AttachmentRecord');
    expect(client).toContain('listBuyerAttachments');
    expect(client).toContain('createBuyerAttachment');
    expect(client).toContain('/api/v1/buyer/attachments?');
    expect(client).toContain("buyerRequest<JavaAttachmentDto>('/api/v1/buyer/attachments'");
  });

  it('shows contract attachments and a metadata registration entry in contract detail', () => {
    const app = read('App.tsx');
    const ui = read('data/buyerAdminUi.ts');

    expect(app).toContain('ContractAttachmentPanel');
    expect(app).toContain('合同附件');
    expect(app).toContain('登记合同附件');
    expect(app).toContain("ownerType: 'contract'");
    expect(app).toContain('javaApiClient.createBuyerAttachment');
    expect(app).toContain('javaApiClient.listBuyerAttachments');
    expect(app).toContain('contract-attachment');
    expect(ui).toContain('附件审批待后续迭代');
  });

  it('records the contract attachment round in stage-five documentation', () => {
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(checklist).toContain('| 14 | 合同附件元数据入口 |');
    expect(checklist).toContain('第14轮已复用附件中心');
    expect(walkthrough).toContain('合同附件元数据入口');
  });
});
