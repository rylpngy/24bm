import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java supplier delivery scaffold', () => {
  it('exposes supplier delivery list and creation endpoints', () => {
    const controller = read('backend-java/src/main/java/com/procurement/order/api/SupplierDeliveryController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/supplier")');
    expect(controller).toContain('@GetMapping("/deliveries")');
    expect(controller).toContain('@PostMapping("/orders/{orderId}/deliveries")');
    expect(controller).toContain('CreateDeliveryRequest');
  });

  it('defines request and response DTOs for delivery creation', () => {
    const request = read('backend-java/src/main/java/com/procurement/order/api/CreateDeliveryRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/order/api/DeliveryResponse.java');

    expect(request).toContain('carrier');
    expect(request).toContain('trackingNo');
    expect(response).toContain('tenantId');
    expect(response).toContain('orderId');
    expect(response).toContain('supplierId');
    expect(response).toContain('status');
  });

  it('uses MyBatis mapper for deliveries table operations', () => {
    const mapper = read('backend-java/src/main/java/com/procurement/order/infrastructure/DeliveryMapper.java');

    expect(mapper).toContain('@Mapper');
    expect(mapper).toContain('deliveries');
    expect(mapper).toContain('tracking_no');
    expect(mapper).toContain('insert');
    expect(mapper).toContain('countByTenantAndOrder');
    expect(mapper).toContain('listBySupplierFiltered');
  });

  it('extends purchase order mapper for supplier scoped lookup and delivery status update', () => {
    const mapper = read('backend-java/src/main/java/com/procurement/order/infrastructure/PurchaseOrderMapper.java');

    expect(mapper).toContain('findBySupplierAndId');
    expect(mapper).toContain('updateStatus');
    expect(mapper).toContain('supplier_id = #{supplierId}');
  });

  it('keeps delivery creation supplier scoped and updates order status', () => {
    const service = read('backend-java/src/main/java/com/procurement/order/application/DeliveryApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireSupplierId');
    expect(service).toContain('listCurrentSupplierDeliveries');
    expect(service).toContain('listBySupplierFiltered');
    expect(service).toContain('PurchaseOrderStatus.PENDING_SHIPMENT');
    expect(service).toContain('PurchaseOrderStatus.SHIPPED');
    expect(service).toContain('PurchaseOrderStatusTransition');
    expect(service).toContain('requireShipment');
    expect(service).toContain('countByTenantAndOrder');
    expect(service).toContain('findBySupplierAndId');
    expect(service).toContain('updateStatus');
    const transition = read('backend-java/src/main/java/com/procurement/order/domain/PurchaseOrderStatusTransition.java');
    expect(transition).toContain('Only ready-to-ship orders can be shipped');
  });

  it('documents the supplier delivery Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('GET /api/v1/supplier/deliveries');
    expect(readme).toContain('POST /api/v1/supplier/orders/{orderId}/deliveries');
    expect(readme).toContain('The supplier delivery list accepts optional `status` and `orderId` filters');
    expect(readme).toContain('MVP delivery creation allows only one delivery per purchase order');
    expect(architecture).toContain('供应商发货 Java API');
    expect(architecture).toContain('MVP 阶段同一采购订单只能登记一条发货记录');
  });
});
