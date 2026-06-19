import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer RFQ create form UI details', () => {
  it('shows supplier invitation context and demand summary before creating an RFQ', () => {
    const app = read('App.tsx');
    const rfqCreateForm = app.slice(
      app.indexOf('const RfqCreateForm'),
      app.indexOf('const Field:'),
    );

    expect(rfqCreateForm).toContain('admittedRelations');
    expect(rfqCreateForm).toContain('toggleSupplierSelection');
    expect(rfqCreateForm).toContain('已选择供应商');
    expect(rfqCreateForm).toContain('需求预算');
    expect(rfqCreateForm).toContain('预计报价截止');
    expect(rfqCreateForm).toContain('quoteRequirement');
    expect(rfqCreateForm).toContain('deliveryRequirement');
    expect(rfqCreateForm).toContain('invitationNote');
    expect(rfqCreateForm).toContain('报价要求');
    expect(rfqCreateForm).toContain('交付要求');
    expect(rfqCreateForm).toContain('邀请说明');
    expect(rfqCreateForm).toContain('暂无已准入供应商');
    expect(rfqCreateForm).toContain('RFQ 创建后将向');
    expect(rfqCreateForm).toContain('家供应商发送询价邀请');
    expect(rfqCreateForm).toContain('授权品类');
    expect(rfqCreateForm).toContain('绩效');
    expect(rfqCreateForm).toContain('selectedSupplierIds.length');
    expect(rfqCreateForm).toContain('deadline}T18:00:00+08:00');
    expect(rfqCreateForm).toContain('admittedRelations.map');
  });
});
