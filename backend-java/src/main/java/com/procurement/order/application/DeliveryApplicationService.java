package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.domain.Delivery;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeliveryApplicationService {
  private static final String PURCHASE_ORDER_SHIPPED_NOTIFICATION_TITLE = "采购订单已发货";
  private static final String ORDER_FEATURE = "order";

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DeliveryMapper deliveryMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;

  public DeliveryApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      DeliveryMapper deliveryMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.deliveryMapper = deliveryMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
  }

  public List<DeliveryResponse> listCurrentSupplierDeliveries(String status, String orderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("delivery APIs");
    return deliveryMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(status),
            blankToNull(orderId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public DeliveryResponse create(String orderId, CreateDeliveryRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("delivery APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    purchaseOrderStatusTransition.requireShipment(order.status(), orderId);
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), ORDER_FEATURE);
    if (deliveryMapper.countByTenantAndOrder(order.tenantId(), order.id()) > 0) {
      throw new IllegalStateException("Purchase order already has a delivery: " + orderId);
    }

    String deliveryId = newId("delivery");
    deliveryMapper.insert(
        deliveryId,
        order.tenantId(),
        order.id(),
        supplierId,
        request.carrier(),
        request.trackingNo(),
        PurchaseOrderStatus.SHIPPED);
    int updated = purchaseOrderMapper.updateStatus(
        order.tenantId(),
        order.id(),
        PurchaseOrderStatus.PENDING_SHIPMENT,
        PurchaseOrderStatus.SHIPPED);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before delivery could be recorded: " + orderId);
    }
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        PurchaseOrderAuditAction.SHIPPED,
        AuditTargetType.PURCHASE_ORDER,
        order.id());
    notificationApplicationService.notifyActiveTenantUsers(
        order.tenantId(),
        PURCHASE_ORDER_SHIPPED_NOTIFICATION_TITLE,
        "采购订单 " + order.id() + " 已发货，物流：" + request.carrier() + " " + request.trackingNo() + "。");

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

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
