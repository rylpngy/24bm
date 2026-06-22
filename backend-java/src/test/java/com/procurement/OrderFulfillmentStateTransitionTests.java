package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
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
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class OrderFulfillmentStateTransitionTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final DeliveryMapper deliveryMapper = org.mockito.Mockito.mock(DeliveryMapper.class);
  private final ReceiptMapper receiptMapper = org.mockito.Mockito.mock(ReceiptMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);

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
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

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
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

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
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.create("po-1", new CreateDeliveryRequest("顺丰", "SF123")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("status changed before delivery");
  }

  @Test
  void deliveryRejectsDuplicateDeliveryForSameOrderBeforeInsert() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    when(deliveryMapper.countByTenantAndOrder("tenant-1", "po-1"))
        .thenReturn(1);

    DeliveryApplicationService service = new DeliveryApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.create("po-1", new CreateDeliveryRequest("顺丰", "SF123")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has a delivery");

    verify(deliveryMapper, never()).insert(
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString());
  }

  @Test
  void receiptRequiresShippedDeliveryBeforeReceiving() {
    PurchaseOrderStatusTransition transition = new PurchaseOrderStatusTransition();

    assertThatCode(() -> transition.requireShippedDelivery(1, "po-1"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> transition.requireShippedDelivery(0, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Shipped delivery not found for receipt: po-1");
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
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已定标", "supplier-1"));
    when(purchaseOrderMapper.findByAwardSource("tenant-1", "rfq-1", "supplier-1"))
        .thenReturn(null);
    when(purchaseOrderMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> order(invocation.getArgument(1), "tenant-1", "supplier-1", "待供应商确认"));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    service.createFromAward(new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20")));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("purchase_order.created"),
        org.mockito.ArgumentMatchers.eq("purchase_order"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("po-")));
  }

  @Test
  void buyerOrderCreationReturnsExistingOrderWhenConcurrentInsertAlreadyCreatedIt() {
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
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已定标", "supplier-1"));
    when(purchaseOrderMapper.findByAwardSource("tenant-1", "rfq-1", "supplier-1"))
        .thenReturn(null)
        .thenReturn(order("po-existing", "tenant-1", "supplier-1", "待供应商确认"));
    doThrow(new DuplicateKeyException("duplicate award order"))
        .when(purchaseOrderMapper)
        .insert(
            anyString(),
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.eq("rfq-1"),
            org.mockito.ArgumentMatchers.eq("supplier-1"),
            org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(100)),
            org.mockito.ArgumentMatchers.eq("待供应商确认"),
            org.mockito.ArgumentMatchers.eq(LocalDate.parse("2026-06-20")));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    var response = service.createFromAward(new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20")));

    org.assertj.core.api.Assertions.assertThat(response.id()).isEqualTo("po-existing");
    verify(auditLogApplicationService, never()).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("purchase_order.created"),
        org.mockito.ArgumentMatchers.eq("purchase_order"),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void buyerOrderCreationRequiresFinalizedRfqAwardBeforeCreatingOrder() {
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
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "定标审批中", null));
    when(purchaseOrderMapper.findByAwardSource("tenant-1", "rfq-1", "supplier-1"))
        .thenReturn(null);
    when(purchaseOrderMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> order(invocation.getArgument(1), "tenant-1", "supplier-1", "待供应商确认"));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.createFromAward(new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20"))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ award is not finalized for order creation: rfq-1");

    verify(purchaseOrderMapper, never()).insert(
        anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void buyerOrderCreationRejectsAwardThatDoesNotMatchFinalizedRfqSupplier() {
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
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已定标", "supplier-2"));

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.createFromAward(new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20"))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ award is not finalized for order creation: rfq-1");

    verify(purchaseOrderMapper, never()).findByAwardSource("tenant-1", "rfq-1", "supplier-1");
    verify(purchaseOrderMapper, never()).insert(
        anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void listBuyerOrdersAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseOrderMapper.listByTenantFiltered("tenant-1", "待供应商确认", "supplier-1", "rfq-1"))
        .thenReturn(java.util.List.of());

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    service.listCurrentTenantOrders("待供应商确认", "supplier-1", "rfq-1");

    verify(purchaseOrderMapper).listByTenantFiltered("tenant-1", "待供应商确认", "supplier-1", "rfq-1");
  }

  @Test
  void listSupplierOrdersAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.listBySupplierFiltered("supplier-1", "待发货", "rfq-1"))
        .thenReturn(java.util.List.of());

    PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
        awardDecisionMapper,
        rfqMapper,
        purchaseOrderMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    service.listCurrentSupplierOrders("待发货", "rfq-1");

    verify(purchaseOrderMapper).listBySupplierFiltered("supplier-1", "待发货", "rfq-1");
  }

  @Test
  void listBuyerReceiptsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(receiptMapper.listByTenantFiltered("tenant-1", "po-1", "user-buyer"))
        .thenReturn(List.of());

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    service.listCurrentTenantReceipts("po-1", "user-buyer");

    verify(receiptMapper).listByTenantFiltered("tenant-1", "po-1", "user-buyer");
  }

  @Test
  void listSupplierDeliveriesAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(deliveryMapper.listBySupplierFiltered("supplier-1", "已发货", "po-1"))
        .thenReturn(List.of());

    DeliveryApplicationService service = new DeliveryApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    service.listCurrentSupplierDeliveries("已发货", "po-1");

    verify(deliveryMapper).listBySupplierFiltered("supplier-1", "已发货", "po-1");
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
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

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
    when(deliveryMapper.countByTenantOrderAndStatus("tenant-1", "po-1", "已发货"))
        .thenReturn(1);
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "已发货", "已收货"))
        .thenReturn(0);

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.create("po-1", new CreateReceiptRequest("验收通过")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("status changed before receipt");

    verify(receiptMapper, never()).findByTenantAndId(anyString(), anyString());
  }

  @Test
  void receiptRejectsOrderWithoutTenantShippedDeliveryBeforeInsert() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(deliveryMapper.countByTenantOrderAndStatus("tenant-1", "po-1", "已发货"))
        .thenReturn(0);

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.create("po-1", new CreateReceiptRequest("验收通过")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Shipped delivery not found for receipt");

    verify(receiptMapper, never()).insert(
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString());
  }

  @Test
  void receiptRejectsDuplicateReceiptForSameOrderBeforeInsert() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(deliveryMapper.countByTenantOrderAndStatus("tenant-1", "po-1", "已发货"))
        .thenReturn(1);
    when(receiptMapper.countByTenantAndOrder("tenant-1", "po-1"))
        .thenReturn(1);

    ReceiptApplicationService service = new ReceiptApplicationService(
        purchaseOrderMapper,
        deliveryMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

    assertThatThrownBy(() -> service.create("po-1", new CreateReceiptRequest("验收通过")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has a receipt");

    verify(receiptMapper, never()).insert(
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString());
  }

  @Test
  void buyerReceiptRecordsAuditLogAfterReceipt() {
    TenantContext.set("tenant-1", null, "user-buyer");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(deliveryMapper.countByTenantOrderAndStatus("tenant-1", "po-1", "已发货"))
        .thenReturn(1);
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
        deliveryMapper,
        receiptMapper,
        auditLogApplicationService,
        notificationApplicationService,
        tenantFeatureApplicationService,
        new PurchaseOrderStatusTransition());

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

  private Rfq rfq(String id, String tenantId, String status, String awardedSupplierId) {
    return new Rfq(
        id,
        tenantId,
        "办公设备询价",
        status,
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "buyer-user",
        awardedSupplierId,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }
}
