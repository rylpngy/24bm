import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java buyer receipt scaffold', () => {
  it('exposes buyer receipt list and creation endpoints', () => {
    const controller = read('backend-java/src/main/java/com/procurement/order/api/BuyerReceiptController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer")');
    expect(controller).toContain('@GetMapping("/receipts")');
    expect(controller).toContain('@PostMapping("/orders/{orderId}/receipts")');
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
    expect(mapper).toContain('listByTenantFiltered');
  });

  it('keeps receipt creation tenant scoped and updates order status', () => {
    const service = read('backend-java/src/main/java/com/procurement/order/application/ReceiptApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('TenantAccessGuard.requireUserId');
    expect(service).toContain('listCurrentTenantReceipts');
    expect(service).toContain('listByTenantFiltered');
    expect(service).toContain('已发货');
    expect(service).toContain('已收货');
    expect(service).toContain('findByTenantAndId');
    expect(service).toContain('updateStatus');
  });

  it('documents the buyer receipt Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('GET /api/v1/buyer/receipts');
    expect(readme).toContain('POST /api/v1/buyer/orders/{orderId}/receipts');
    expect(readme).toContain('The buyer receipt list accepts optional `orderId` and `receiverId` filters');
    expect(architecture).toContain('采购方收货验收 Java API');
  });
});
