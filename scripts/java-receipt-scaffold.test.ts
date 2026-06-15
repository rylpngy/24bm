import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java buyer receipt scaffold', () => {
  it('exposes buyer receipt creation endpoint', () => {
    const controller = read('backend-java/src/main/java/com/procurement/order/api/BuyerReceiptController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/orders")');
    expect(controller).toContain('@PostMapping("/{orderId}/receipts")');
    expect(controller).toContain('CreateReceiptRequest');
  });

  it('defines request and response DTOs for receipt creation', () => {
    const request = read('backend-java/src/main/java/com/procurement/order/api/CreateReceiptRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/order/api/ReceiptResponse.java');

    expect(request).toContain('result');
    expect(response).toContain('tenantId');
    expect(response).toContain('orderId');
    expect(response).toContain('receiverId');
    expect(response).toContain('receivedAt');
  });

  it('uses MyBatis mapper for receipts table operations', () => {
    const mapper = read('backend-java/src/main/java/com/procurement/order/infrastructure/ReceiptMapper.java');

    expect(mapper).toContain('@Mapper');
    expect(mapper).toContain('receipts');
    expect(mapper).toContain('receiver_id');
    expect(mapper).toContain('received_at');
  });

  it('keeps receipt creation tenant scoped and updates order status', () => {
    const service = read('backend-java/src/main/java/com/procurement/order/application/ReceiptApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('TenantAccessGuard.requireUserId');
    expect(service).toContain('已发货');
    expect(service).toContain('已收货');
    expect(service).toContain('findByTenantAndId');
    expect(service).toContain('updateStatus');
  });

  it('documents the buyer receipt Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/buyer/orders/{orderId}/receipts');
    expect(architecture).toContain('采购方收货验收 Java API');
  });
});
