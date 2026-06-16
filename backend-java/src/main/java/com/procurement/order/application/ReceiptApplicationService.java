package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.api.ReceiptResponse;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderDocumentUniquenessPolicy;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptApplicationService {
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DeliveryMapper deliveryMapper;
  private final ReceiptMapper receiptMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;

  public ReceiptApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      DeliveryMapper deliveryMapper,
      ReceiptMapper receiptMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.deliveryMapper = deliveryMapper;
    this.receiptMapper = receiptMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
  }

  public List<ReceiptResponse> listCurrentTenantReceipts(String orderId, String receiverId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer receipt APIs");
    return receiptMapper.listByTenantFiltered(
            tenantId,
            blankToNull(orderId),
            blankToNull(receiverId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ReceiptResponse create(String orderId, CreateReceiptRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer receipt APIs");
    String userId = TenantAccessGuard.requireUserId("buyer receipt APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found in tenant scope: " + orderId);
    }
    purchaseOrderStatusTransition.requireReceipt(order.status(), orderId);
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    purchaseOrderStatusTransition.requireShippedDelivery(
        deliveryMapper.countByTenantOrderAndStatus(tenantId, orderId, PurchaseOrderStatus.SHIPPED),
        orderId);
    PurchaseOrderDocumentUniquenessPolicy.requireNoReceipt(
        receiptMapper.countByTenantAndOrder(tenantId, orderId),
        orderId);

    String receiptId = newId("receipt");
    receiptMapper.insert(receiptId, tenantId, orderId, userId, request.result());
    int updated = purchaseOrderMapper.updateStatus(
        tenantId,
        orderId,
        PurchaseOrderStatus.SHIPPED,
        PurchaseOrderStatus.RECEIVED);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before receipt could be recorded: " + orderId);
    }
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.RECEIVED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        NotificationTitle.PURCHASE_ORDER_RECEIVED,
        "采购订单 " + order.id() + " 已完成收货验收，结果：" + request.result() + "。");

    return toResponse(receiptMapper.findByTenantAndId(tenantId, receiptId));
  }

  private ReceiptResponse toResponse(Receipt receipt) {
    return new ReceiptResponse(
        receipt.id(),
        receipt.tenantId(),
        receipt.orderId(),
        receipt.receiverId(),
        receipt.result(),
        receipt.receivedAt());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
