package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.api.ReceiptLineItemRequest;
import com.procurement.order.api.ReceiptLineItemResponse;
import com.procurement.order.api.ReceiptResponse;
import com.procurement.order.domain.OrderLineItem;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderDocumentUniquenessPolicy;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.domain.Receipt;
import com.procurement.order.domain.ReceiptInspection;
import com.procurement.order.domain.ReceiptLineItem;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptLineItemMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptApplicationService {
  private final OrderAccessService access;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final DeliveryMapper deliveryMapper;
  private final ReceiptMapper receiptMapper;
  private final OrderLineItemMapper orderLineItemMapper;
  private final ReceiptLineItemMapper receiptLineItemMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;

  public ReceiptApplicationService(
      OrderAccessService access,
      PurchaseOrderMapper purchaseOrderMapper,
      DeliveryMapper deliveryMapper,
      ReceiptMapper receiptMapper,
      OrderLineItemMapper orderLineItemMapper,
      ReceiptLineItemMapper receiptLineItemMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition) {
    this.access = access;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.deliveryMapper = deliveryMapper;
    this.receiptMapper = receiptMapper;
    this.orderLineItemMapper = orderLineItemMapper;
    this.receiptLineItemMapper = receiptLineItemMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
  }

  public List<ReceiptResponse> listCurrentTenantReceipts(String orderId, String receiverId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer receipt APIs");
    var visible = access.visibleOrders("buyer:receipt:read");
    return receiptMapper.listByTenantFiltered(
            tenantId,
            blankToNull(orderId),
            blankToNull(receiverId))
        .stream()
        .filter(receipt -> visible.test(receipt.orderId()))
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ReceiptResponse create(String orderId, CreateReceiptRequest request) {
    access.requireOrder(orderId, "buyer:receipt:manage");
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

    int received = request.receivedQuantity() == null ? 0 : request.receivedQuantity();
    int qualified = request.qualifiedQuantity() == null ? 0 : request.qualifiedQuantity();
    String conclusion = ReceiptInspection.conclude(received, qualified);
    ReceiptInspection.requireDisposition(conclusion, request.disposition());

    String receiptId = newId("receipt");
    receiptMapper.insert(
        receiptId,
        tenantId,
        orderId,
        userId,
        request.result(),
        received,
        qualified,
        request.qualityNote() == null ? "" : request.qualityNote(),
        conclusion,
        ReceiptInspection.ALL_QUALIFIED.equals(conclusion) ? null : request.disposition(),
        request.dispositionNote() == null ? "" : request.dispositionNote());
    persistLineItems(tenantId, orderId, receiptId, request.lineItems());
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
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        order.supplierId(),
        NotificationTitle.PURCHASE_ORDER_RECEIVED,
        "采购订单 " + order.id() + " 已完成收货验收，供应商可提交发票。");

    return toResponse(receiptMapper.findByTenantAndId(tenantId, receiptId));
  }

  // 逐行验收落库:按订单行项冗余 description/unit/ordered_quantity,记录收货/合格数量。
  private void persistLineItems(
      String tenantId, String orderId, String receiptId, List<ReceiptLineItemRequest> lineItems) {
    if (lineItems == null || lineItems.isEmpty()) {
      return;
    }
    Map<String, OrderLineItem> orderLines =
        orderLineItemMapper.listByOrder(tenantId, orderId).stream()
            .collect(Collectors.toMap(OrderLineItem::id, Function.identity()));
    int sortNo = 0;
    for (ReceiptLineItemRequest line : lineItems) {
      OrderLineItem orderLine = orderLines.get(line.orderLineId());
      if (orderLine == null) {
        throw new IllegalArgumentException(
            "Order line not found for receipt line in order " + orderId + ": " + line.orderLineId());
      }
      BigDecimal received = line.receivedQuantity() == null ? BigDecimal.ZERO : line.receivedQuantity();
      BigDecimal qualified = line.qualifiedQuantity() == null ? BigDecimal.ZERO : line.qualifiedQuantity();
      receiptLineItemMapper.insert(
          "rli-" + UUID.randomUUID(),
          tenantId,
          receiptId,
          orderLine.id(),
          orderLine.description(),
          orderLine.unit(),
          orderLine.quantity(),
          received,
          qualified,
          sortNo++);
    }
  }

  private ReceiptResponse toResponse(Receipt receipt) {
    return new ReceiptResponse(
        receipt.id(),
        receipt.tenantId(),
        receipt.orderId(),
        receipt.receiverId(),
        receipt.result(),
        receipt.receivedAt(),
        receipt.receivedQuantity(),
        receipt.qualifiedQuantity(),
        receipt.qualityNote(),
        lineItemResponses(receipt.tenantId(), receipt.id()),
        receipt.inspectionConclusion(),
        receipt.disposition(),
        receipt.dispositionNote());
  }

  private List<ReceiptLineItemResponse> lineItemResponses(String tenantId, String receiptId) {
    List<ReceiptLineItem> lines = receiptLineItemMapper.listByReceipt(tenantId, receiptId);
    if (lines == null) {
      return List.of();
    }
    return lines.stream()
        .map(
            l ->
                new ReceiptLineItemResponse(
                    l.id(),
                    l.orderLineId(),
                    l.description(),
                    l.unit(),
                    l.orderedQuantity(),
                    l.receivedQuantity(),
                    l.qualifiedQuantity()))
        .toList();
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
