package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.api.CreateReceiptDispositionReviewRequest;
import com.procurement.order.domain.Receipt;
import com.procurement.order.domain.ReceiptDispositionReview;
import com.procurement.order.domain.ReceiptInspection;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.order.infrastructure.ReceiptDispositionReviewMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptDispositionReviewApplicationService {
  private final OrderAccessService access;
  private final PermissionService permissions;
  private final PurchaseOrderMapper orders;
  private final ReceiptMapper receipts;
  private final ReceiptDispositionReviewMapper reviews;
  private final AuditLogApplicationService audit;
  private final TenantFeatureApplicationService features;

  public ReceiptDispositionReviewApplicationService(OrderAccessService access, PermissionService permissions,
      PurchaseOrderMapper orders, ReceiptMapper receipts, ReceiptDispositionReviewMapper reviews,
      AuditLogApplicationService audit, TenantFeatureApplicationService features) {
    this.access = access; this.permissions = permissions; this.orders = orders; this.receipts = receipts;
    this.reviews = reviews; this.audit = audit; this.features = features;
  }

  @Transactional(readOnly = true)
  public ReceiptDispositionReview get(String receiptId) {
    String tenant = TenantAccessGuard.requireTenantId("receipt disposition review");
    Receipt receipt = requireReceipt(tenant, receiptId);
    access.requireOrder(receipt.orderId(), "buyer:receipt:read");
    return reviews.find(tenant, receiptId);
  }

  @Transactional
  public ReceiptDispositionReview create(String receiptId, CreateReceiptDispositionReviewRequest request) {
    String tenant = TenantAccessGuard.requireTenantId("receipt disposition review");
    String actor = TenantAccessGuard.requireUserId("receipt disposition review");
    Receipt initial = requireReceipt(tenant, receiptId);
    access.requireOrder(initial.orderId(), "buyer:receipt:manage");
    permissions.require("buyer:workflow:review");
    features.requireHistoricalFulfillment(tenant, TenantFeatureKey.ORDER);
    if (request == null || !Set.of(ReceiptInspection.CONCESSION, "维持退货换货").contains(request.decision() == null ? "" : request.decision())) {
      throw new IllegalArgumentException("须明确选择让步接收或维持退货换货");
    }
    String reason = requireText(request.reason(), 2000, "复核原因");
    String evidence = requireText(request.evidenceNo(), 500, "复核凭证");
    var initialOrder = orders.findByTenantAndId(tenant, initial.orderId());
    if (initialOrder == null || reviews.lockRfq(tenant, initialOrder.rfqId()) == null) {
      throw new IllegalArgumentException("验收关联订单或采购项目不存在");
    }
    // Match archive (RFQ) and payment (invoice) serialization without rewriting their evidence.
    var order = orders.lockByTenantAndId(tenant, initial.orderId());
    Receipt receipt = reviews.lockReceipt(tenant, receiptId);
    if (order == null || receipt == null || !order.id().equals(receipt.orderId())
        || !initialOrder.rfqId().equals(order.rfqId())) {
      throw new IllegalStateException("验收关联关系已变化，请刷新");
    }
    reviews.lockInvoices(tenant, order.id());
    reviews.lockContracts(tenant, order.id());
    var prior = reviews.find(tenant, receiptId);
    if (prior != null) {
      if (prior.decision().equals(request.decision()) && prior.reason().equals(reason) && prior.evidenceNo().equals(evidence)) return prior;
      throw new IllegalStateException("该验收已有不可变复核记录，不得覆盖");
    }
    if (reviews.countFrozenEvidence(tenant, order.id(), order.rfqId()) > 0
        || Set.of("已归档", "已结算", "已完成").contains(order.status())) {
      throw new IllegalStateException("已结算或归档，不得复核");
    }
    if (receipt.receivedQuantity() == null || receipt.qualifiedQuantity() == null
        || receipt.receivedQuantity() <= 0 || receipt.qualifiedQuantity() < 0
        || receipt.qualifiedQuantity() >= receipt.receivedQuantity()
        || !ReceiptInspection.RETURN_REPLACE.equals(receipt.disposition())) {
      throw new IllegalArgumentException("仅可复核仍为退货换货处置的负面验收");
    }
    reviews.insert(new ReceiptDispositionReview("rdr-" + UUID.randomUUID(), tenant, receiptId,
        request.decision(), reason, evidence, actor, null));
    audit.recordTenantAction("receipt.disposition_reviewed", "receipt", receiptId);
    return reviews.find(tenant, receiptId);
  }

  private Receipt requireReceipt(String tenant, String receiptId) {
    var receipt = receipts.findByTenantAndId(tenant, receiptId);
    if (receipt == null) throw new IllegalArgumentException("验收记录不存在或不属于当前租户");
    return receipt;
  }

  private String requireText(String value, int max, String label) {
    if (value == null || value.isBlank() || value.trim().length() > max) {
      throw new IllegalArgumentException(label + "必填且不能超长");
    }
    return value.trim();
  }
}
