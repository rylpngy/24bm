package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.CreateAfterSalesRequest;
import com.procurement.mall.api.CreateMallReviewRequest;
import com.procurement.mall.api.HandleAfterSalesRequest;
import com.procurement.mall.domain.MallAfterSales;
import com.procurement.mall.domain.MallAfterSalesPolicy;
import com.procurement.mall.domain.MallReview;
import com.procurement.mall.infrastructure.MallServiceMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.PurchaseOrderQueryService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 售后与评价(M-4)。
 *
 * <p>两者都以订单行为锚点,并以订单状态为前置:发货后才可申请售后,收货后才可评价——
 * 没收到货就退换或打分既没有业务意义,也容易被用来刷分。
 */
@Service
public class MallServiceApplicationService {

  private static final String AUDIT_TARGET = "mall_service";

  private final MallServiceMapper mallServiceMapper;
  private final PurchaseOrderQueryService purchaseOrderQueryService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final com.procurement.order.application.OrderAccessService access;

  public MallServiceApplicationService(
      MallServiceMapper mallServiceMapper,
      PurchaseOrderQueryService purchaseOrderQueryService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      com.procurement.order.application.OrderAccessService access) {
    this.mallServiceMapper = mallServiceMapper;
    this.purchaseOrderQueryService = purchaseOrderQueryService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.access = access;
  }

  // ── 买方:申请售后 / 评价 ───────────────────────────────────
  public List<MallAfterSales> listAfterSalesForBuyer() {
    return visibleAfterSales("buyer:order:read");
  }

  private List<MallAfterSales> visibleAfterSales(String permission) {
    var visible = access.visibleOrders(permission);
    return mallServiceMapper.listByTenant(TenantAccessGuard.requireTenantId("buyer mall APIs"))
        .stream().filter(row -> visible.test(row.orderId())).toList();
  }

  @Transactional
  public List<MallAfterSales> applyAfterSales(CreateAfterSalesRequest request) {
    access.requireOrder(request.orderId(), "buyer:mall:purchase");
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    PurchaseOrderQueryService.OrderLineView line =
        purchaseOrderQueryService.findLineForTenant(tenantId, request.orderId(), request.orderLineId());
    if (line == null) {
      throw new IllegalArgumentException("订单行不存在: " + request.orderLineId());
    }
    MallAfterSalesPolicy.requireApplicable(
        line.orderStatus(), request.type(), request.quantity(), request.reason());
    MallAfterSalesPolicy.requireWithinOrderedQuantity(line.quantity(), request.quantity());

    String id = "mas-" + UUID.randomUUID();
    mallServiceMapper.insertAfterSales(
        id, tenantId, request.orderId(), request.orderLineId(), line.supplierId(),
        request.type(), request.quantity(), request.reason().trim());
    auditLogApplicationService.recordTenantAction(
        "mall_after_sales.applied", AUDIT_TARGET, id);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId, line.supplierId(), "商城售后申请",
        line.description() + " 提出" + request.type() + "申请:" + request.reason().trim());
    return visibleAfterSales("buyer:mall:purchase");
  }

  @Transactional
  public List<MallReview> submitReview(CreateMallReviewRequest request) {
    access.requireOrder(request.orderId(), "buyer:mall:purchase");
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    PurchaseOrderQueryService.OrderLineView line =
        purchaseOrderQueryService.findLineForTenant(tenantId, request.orderId(), request.orderLineId());
    if (line == null) {
      throw new IllegalArgumentException("订单行不存在: " + request.orderLineId());
    }
    MallAfterSalesPolicy.requireReviewable(line.orderStatus(), request.rating());
    if (mallServiceMapper.countReviewForLine(tenantId, request.orderLineId()) > 0) {
      throw new IllegalStateException("该订单行已评价过,不可重复评价");
    }
    String id = "mrv-" + UUID.randomUUID();
    mallServiceMapper.insertReview(
        id, tenantId, request.orderId(), request.orderLineId(), request.productId(),
        line.supplierId(), request.rating(),
        request.content() == null ? "" : request.content().trim());
    auditLogApplicationService.recordTenantAction("mall_review.submitted", AUDIT_TARGET, id);
    return visibleReviews("buyer:mall:purchase");
  }

  public List<MallReview> listReviewsForBuyer() {
    return visibleReviews("buyer:order:read");
  }

  private List<MallReview> visibleReviews(String permission) {
    var visible = access.visibleOrders(permission);
    return mallServiceMapper.listReviewsByTenant(
        TenantAccessGuard.requireTenantId("buyer mall APIs")).stream()
        .filter(row -> visible.test(row.orderId())).toList();
  }

  public List<MallReview> listReviewsForProduct(String productId) {
    return mallServiceMapper.listReviewsForProduct(
        TenantAccessGuard.requireTenantId("buyer mall APIs"), productId);
  }

  // ── 供应商:处理售后 ───────────────────────────────────────
  public List<MallAfterSales> listAfterSalesForSupplier() {
    return mallServiceMapper.listBySupplier(
        TenantAccessGuard.requireSupplierId("supplier mall APIs"));
  }

  @Transactional
  public List<MallAfterSales> handleAfterSales(String afterSalesId, HandleAfterSalesRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallAfterSales current = mallServiceMapper.findForSupplier(supplierId, afterSalesId);
    if (current == null) {
      throw new IllegalArgumentException("售后单不存在或不属于本供应商: " + afterSalesId);
    }
    MallAfterSalesPolicy.requireHandleable(current.status(), request.status(), request.reply());
    mallServiceMapper.handleBySupplier(
        afterSalesId, supplierId, request.status(),
        request.reply() == null ? null : request.reply().trim());
    auditLogApplicationService.recordTenantAction(
        current.tenantId(), "mall_after_sales.handled", AUDIT_TARGET,
        afterSalesId + " → " + request.status());
    notificationApplicationService.notifyActiveTenantUsers(
        current.tenantId(), "商城售后处理结果",
        current.type() + "申请已" + request.status()
        + (request.reply() == null || request.reply().isBlank() ? "" : ":" + request.reply().trim()));
    return listAfterSalesForSupplier();
  }
}
