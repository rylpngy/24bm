import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six award order closeout guard', () => {
  it('closes quote statuses when an award approval is approved', () => {
    const quoteStatus = read('backend-java/src/main/java/com/procurement/sourcing/domain/QuoteStatus.java');
    const quoteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/QuoteMapper.java');
    const awardService = read('backend-java/src/main/java/com/procurement/sourcing/application/AwardApplicationService.java');
    const awardTest = read('backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java');

    expect(quoteStatus).toContain('AWARDED = "已中选"');
    expect(quoteStatus).toContain('NOT_SELECTED = "未中选"');
    expect(quoteMapper).toContain('markAwardedQuote');
    expect(quoteMapper).toContain('closeUnawardedQuotes');
    expect(awardService).toContain('quoteMapper.markAwardedQuote');
    expect(awardService).toContain('quoteMapper.closeUnawardedQuotes');
    expect(awardService).toContain('QuoteStatus.AWARDED');
    expect(awardService).toContain('QuoteStatus.NOT_SELECTED');
    expect(awardTest).toContain('verify(quoteMapper).markAwardedQuote');
    expect(awardTest).toContain('verify(quoteMapper).closeUnawardedQuotes');
  });

  it('guards purchase order creation against concurrent duplicate award sources', () => {
    const service = read('backend-java/src/main/java/com/procurement/order/application/PurchaseOrderApplicationService.java');
    const migration = read('backend-java/src/main/resources/db/migration/V119__purchase_order_award_unique_source.sql');
    const orderTest = read('backend-java/src/test/java/com/procurement/OrderFulfillmentStateTransitionTests.java');

    expect(service).toContain('DuplicateKeyException');
    expect(service).toContain('purchaseOrderMapper.findByAwardSource(tenantId, award.rfqId(), award.supplierId())');
    expect(migration).toContain('purchase_orders_tenant_rfq_supplier_unique');
    expect(migration).toContain('unique (tenant_id, rfq_id, supplier_id)');
    expect(orderTest).toContain('buyerOrderCreationReturnsExistingOrderWhenConcurrentInsertAlreadyCreatedIt');
    expect(orderTest).toContain('duplicate award order');
  });

  it('records the twelfth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 12 | 定标通过报价收口与重复生成订单边界 |');
    expect(checklist).toContain('中选报价从 `QuoteStatus.LOCKED` 变为 `QuoteStatus.AWARDED`');
    expect(checklist).toContain('未中选报价从 `QuoteStatus.SUBMITTED` 变为 `QuoteStatus.NOT_SELECTED`');
    expect(checklist).toContain('purchase_orders_tenant_rfq_supplier_unique');
    expect(checklist).toContain('scripts/stage-six-award-order-closeout-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
