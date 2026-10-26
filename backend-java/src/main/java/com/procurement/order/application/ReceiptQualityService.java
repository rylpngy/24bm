package com.procurement.order.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.application.PhysicalAfterSalesService;
import com.procurement.order.api.ReceiptQualityContracts.*;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReceiptQualityService {
  private final ReceiptQualityMapper mapper;
  private final ReceiptMapper receipts;
  private final ReceiptDispositionReviewMapper reviews;
  private final PurchaseOrderMapper orders;
  private final OrderAccessService access;
  private final PermissionService permissions;
  private final PhysicalAfterSalesService physical;
  private final AuditLogApplicationService audit;

  public ReceiptQualityService(
      ReceiptQualityMapper mapper,
      ReceiptMapper receipts,
      ReceiptDispositionReviewMapper reviews,
      PurchaseOrderMapper orders,
      OrderAccessService access,
      PermissionService permissions,
      PhysicalAfterSalesService physical,
      AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.receipts = receipts;
    this.reviews = reviews;
    this.orders = orders;
    this.access = access;
    this.permissions = permissions;
    this.physical = physical;
    this.audit = audit;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("receipt quality");
  }

  private Receipt receipt(String id, boolean write) {
    var r = receipts.findByTenantAndId(tenant(), id);
    if (r == null) throw new IllegalArgumentException("验收记录不存在");
    access.requireOrder(r.orderId(), write ? "buyer:receipt:manage" : "buyer:receipt:read");
    return r;
  }

  public View view(String id) {
    var r = receipt(id, false);
    var order = orders.findByTenantAndId(tenant(), r.orderId());
    boolean allowed =
        permissions.currentUserHas("buyer:receipt:manage")
            && permissions.currentUserHas("buyer:workflow:review")
            && "退货换货".equals(r.disposition())
            && !mapper.conceded(tenant(), id)
            && !mapper.frozen(tenant(), r.orderId(), order.rfqId());
    return new View(
        id,
        r.orderId(),
        mapper.lines(tenant(), id),
        mapper.candidates(tenant(), r.orderId()),
        mapper.resolutions(tenant(), id),
        allowed,
        "只核销对应验收行的不合格数量；退货须继续退款清算，换货须已有买方合格复验。原始验收不覆盖。");
  }

  @Transactional
  public View resolve(String id, Request request) {
    var initial = receipt(id, true);
    permissions.require("buyer:workflow:review");
    var order = orders.findByTenantAndId(tenant(), initial.orderId());
    if (order == null || reviews.lockRfq(tenant(), order.rfqId()) == null)
      throw new IllegalStateException("验收关联采购项目缺失");
    orders.lockByTenantAndId(tenant(), order.id());
    var r = reviews.lockReceipt(tenant(), id);
    var prior =
        mapper.resolutions(tenant(), id).stream()
            .filter(x -> x.afterSalesId().equals(request.afterSalesId()))
            .findFirst()
            .orElse(null);
    if (prior != null) {
      if (!prior.receiptLineId().equals(request.receiptLineId())
          || !prior.reason().equals(request.reason().trim()))
        throw new IllegalStateException("此售后已核销，不得覆盖或重复分摊");
      return view(id);
    }
    if (!view(id).canResolve()) throw new IllegalStateException("当前验收已让步接收、归档或进入清算，不能重复核销");
    var line =
        mapper.lines(tenant(), id).stream()
            .filter(x -> x.receiptLineId().equals(request.receiptLineId()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("验收行不属于当前记录"));
    var source =
        mapper.candidates(tenant(), r.orderId()).stream()
            .filter(
                x ->
                    x.afterSalesId().equals(request.afterSalesId())
                        && x.orderLineId().equals(line.orderLineId()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("须选择本订单行已完成实物核验的退货或换货，不得跨行或重复使用"));
    if (!line.valid() || source.quantity().compareTo(line.unresolvedQuantity()) > 0)
      throw new IllegalStateException("核销数量超过该验收行尚未处置的不合格数量，请按批次分单");
    var proof = physical.file(source.afterSalesId(), source.physicalEventId(), false);
    if (!proof.sha256().equals(source.physicalSha256()))
      throw new IllegalStateException("实物核验凭证摘要不一致");
    var values = new HashMap<String, Object>();
    values.put("id", "rqs-" + UUID.randomUUID());
    values.put("t", tenant());
    values.put("receipt", id);
    values.put("line", line.receiptLineId());
    values.put("afterSales", source.afterSalesId());
    values.put("quantity", source.quantity());
    values.put("kind", source.kind());
    values.put("event", source.physicalEventId());
    values.put("sha", source.physicalSha256());
    values.put("reason", request.reason().trim());
    values.put("actor", TenantAccessGuard.requireUserId("quality resolution"));
    mapper.insert(values);
    audit.recordTenantAction(
        "receipt.quality_resolved",
        "receipt",
        id + " / " + source.afterSalesId() + " / " + values.get("id"));
    return view(id);
  }
}
