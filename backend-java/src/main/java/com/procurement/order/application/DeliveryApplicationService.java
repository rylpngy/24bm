package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.domain.Delivery;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeliveryApplicationService {
  private static final String READY_TO_SHIP_STATUS = "待发货";
  private static final String SHIPPED_STATUS = "已发货";
  private static final String PURCHASE_ORDER_SHIPPED_ACTION = "purchase_order.shipped";
  private static final String PURCHASE_ORDER_TARGET_TYPE = "purchase_order";

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DeliveryMapper deliveryMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public DeliveryApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      DeliveryMapper deliveryMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.deliveryMapper = deliveryMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @Transactional
  public DeliveryResponse create(String orderId, CreateDeliveryRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("delivery APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    if (!READY_TO_SHIP_STATUS.equals(order.status())) {
      throw new IllegalStateException("Only ready-to-ship orders can be shipped: " + orderId);
    }

    String deliveryId = newId("delivery");
    deliveryMapper.insert(
        deliveryId,
        order.tenantId(),
        order.id(),
        supplierId,
        request.carrier(),
        request.trackingNo(),
        SHIPPED_STATUS);
    int updated = purchaseOrderMapper.updateStatus(
        order.tenantId(),
        order.id(),
        READY_TO_SHIP_STATUS,
        SHIPPED_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before delivery could be recorded: " + orderId);
    }
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        PURCHASE_ORDER_SHIPPED_ACTION,
        PURCHASE_ORDER_TARGET_TYPE,
        order.id());

    return toResponse(deliveryMapper.findByTenantAndId(order.tenantId(), deliveryId));
  }

  private DeliveryResponse toResponse(Delivery delivery) {
    return new DeliveryResponse(
        delivery.id(),
        delivery.tenantId(),
        delivery.orderId(),
        delivery.supplierId(),
        delivery.carrier(),
        delivery.trackingNo(),
        delivery.status(),
        delivery.createdAt());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }
}
