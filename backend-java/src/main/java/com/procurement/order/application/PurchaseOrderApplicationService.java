package com.procurement.order.application;

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
import com.procurement.sourcing.application.OrderAwardQueryService;
import com.procurement.sourcing.application.RfqDemandLinkQueryService;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseOrderApplicationService {
  private com.procurement.buyer.application.BudgetControlService budgetControl;
  @org.springframework.beans.factory.annotation.Autowired
  void setBudgetControlService(com.procurement.buyer.application.BudgetControlService control) { this.budgetControl=control; }
  private final OrderAccessService access;
  private final OrderAwardQueryService awards;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PurchaseOrderStatusTransition purchaseOrderStatusTransition;
  private final OrderLineItemApplicationService orderLineItemApplicationService;
  private final RfqDemandLinkQueryService rfqDemandLinkQueryService;

  public PurchaseOrderApplicationService(
      OrderAccessService access,
      OrderAwardQueryService awards,
      PurchaseOrderMapper purchaseOrderMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PurchaseOrderStatusTransition purchaseOrderStatusTransition,
      OrderLineItemApplicationService orderLineItemApplicationService,
      RfqDemandLinkQueryService rfqDemandLinkQueryService) {
    this.access = access;
    this.awards = awards;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.purchaseOrderStatusTransition = purchaseOrderStatusTransition;
    this.orderLineItemApplicationService = orderLineItemApplicationService;
    this.rfqDemandLinkQueryService = rfqDemandLinkQueryService;
  }

  public List<PurchaseOrderResponse> listCurrentTenantOrders() {
    if (!access.canRead("buyer:order:read")) return List.of();
    return listCurrentTenantOrders(null, null, null);
  }

  public List<PurchaseOrderResponse> listCurrentTenantOrders(String status, String supplierId, String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    var visible = access.visibleOrders("buyer:order:read");
    return purchaseOrderMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(supplierId),
            blankToNull(rfqId))
        .stream()
        .filter(order -> visible.test(order.id()))
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
    tenantFeatureApplicationService.requireHistoricalFulfillment(order.tenantId(), TenantFeatureKey.ORDER);

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
    access.requireOrder(orderId, "buyer:order:manage");
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found: " + orderId);
    }
    if (java.util.Set.of(PurchaseOrderStatus.RECEIVED,"取消协商中","已取消","清算协商中","待清算","已清算").contains(order.status())) {
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
    if(budgetControl!=null) budgetControl.lock(tenantId);
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    AwardDecision award = awards.findApproved(tenantId, request.awardId());
    if (award == null) {
      throw new IllegalArgumentException("Approved award decision not found in tenant scope: " + request.awardId());
    }
    access.requireRfq(award.rfqId());
    awards.requireFinalized(tenantId, award);

    PurchaseOrder existingOrder = purchaseOrderMapper.findByAwardSource(tenantId, award.rfqId(), award.supplierId());
    if (existingOrder != null) {
      return toResponse(existingOrder);
    }

    requireAdmittedSupplier(tenantId, award.supplierId());

    // The admission row lock serializes creators; discard an earlier cached null after waiting.
    existingOrder = purchaseOrderMapper.findByAwardSourceFresh(tenantId, award.rfqId(), award.supplierId());
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
    // 从中标报价复制行项明细,贯通「报价→订单」行级追溯。
    if(budgetControl!=null) budgetControl.recordOrder(tenantId,orderId,award.rfqId());
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

  // 商城直购行(跨模块编排用的简单命令对象,避免暴露 api DTO)。
  public record DirectOrderLine(
      String description, String unit, java.math.BigDecimal quantity, java.math.BigDecimal unitPrice,String sourceSkuId,java.math.BigDecimal reservedStockQty) {
    public DirectOrderLine(String description,String unit,java.math.BigDecimal quantity,java.math.BigDecimal unitPrice) {
      this(description,unit,quantity,unitPrice,null,null);
    }
    public DirectOrderLine(String description,String unit,java.math.BigDecimal quantity,java.math.BigDecimal unitPrice,String sku){this(description,unit,quantity,unitPrice,sku,null);}
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
    return createMallOrder(
        rfqId,
        supplierId,
        amount,
        expectedReceiptDate,
        java.util.List.of(new DirectOrderLine(lineDescription, lineUnit, quantity, unitPrice)));
  }

  // 商城购物车结算:同一供应商的多个商品合并为一张订单(多行明细)。
  @Transactional
  /** 商城结算(M-2):建单后把收货人信息一并写上,供应商发货即可看到收货地址。 */
  public String createMallOrder(
      String rfqId,
      String supplierId,
      java.math.BigDecimal amount,
      java.time.LocalDate expectedReceiptDate,
      java.util.List<DirectOrderLine> lines,
      String deliveryAddress,
      String contactName,
      String contactPhone) {
    String orderId = createMallOrder(rfqId, supplierId, amount, expectedReceiptDate, lines);
    if (deliveryAddress != null && !deliveryAddress.isBlank()) {
      purchaseOrderMapper.updateOrderDetails(
          TenantAccessGuard.requireTenantId("buyer order APIs"), orderId,
          deliveryAddress, contactName, contactPhone, null);
    }
    return orderId;
  }

  @Transactional
  public String createMallOrder(
      String rfqId,
      String supplierId,
      java.math.BigDecimal amount,
      java.time.LocalDate expectedReceiptDate,
      java.util.List<DirectOrderLine> lines) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    if(budgetControl!=null) budgetControl.lock(tenantId);
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    requireAdmittedSupplier(tenantId, supplierId);
    String orderId = newId("po");
    purchaseOrderMapper.insert(
        orderId,
        tenantId,
        rfqId,
        supplierId,
        amount,
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        expectedReceiptDate);
    if(budgetControl!=null) budgetControl.recordOrder(tenantId,orderId,rfqId);
    int sortNo=0;
    for (DirectOrderLine line : lines) {
      if(line.sourceSkuId()==null) {
        orderLineItemApplicationService.addDirectLine(
            tenantId, orderId, line.description(), line.unit(), line.quantity(), line.unitPrice());
      } else {
        String lineId=orderLineItemApplicationService.addDirectLineWithSource(tenantId,orderId,line.description(),line.unit(),
            line.quantity(),line.unitPrice(),line.sourceSkuId(),++sortNo);
        orderLineItemApplicationService.recordStockReservation(tenantId,lineId,line.reservedStockQty());
      }
    }
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

  // 招标定标转执行(C-7):中标结果经锚点 RFQ 生成执行订单(单行=中标标的总价),
  // 供应商确认后沿既有 发货→验收→发票→付款→合同 链履约。
  @Transactional
  public String createTenderOrder(
      String rfqId,
      String supplierId,
      java.math.BigDecimal amount,
      java.time.LocalDate expectedReceiptDate,
      String lineDescription) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer order APIs");
    if(budgetControl!=null) budgetControl.lock(tenantId);
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.ORDER);
    requireAdmittedSupplier(tenantId, supplierId);
    String orderId = newId("po");
    purchaseOrderMapper.insert(
        orderId,
        tenantId,
        rfqId,
        supplierId,
        amount,
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        expectedReceiptDate);
    if(budgetControl!=null) budgetControl.recordOrder(tenantId,orderId,rfqId);
    orderLineItemApplicationService.addDirectLine(
        tenantId, orderId, lineDescription, "项", java.math.BigDecimal.ONE, amount);
    auditLogApplicationService.recordTenantAction(
        PurchaseOrderAuditAction.CREATED,
        AuditTargetType.PURCHASE_ORDER,
        orderId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        supplierId,
        NotificationTitle.PURCHASE_ORDER_PENDING_CONFIRMATION,
        "中标执行订单 " + orderId + " 已生成(依据中标通知书),请及时确认订单。");
    return orderId;
  }

  private void requireAdmittedSupplier(String tenantId, String supplierId) {
    if (!"已准入".equals(purchaseOrderMapper.lockSupplierAdmissionStatus(tenantId, supplierId))) {
      throw new IllegalStateException("供应商未准入或已被限制合作，不能生成新订单；既有订单不受影响。");
    }
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
        orderLineItemApplicationService.listForOrder(order.tenantId(), order.id()),
        sourceMethod(order));
  }

  // 订单来源采购方式:回查关联 RFQ 的 method(商城直采/询比/竞价等);无关联或已删除时为 null。
  private String sourceMethod(PurchaseOrder order) {
    if (order.rfqId() == null || order.rfqId().isBlank()) {
      return null;
    }
    return rfqDemandLinkQueryService.findRfqMethod(order.tenantId(), order.rfqId());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
