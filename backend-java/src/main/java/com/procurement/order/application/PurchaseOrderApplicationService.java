package com.procurement.order.application;

import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderAuditAction;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderApplicationService {
  private static final String PURCHASE_ORDER_CONFIRMED_NOTIFICATION_TITLE = "采购订单已确认";
  private static final String ORDER_FEATURE = "order";

  private final AwardDecisionMapper awardDecisionMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;

  public PurchaseOrderApplicationService(
      AwardDecisionMapper awardDecisionMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition) {
    this.awardDecisionMapper = awardDecisionMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
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
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), ORDER_FEATURE);

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
        PURCHASE_ORDER_CONFIRMED_NOTIFICATION_TITLE,
        "采购订单 " + order.id() + " 已由供应商确认，进入待发货。");

    return toResponse(purchaseOrderMapper.findByTenantAndId(order.tenantId(), order.id()));
  }

  @Transactional
  public PurchaseOrderResponse createFromAward(CreatePurchaseOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, ORDER_FEATURE);
    AwardDecision award = awardDecisionMapper.findApprovedForOrder(tenantId, request.awardId(), ApprovalStatus.APPROVED);
    if (award == null) {
      throw new IllegalArgumentException("Approved award decision not found in tenant scope: " + request.awardId());
    }

    PurchaseOrder existingOrder = purchaseOrderMapper.findByAwardSource(tenantId, award.rfqId(), award.supplierId());
    if (existingOrder != null) {
      return toResponse(existingOrder);
    }

    String orderId = newId("po");
    purchaseOrderMapper.insert(
        orderId,
        tenantId,
        award.rfqId(),
        award.supplierId(),
        award.amount(),
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        request.expectedReceiptDate());
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.CREATED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);

    return toResponse(purchaseOrderMapper.findByTenantAndId(tenantId, orderId));
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
        order.updatedAt());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
