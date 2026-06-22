import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('attachment center entry UI', () => {
  it('defines a shared attachment center entry with metadata and upload boundary copy', () => {
    const app = read('App.tsx');
    const attachmentEntry = sliceBetween(app, 'const AttachmentCenterEntryPanel', 'const DetailActionPanel');

    expect(attachmentEntry).toContain('附件中心入口');
    expect(attachmentEntry).toContain('登记附件元数据');
    expect(attachmentEntry).toContain('暂不上传原文件');
    expect(attachmentEntry).toContain('visibility');
    expect(attachmentEntry).toContain('ownerType');
    expect(attachmentEntry).toContain('ownerId');
  });

  it('adds attachment center entries to buyer demand receipt and invoice flows', () => {
    const app = read('App.tsx');
    const demandCreateForm = sliceBetween(app, 'const DemandCreateForm', 'const RfqCreateForm');
    const receiptRegistrationForm = sliceBetween(app, 'const ReceiptRegistrationForm', 'const PaymentRegistrationForm');
    const paymentRegistrationForm = sliceBetween(app, 'const PaymentRegistrationForm', 'const OrderDetailPanelView');

    expect(demandCreateForm).toContain('title="需求附件中心"');
    expect(demandCreateForm).toContain('ownerType="采购需求"');
    expect(demandCreateForm).toContain('ownerId="新建需求草稿"');
    expect(demandCreateForm).toContain('parseAttachmentNames(attachmentNames)');

    expect(receiptRegistrationForm).toContain('title="收货附件中心"');
    expect(receiptRegistrationForm).toContain('ownerType="收货验收"');
    expect(receiptRegistrationForm).toContain('ownerId={orderId}');
    expect(receiptRegistrationForm).toContain('parseAttachmentNames(draft.attachmentNames)');

    expect(paymentRegistrationForm).toContain('title="发票附件中心"');
    expect(paymentRegistrationForm).toContain('ownerType="发票付款"');
    expect(paymentRegistrationForm).toContain('ownerId={invoiceId}');
  });

  it('adds a supplier qualification attachment entry to the supplier profile page', () => {
    const app = read('App.tsx');
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileSummaryPanel');

    expect(supplierWorkspace).toContain('title="资质附件中心"');
    expect(supplierWorkspace).toContain('ownerType="供应商资质"');
    expect(supplierWorkspace).toContain('ownerId={workspace.supplier.id}');
    expect(supplierWorkspace).toContain('visibility="supplier_shared"');
  });
});
