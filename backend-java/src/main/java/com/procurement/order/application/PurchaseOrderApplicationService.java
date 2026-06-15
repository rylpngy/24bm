package com.procurement.order.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderApplicationService {
  private static final String APPROVED_STATUS = "已通过";
  private static final String PENDING_SUPPLIER_CONFIRM_STATUS = "待供应商确认";
  private static final String READY_TO_SHIP_STATUS = "待发货";

  private final AwardDecisionMapper awardDecisionMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;

  public PurchaseOrderApplicationService(AwardDecisionMapper awardDecisionMapper, PurchaseOrderMapper purchaseOrderMapper) {
    this.awardDecisionMapper = awardDecisionMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
  }

  public List<PurchaseOrderResponse> listCurrentTenantOrders() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    return purchaseOrderMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PurchaseOrderResponse> listCurrentSupplierOrders() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier order APIs");
    return purchaseOrderMapper.listBySupplier(supplierId).stream()
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
    if (!PENDING_SUPPLIER_CONFIRM_STATUS.equals(order.status())) {
      throw new IllegalStateException("Only pending supplier confirmation orders can be confirmed: " + orderId);
    }

    int updated = purchaseOrderMapper.updateStatus(
        order.tenantId(),
        order.id(),
        PENDING_SUPPLIER_CONFIRM_STATUS,
        READY_TO_SHIP_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("Purchase order status changed before supplier confirmation could be recorded: " + orderId);
    }

    return toResponse(purchaseOrderMapper.findByTenantAndId(order.tenantId(), order.id()));
  }

  @Transactional
  public PurchaseOrderResponse createFromAward(CreatePurchaseOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    AwardDecision award = awardDecisionMapper.findApprovedForOrder(tenantId, request.awardId(), APPROVED_STATUS);
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
        PENDING_SUPPLIER_CONFIRM_STATUS,
        request.expectedReceiptDate());

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
}
