package com.procurement.order.application;

import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.api.UpdatePurchaseOrderRequest;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderApplicationService {
  private final AwardDecisionMapper awardDecisionMapper;
  private final RfqMapper rfqMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;
  private final OrderLineItemApplicationService orderLineItemApplicationService;

  public PurchaseOrderApplicationService(
      AwardDecisionMapper awardDecisionMapper,
      RfqMapper rfqMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition,
      OrderLineItemApplicationService orderLineItemApplicationService) {
    this.awardDecisionMapper = awardDecisionMapper;
    this.rfqMapper = rfqMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
    this.orderLineItemApplicationService = orderLineItemApplicationService;
  }

  public List<PurchaseOrderResponse> listCurrentTenantOrders() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    return purchaseOrderMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PurchaseOrderResponse> listCurrentTenantOrders(String status, String supplierId, String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    return purchaseOrderMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(supplierId),
            blankToNull(rfqId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PurchaseOrderResponse> listCurrentSupplierOrders() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier order APIs");
    return purchaseOrderMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PurchaseOrderResponse> listCurrentSupplierOrders(String status, String rfqId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier order APIs");
    return purchaseOrderMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(status),
            blankToNull(rfqId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public PurchaseOrderResponse confirmCurrentSupplierOrder(String orderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier order APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    purchaseOrderStatusTransition.requireSupplierConfirmation(order.status(), orderId);
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), TenantFeatureKey.ORDER);

    int updated = purchaseOrderMapper.updateStatus(
        order.tenantId(),
        order.id(),
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        PurchaseOrderStatus.PENDING_SHIPMENT);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before supplier confirmation could be recorded: " + orderId);
    }
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        PurchaseOrderAuditAction.CONFIRMED,
        AuditTargetType.PURCHASE_ORDER,
        order.id());
    notificationApplicationService.notifyActiveTenantUsers(
        order.tenantId(),
        NotificationTitle.PURCHASE_ORDER_CONFIRMED,
        "采购订单 " + order.id() + " 已由供应商确认，进入待发货。");

    return toResponse(purchaseOrderMapper.findByTenantAndId(order.tenantId(), order.id()));
  }

  @Transactional
  public PurchaseOrderResponse update(String orderId, UpdatePurchaseOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found: " + orderId);
    }
    if (PurchaseOrderStatus.RECEIVED.equals(order.status())) {
      throw new IllegalStateException("Received purchase order cannot be updated: " + orderId);
    }

    int updated = purchaseOrderMapper.updateExpectedReceiptDate(
        tenantId,
        orderId,
        request.expectedReceiptDate());
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before update could be saved: " + orderId);
    }
    purchaseOrderMapper.updateOrderDetails(
        tenantId,
        orderId,
        blankToNull(request.deliveryAddress()),
        blankToNull(request.contactName()),
        blankToNull(request.contactPhone()),
        blankToNull(request.paymentTerms()));
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.UPDATED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        order.supplierId(),
        NotificationTitle.PURCHASE_ORDER_EXPECTED_RECEIPT_UPDATED,
        "采购订单 " + orderId + " 预计到货日期已更新为 "
            + request.expectedReceiptDate()
            + "，请按最新交期履约。");

    return toResponse(purchaseOrderMapper.findByTenantAndId(tenantId, orderId));
  }

  @Transactional
  public PurchaseOrderResponse createFromAward(CreatePurchaseOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    AwardDecision award = awardDecisionMapper.findApprovedForOrder(tenantId, request.awardId(), ApprovalStatus.APPROVED);
    if (award == null) {
      throw new IllegalArgumentException("Approved award decision not found in tenant scope: " + request.awardId());
    }
    requireFinalizedRfqAward(tenantId, award);

    PurchaseOrder existingOrder = purchaseOrderMapper.findByAwardSource(tenantId, award.rfqId(), award.supplierId());
    if (existingOrder != null) {
      return toResponse(existingOrder);
    }

    String orderId = newId("po");
    try {
      purchaseOrderMapper.insert(
          orderId,
          tenantId,
          award.rfqId(),
          award.supplierId(),
          award.amount(),
          PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
          request.expectedReceiptDate());
    } catch (DuplicateKeyException exception) {
      PurchaseOrder concurrentOrder = purchaseOrderMapper.findByAwardSource(tenantId, award.rfqId(), award.supplierId());
      if (concurrentOrder != null) {
        return toResponse(concurrentOrder);
      }
      throw exception;
    }
    // 从中标报价复制行项明细,贯通「报价→订单」行级追溯。
    orderLineItemApplicationService.copyFromQuote(tenantId, orderId, award.quoteId());
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.CREATED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        award.supplierId(),
        NotificationTitle.PURCHASE_ORDER_PENDING_CONFIRMATION,
        "采购订单 " + orderId + " 已生成，请及时确认订单。");

    return toResponse(purchaseOrderMapper.findByTenantAndId(tenantId, orderId));
  }

  // 商城直购订单:由商城模块编排调用,锚点 RFQ 已就位;返回订单号(避免跨模块暴露 api DTO)。
  @Transactional
  public String createMallOrder(
      String rfqId,
      String supplierId,
      java.math.BigDecimal amount,
      java.time.LocalDate expectedReceiptDate,
      String lineDescription,
      String lineUnit,
      java.math.BigDecimal quantity,
      java.math.BigDecimal unitPrice) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    String orderId = newId("po");
    purchaseOrderMapper.insert(
        orderId,
        tenantId,
        rfqId,
        supplierId,
        amount,
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        expectedReceiptDate);
    orderLineItemApplicationService.addDirectLine(
        tenantId, orderId, lineDescription, lineUnit, quantity, unitPrice);
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.CREATED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        supplierId,
        NotificationTitle.PURCHASE_ORDER_PENDING_CONFIRMATION,
        "商城直购订单 " + orderId + " 已生成，请及时确认订单。");
    return orderId;
  }

  private PurchaseOrderResponse toResponse(PurchaseOrder order) {
    return new PurchaseOrderResponse(
        order.id(),
        order.tenantId(),
        order.rfqId(),
        order.supplierId(),
        order.amount(),
        order.status(),
        order.expectedReceiptDate(),
        order.createdAt(),
        order.updatedAt(),
        order.deliveryAddress(),
        order.contactName(),
        order.contactPhone(),
        order.paymentTerms(),
        orderLineItemApplicationService.listForOrder(order.tenantId(), order.id()));
  }

  private void requireFinalizedRfqAward(String tenantId, AwardDecision award) {
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, award.rfqId());
    if (rfq == null
        || !ApprovalStatus.APPROVED.equals(award.approvedStatus())
        || !"已定标".equals(rfq.status())
        || !award.supplierId().equals(rfq.awardedSupplierId())) {
      throw new IllegalStateException("RFQ award is not finalized for order creation: " + award.rfqId());
    }
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
