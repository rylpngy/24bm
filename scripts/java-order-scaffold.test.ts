import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java purchase order scaffold', () => {
  it('exposes buyer order creation endpoint', () => {
    const controller = read('backend-java/src/main/java/com/procurement/order/api/PurchaseOrderController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/orders")');
    expect(controller).toContain('@GetMapping');
    expect(controller).toContain('@PostMapping');
    expect(controller).toContain('CreatePurchaseOrderRequest');
  });

  it('defines request and response DTOs for order creation', () => {
    const request = read('backend-java/src/main/java/com/procurement/order/api/CreatePurchaseOrderRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/order/api/PurchaseOrderResponse.java');

    expect(request).toContain('awardId');
    expect(request).toContain('expectedReceiptDate');
    expect(response).toContain('tenantId');
    expect(response).toContain('rfqId');
    expect(response).toContain('supplierId');
    expect(response).toContain('amount');
    expect(response).toContain('status');
  });

  it('uses MyBatis mapper for purchase_orders table operations', () => {
    const mapper = read('backend-java/src/main/java/com/procurement/order/infrastructure/PurchaseOrderMapper.java');

    expect(mapper).toContain('@Mapper');
    expect(mapper).toContain('purchase_orders');
    expect(mapper).toContain('listByTenant');
    expect(mapper).toContain('findByAwardSource');
    expect(mapper).toContain('expected_receipt_date');
  });

  it('extends award decision mapper for tenant scoped order creation', () => {
    const awardMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/AwardDecisionMapper.java');

    expect(awardMapper).toContain('findApprovedForOrder');
    expect(awardMapper).toContain('approved_status');
  });

  it('keeps order creation tenant scoped and idempotent', () => {
    const service = read('backend-java/src/main/java/com/procurement/order/application/PurchaseOrderApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('listCurrentTenantOrders');
    expect(service).toContain('待供应商确认');
    expect(service).toContain('findApprovedForOrder');
    expect(service).toContain('findByAwardSource');
    expect(service).toContain('return toResponse(existingOrder)');
  });

  it('documents the purchase order Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/buyer/orders');
    expect(readme).toContain('GET /api/v1/buyer/orders');
    expect(architecture).toContain('采购订单 Java API');
  });

  it('keeps source files under the order module boundary', () => {
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/order/application'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/order/infrastructure'))).toBe(true);
  });
});
