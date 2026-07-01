package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.order.api.CreateReceiptRequest;
import com.procurement.order.application.ReceiptApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.domain.Receipt;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ReceiptNotificationTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final DeliveryMapper deliveryMapper = org.mockito.Mockito.mock(DeliveryMapper.class);
  private final ReceiptMapper receiptMapper = org.mockito.Mockito.mock(ReceiptMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper, supplierUserMapper);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final ReceiptApplicationService receiptApplicationService = new ReceiptApplicationService(
      purchaseOrderMapper,
      deliveryMapper,
      receiptMapper,
      org.mockito.Mockito.mock(com.procurement.order.infrastructure.OrderLineItemMapper.class),
      org.mockito.Mockito.mock(com.procurement.order.infrastructure.ReceiptLineItemMapper.class),
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService,
      new PurchaseOrderStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void buyerReceiptCreatesInAppNotificationsForActiveBuyerUsers() {
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
        .thenAnswer(invocation -> receipt(invocation.getArgument(1)));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "active", "dept-it", "role-buyer-requester"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "inactive", "dept-it", "role-buyer-requester")));

    receiptApplicationService.create("po-1", new CreateReceiptRequest("验收通过", null, null, null, null, null, null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("采购订单已收货"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 已完成收货验收，结果：验收通过。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void buyerReceiptNotifiesActiveSupplierUsersThatInvoiceCanBeSubmitted() {
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
        .thenAnswer(invocation -> receipt(invocation.getArgument(1)));
    when(supplierUserMapper.listBySupplier("supplier-1")).thenReturn(List.of(
        supplierUser("supplier-user-active", "active"),
        supplierUser("supplier-user-disabled", "inactive")));

    receiptApplicationService.create("po-1", new CreateReceiptRequest("验收通过", null, null, null, null, null, null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-active"),
        org.mockito.ArgumentMatchers.eq("采购订单已收货"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 已完成收货验收，供应商可提交发票。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-disabled"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }

  private Receipt receipt(String id) {
    return new Receipt(
        id,
        "tenant-1",
        "po-1",
        "user-buyer",
        "验收通过",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 100, 98, "外观完好，抽检合格", null, null, null);
  }

  private SupplierUser supplierUser(String id, String status) {
    return new SupplierUser(
        id,
        "supplier-1",
        "供应商用户",
        "13800000001",
        id + "@example.com",
        status,
        "role-supplier-sales");
  }
}
