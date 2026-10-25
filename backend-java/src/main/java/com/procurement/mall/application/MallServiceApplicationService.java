package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.CreateAfterSalesRequest;
import com.procurement.mall.api.CreateMallReviewRequest;
import com.procurement.mall.api.HandleAfterSalesRequest;
import com.procurement.mall.domain.MallAfterSales;
import com.procurement.mall.domain.MallAfterSalesEvent;
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
    requireLockedOrder(tenantId, request.orderId());
    if(mallServiceMapper.projectLiquidated(tenantId,request.orderId()))throw new IllegalStateException("项目已完成终止清算，须先办理清算更正，不能直接新增退换货或售后责任");
    PurchaseOrderQueryService.OrderLineView line =
        purchaseOrderQueryService.findLineForTenant(tenantId, request.orderId(), request.orderLineId());
    if (line == null) {
      throw new IllegalArgumentException("订单行不存在: " + request.orderLineId());
    }
    MallAfterSalesPolicy.requireApplicable(
        line.orderStatus(), request.type(), request.quantity(), request.reason());
    MallAfterSalesPolicy.requireWithinOrderedQuantity(line.quantity(), request.quantity());
    MallAfterSalesPolicy.requireCumulativeQuantity(line.quantity(),
        mallServiceMapper.claimedQuantity(tenantId, request.orderLineId()), request.quantity());

    String id = "mas-" + UUID.randomUUID();
    mallServiceMapper.insertAfterSales(
        id, tenantId, request.orderId(), request.orderLineId(), line.supplierId(),
        request.type(), request.quantity(), request.reason().trim());
    recordEvent(id, "buyer", null, MallAfterSalesPolicy.STATUS_PENDING, request.reason().trim(), null);
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
    requireLockedOrder(tenantId, request.orderId());
    PurchaseOrderQueryService.OrderLineView line =
        purchaseOrderQueryService.findLineForTenant(tenantId, request.orderId(), request.orderLineId());
    if (line == null) {
      throw new IllegalArgumentException("订单行不存在: " + request.orderLineId());
    }
    MallAfterSalesPolicy.requireReviewable(line.orderStatus(), request.rating());
    String actualProduct = mallServiceMapper.sourceProduct(tenantId, request.orderId(), request.orderLineId());
    if (request.productId() != null && !request.productId().equals(actualProduct)) {
      throw new IllegalArgumentException("评价商品必须与订单来源SKU一致，历史无来源订单不可绑定商品");
    }
    if (mallServiceMapper.countReviewForLine(tenantId, request.orderLineId()) > 0) {
      throw new IllegalStateException("该订单行已评价过,不可重复评价");
    }
    String id = "mrv-" + UUID.randomUUID();
    mallServiceMapper.insertReview(
        id, tenantId, request.orderId(), request.orderLineId(), actualProduct,
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
    requireLockedOrder(current.tenantId(), current.orderId());
    current = mallServiceMapper.lockForSupplier(supplierId, afterSalesId);
    if (current == null) throw new IllegalStateException("售后单已变更，请刷新");
    MallAfterSalesPolicy.requireHandleable(current.status(), request.status(), request.reply());
    boolean completing = MallAfterSalesPolicy.STATUS_DONE.equals(request.status());
    if (completing && (request.evidenceNo() == null || request.evidenceNo().isBlank())) {
      throw new IllegalArgumentException("完成办理必须填写处理凭据编号");
    }
    String target = completing ? MallAfterSalesPolicy.STATUS_CONFIRMING : request.status();
    if (mallServiceMapper.handleBySupplier(
        afterSalesId, supplierId, target,
        request.reply() == null ? null : request.reply().trim(), current.status()) != 1) {
      throw new IllegalStateException("售后状态已变更，请刷新");
    }
    recordEvent(afterSalesId, "supplier", current.status(), target, request.reply(), request.evidenceNo());
    auditLogApplicationService.recordTenantAction(
        current.tenantId(), "mall_after_sales.handled", AUDIT_TARGET,
        afterSalesId + " → " + target);
    notificationApplicationService.notifyActiveTenantUsers(
        current.tenantId(), "商城售后处理结果",
        current.type() + "申请状态：" + target
        + (request.reply() == null || request.reply().isBlank() ? "" : ":" + request.reply().trim()));
    return listAfterSalesForSupplier();
  }

  @Transactional
  public List<MallAfterSales> buyerAction(String id, String action, String note) {
    MallAfterSales current = requireBuyerCase(id, "buyer:mall:purchase");
    requireLockedOrder(current.tenantId(), current.orderId());
    current = mallServiceMapper.lockForBuyer(current.tenantId(), id);
    if (current == null) throw new IllegalStateException("售后单已变更，请刷新");
    MallAfterSalesPolicy.requireBuyerAction(current.status(), action);
    if (note == null || note.isBlank()) throw new IllegalArgumentException("请填写确认或撤回说明");
    String target = action.equals("confirm") ? MallAfterSalesPolicy.STATUS_DONE : MallAfterSalesPolicy.STATUS_WITHDRAWN;
    if (mallServiceMapper.buyerTransition(current.tenantId(), id, current.status(), target) != 1) {
      throw new IllegalStateException("售后状态已变更，请刷新");
    }
    recordEvent(id, "buyer", current.status(), target, note.trim(), null);
    auditLogApplicationService.recordTenantAction("mall_after_sales." + action, AUDIT_TARGET, id);
    notificationApplicationService.notifyActiveSupplierUsers(current.tenantId(), current.supplierId(),
        "商城售后反馈", current.type() + "申请" + target + "：" + note.trim());
    return visibleAfterSales("buyer:mall:purchase");
  }

  public List<MallAfterSalesEvent> buyerHistory(String id) {
    requireBuyerCase(id, "buyer:order:read");
    return mallServiceMapper.history(TenantAccessGuard.requireTenantId("buyer mall history"), null, id);
  }

  public List<MallAfterSalesEvent> supplierHistory(String id) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    if (mallServiceMapper.findForSupplier(supplierId, id) == null) {
      throw new IllegalArgumentException("售后单不存在或不属于本供应商");
    }
    return mallServiceMapper.history(null, supplierId, id);
  }

  private MallAfterSales requireBuyerCase(String id, String permission) {
    MallAfterSales current = mallServiceMapper.findForBuyer(
        TenantAccessGuard.requireTenantId("buyer mall APIs"), id);
    if (current == null) throw new IllegalArgumentException("售后单不存在或不属于本企业");
    access.requireOrder(current.orderId(), permission);
    return current;
  }

  private void requireLockedOrder(String tenantId, String orderId) {
    if (mallServiceMapper.lockOrder(tenantId, orderId) == null) {
      throw new IllegalArgumentException("订单不存在");
    }
  }

  private void recordEvent(String id, String role, String from, String to, String note, String evidence) {
    mallServiceMapper.insertEvent("mase-" + UUID.randomUUID(), id, TenantAccessGuard.requireUserId("mall after-sales history"), role,
        from, to, note == null ? null : note.trim(), evidence == null ? null : evidence.trim());
  }
}
