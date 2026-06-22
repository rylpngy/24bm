import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const docs = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer main flow third round UI', () => {
  it('surfaces stronger purchase demand readiness and RFQ creation guidance', () => {
    const source = app();
    const demandArea = source.slice(
      source.indexOf('const DemandDetailPanelView'),
      source.indexOf('const DemandDetailOperationPanel'),
    );

    expect(demandArea).toContain('采购需求主流程判断');
    expect(demandArea).toContain('审批状态');
    expect(demandArea).toContain('预算与附件');
    expect(demandArea).toContain('物料明细');
    expect(demandArea).toContain('创建询价可用性');
  });

  it('adds RFQ status flow and invitation readiness signals', () => {
    const source = app();
    const rfqArea = source.slice(
      source.indexOf('const RfqDetailPanelView'),
      source.indexOf('const RfqDetailOperationPanel'),
    );

    expect(rfqArea).toContain('询价状态流转');
    expect(rfqArea).toContain('供应商邀请');
    expect(rfqArea).toContain('报价要求');
    expect(rfqArea).toContain('截止时间');
    expect(rfqArea).toContain('报价数量');
  });

  it('adds quote comparison matrix, award boundary, order timeline, and payment plan cues', () => {
    const source = app();
    const quoteArea = source.slice(
      source.indexOf('const QuoteComparisonDetailPanelView'),
      source.indexOf('const OrderDetailPanelView'),
    );
    const orderArea = source.slice(
      source.indexOf('const OrderDetailPanelView'),
      source.indexOf('const OrderDetailOperationPanel'),
    );
    const invoiceArea = source.slice(
      source.indexOf('const InvoicePaymentDetailPanelView'),
      source.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(quoteArea).toContain('报价比较矩阵');
    expect(quoteArea).toContain('推荐定标理由');
    expect(quoteArea).toContain('定标审批状态');
    expect(quoteArea).toContain('不可操作边界');

    expect(orderArea).toContain('订单履约时间线');
    expect(orderArea).toContain('供应商确认');
    expect(orderArea).toContain('发货');
    expect(orderArea).toContain('收货');
    expect(orderArea).toContain('预计到货日期');

    expect(invoiceArea).toContain('付款计划');
    expect(invoiceArea).toContain('差异处理');
    expect(invoiceArea).toContain('逾期提醒');
    expect(invoiceArea).toContain('付款状态反馈');
  });

  it('records the third-round buyer flow refinement in the execution checklist', () => {
    const checklist = docs();

    expect(checklist).toContain('采购方主流程第三轮细化');
    expect(checklist).toContain('采购需求主流程判断');
    expect(checklist).toContain('询价状态流转');
    expect(checklist).toContain('报价比较矩阵');
    expect(checklist).toContain('订单履约时间线');
    expect(checklist).toContain('付款计划');
  });
});
