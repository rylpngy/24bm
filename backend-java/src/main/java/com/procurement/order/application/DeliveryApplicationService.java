package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.DeliveryLineItemRequest;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.api.UpdateDeliveryRequest;
import com.procurement.order.domain.Delivery;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.HashSet;
import com.procurement.order.domain.OrderFulfillmentPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeliveryApplicationService {
  private final OrderAccessService access;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DeliveryMapper deliveryMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;

  public DeliveryApplicationService(
      OrderAccessService access,
      PurchaseOrderMapper purchaseOrderMapper,
      DeliveryMapper deliveryMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition) {
    this.access = access;
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

  public List<DeliveryResponse> listCurrentTenantDeliveries() {
    String tenantId = TenantAccessGuard.requireTenantId("delivery APIs");
    if (!access.canRead("buyer:order:read")) return List.of();
    var visible = access.visibleOrders("buyer:order:read");
    return deliveryMapper.listByTenant(tenantId).stream()
        .filter(delivery -> visible.test(delivery.orderId()))
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
    order = purchaseOrderMapper.lockByTenantAndId(order.tenantId(), orderId);
    if (order == null || !supplierId.equals(order.supplierId())) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    purchaseOrderStatusTransition.requireShipment(order.status(), orderId);
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), TenantFeatureKey.ORDER);
    var available = deliveryMapper.fulfillmentLines(order.tenantId(), orderId);
    if (available.isEmpty() || deliveryMapper.countUnattributedHistory(order.tenantId(), orderId) > 0) {
      throw new IllegalStateException("Legacy order or documents without attributable lines require manual reconciliation");
    }
    var lineItems = request.lineItems();
    if (lineItems == null || lineItems.isEmpty()) {
      lineItems = available.stream().map(l -> new DeliveryLineItemRequest(l.orderLineId(),
          l.orderedQuantity().subtract(l.shippedQuantity())))
          .filter(l -> l.shippedQuantity().signum() > 0).toList();
      OrderFulfillmentPolicy.requireTotal(request.shippedQuantity(), lineItems.stream()
          .map(DeliveryLineItemRequest::shippedQuantity).reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    if (lineItems.isEmpty()) {
      throw new IllegalArgumentException("Shipment order lines are required");
    }
    var seen = new HashSet<String>();
    BigDecimal total = BigDecimal.ZERO;
    for (var line : lineItems) {
      if (line == null || !seen.add(line.orderLineId())) {
        throw new IllegalArgumentException("Duplicate shipment order line");
      }
      var capacity = available.stream().filter(l -> l.orderLineId().equals(line.orderLineId())).findFirst()
          .orElseThrow(() -> new IllegalArgumentException("Shipment order line not found"));
      OrderFulfillmentPolicy.ship(capacity, line.shippedQuantity());
      total = total.add(line.shippedQuantity());
    }
    OrderFulfillmentPolicy.requireTotal(request.shippedQuantity(), total);

    String deliveryId = newId("delivery");
    deliveryMapper.insert(
        deliveryId,
        order.tenantId(),
        order.id(),
        supplierId,
        request.carrier(),
        request.trackingNo(),
        PurchaseOrderStatus.SHIPPED,
        request.shippedQuantity(),
        request.shippedDate(),
        request.estimatedArrival(),
        request.logisticsNote() == null ? "" : request.logisticsNote());
    for (var line : lineItems) {
      deliveryMapper.insertLine(newId("dli"), order.tenantId(), deliveryId, line.orderLineId(), line.shippedQuantity());
    }
    int updated = purchaseOrderMapper.updateStatus(
        order.tenantId(),
        order.id(),
        order.status(),
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
        NotificationTitle.PURCHASE_ORDER_SHIPPED,
        "采购订单 " + order.id() + " 已发货，物流：" + request.carrier() + " " + request.trackingNo() + "。");

    return toResponse(deliveryMapper.findByTenantAndId(order.tenantId(), deliveryId));
  }

  @Transactional
  public DeliveryResponse update(String deliveryId, UpdateDeliveryRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("delivery APIs");
    Delivery delivery = deliveryMapper.findBySupplierAndId(supplierId, deliveryId);
    if (delivery == null) {
      throw new IllegalArgumentException("Delivery not found for supplier scope: " + deliveryId);
    }
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, delivery.orderId());
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + delivery.orderId());
    }
    order = purchaseOrderMapper.lockByTenantAndId(order.tenantId(), order.id());
    if (order == null || !supplierId.equals(order.supplierId())) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope");
    }
    if (request.shippedQuantity() != null && !request.shippedQuantity().equals(delivery.shippedQuantity())) {
      throw new IllegalArgumentException("Recorded shipment quantity is immutable; create a new batch");
    }
    if (!PurchaseOrderStatus.SHIPPED.equals(order.status())) {
      throw new IllegalStateException("Only shipped purchase orders can update delivery tracking: " + order.id());
    }
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), TenantFeatureKey.ORDER);
    int updated = deliveryMapper.updateSupplierDelivery(
        order.tenantId(),
        delivery.id(),
        supplierId,
        request.carrier(),
        request.trackingNo(),
        null,
        request.shippedDate(),
        request.estimatedArrival(),
        blankToNull(request.logisticsNote()));
    if (updated == 0) {
      throw new IllegalStateException("Delivery changed before tracking could be updated: " + deliveryId);
    }
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        PurchaseOrderAuditAction.SHIPPED,
        AuditTargetType.PURCHASE_ORDER,
        order.id());
    notificationApplicationService.notifyActiveTenantUsers(
        order.tenantId(),
        NotificationTitle.PURCHASE_ORDER_SHIPPED,
        "采购订单 " + order.id() + " 物流信息已更新，物流：" + request.carrier() + " " + request.trackingNo() + "。");

    return toResponse(deliveryMapper.findByTenantAndId(order.tenantId(), delivery.id()));
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
        delivery.createdAt(),
        delivery.shippedQuantity(),
        delivery.shippedDate(),
        delivery.estimatedArrival(),
        delivery.logisticsNote(),
        deliveryMapper.listLines(delivery.tenantId(), delivery.id()));
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
