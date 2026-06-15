package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.api.ReceiptResponse;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.notification.application.NotificationApplicationService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptApplicationService {
  private static final String SHIPPED_STATUS = "已发货";
  private static final String RECEIVED_STATUS = "已收货";
  private static final String PURCHASE_ORDER_RECEIVED_ACTION = "purchase_order.received";
  private static final String PURCHASE_ORDER_TARGET_TYPE = "purchase_order";
  private static final String PURCHASE_ORDER_RECEIVED_NOTIFICATION_TITLE = "采购订单已收货";

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final ReceiptMapper receiptMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public ReceiptApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      ReceiptMapper receiptMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.receiptMapper = receiptMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Transactional
  public ReceiptResponse create(String orderId, CreateReceiptRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer receipt APIs");
    String userId = TenantAccessGuard.requireUserId("buyer receipt APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found in tenant scope: " + orderId);
    }
    if (!SHIPPED_STATUS.equals(order.status())) {
      throw new IllegalStateException("Only shipped purchase orders can be received: " + orderId);
    }

    String receiptId = newId("receipt");
    receiptMapper.insert(receiptId, tenantId, orderId, userId, request.result());
    int updated = purchaseOrderMapper.updateStatus(tenantId, orderId, SHIPPED_STATUS, RECEIVED_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before receipt could be recorded: " + orderId);
    }
    auditLogApplicationService.recordTenantAction(
        PURCHASE_ORDER_RECEIVED_ACTION,
        PURCHASE_ORDER_TARGET_TYPE,
        orderId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        PURCHASE_ORDER_RECEIVED_NOTIFICATION_TITLE,
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
}
