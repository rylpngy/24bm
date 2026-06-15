package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.application.ReceiptApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class OrderFulfillmentStateTransitionTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final DeliveryMapper deliveryMapper = org.mockito.Mockito.mock(DeliveryMapper.class);
  private final ReceiptMapper receiptMapper = org.mockito.Mockito.mock(ReceiptMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void supplierConfirmMovesPendingOrderToReadyToShip() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待供应商确认"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待供应商确认", "待发货"))
        .thenReturn(1);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService);

    org.assertj.core.api.Assertions.assertThat(service.confirmCurrentSupplierOrder("po-1").status())
        .isEqualTo("待发货");
    verify(auditLogApplicationService).recordTenantAction("tenant-1", "purchase_order.confirmed", "purchase_order", "po-1");
  }

  @Test
  void supplierConfirmFailsWhenOrderStatusChangesBeforeAtomicUpdate() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待供应商确认"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待供应商确认", "待发货"))
        .thenReturn(0);

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService);

    assertThatThrownBy(() -> service.confirmCurrentSupplierOrder("po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("status changed before supplier confirmation");
  }

  @Test
  void deliveryFailsWhenOrderStatusChangesBeforeAtomicUpdate() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待发货", "已发货"))
        .thenReturn(0);

    DeliveryApplicationService service = new DeliveryApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        auditLogApplicationService,
        notificationApplicationService);

    assertThatThrownBy(() -> service.create("po-1", new CreateDeliveryRequest("顺丰", "SF123")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("status changed before delivery");
  }

  @Test
  void buyerOrderCreationRecordsAuditLogForNewPurchaseOrder() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(awardDecisionMapper.findApprovedForOrder("tenant-1", "award-1", "已通过"))
        .thenReturn(new AwardDecision(
            "award-1",
            "tenant-1",
            "rfq-1",
            "quote-1",
            "supplier-1",
            BigDecimal.valueOf(100),
            "价格最优",
            "已通过",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00")));
    when(purchaseOrderMapper.findByAwardSource("tenant-1", "rfq-1", "supplier-1"))
        .thenReturn(null);
    when(purchaseOrderMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> order(invocation.getArgument(1), "tenant-1", "supplier-1", "待供应商确认"));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService);

    service.createFromAward(new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20")));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("purchase_order.created"),
        org.mockito.ArgumentMatchers.eq("purchase_order"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("po-")));
  }

  @Test
  void supplierDeliveryRecordsAuditLogAfterShipment() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待发货", "已发货"))
        .thenReturn(1);
    when(deliveryMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> new com.procurement.order.domain.Delivery(
            invocation.getArgument(1),
            "tenant-1",
            "po-1",
            "supplier-1",
            "顺丰",
            "SF123",
            "已发货",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00")));

    DeliveryApplicationService service = new DeliveryApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        auditLogApplicationService,
        notificationApplicationService);

    service.create("po-1", new CreateDeliveryRequest("顺丰", "SF123"));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("purchase_order.shipped"),
        org.mockito.ArgumentMatchers.eq("purchase_order"),
        org.mockito.ArgumentMatchers.eq("po-1"));
  }

  @Test
  void receiptFailsWhenOrderStatusChangesBeforeAtomicUpdate() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "已发货", "已收货"))
        .thenReturn(0);

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService);

    assertThatThrownBy(() -> service.create("po-1", new CreateReceiptRequest("验收通过")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("status changed before receipt");

    verify(receiptMapper, never()).findByTenantAndId(anyString(), anyString());
  }

  @Test
  void buyerReceiptRecordsAuditLogAfterReceipt() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "已发货", "已收货"))
        .thenReturn(1);
    when(receiptMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> new Receipt(
            invocation.getArgument(1),
            "tenant-1",
            "po-1",
            "user-buyer",
            "验收通过",
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00")));

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService);

    service.create("po-1", new CreateReceiptRequest("验收通过"));

    verify(auditLogApplicationService).recordTenantAction(
        "purchase_order.received",
        "purchase_order",
        "po-1");
  }

  private PurchaseOrder order(String id, String tenantId, String supplierId, String status) {
    return new PurchaseOrder(
        id,
        tenantId,
        "rfq-1",
        supplierId,
        BigDecimal.valueOf(100),
        status,
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
