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
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.UpdateDeliveryRequest;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.domain.Delivery;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.DeliveryMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DeliveryNotificationTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final DeliveryMapper deliveryMapper = org.mockito.Mockito.mock(DeliveryMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final DeliveryApplicationService deliveryApplicationService = new DeliveryApplicationService(
      purchaseOrderMapper,
      deliveryMapper,
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService,
      new PurchaseOrderStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void supplierShipmentCreatesInAppNotificationsForActiveBuyerUsers() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待发货", "已发货"))
        .thenReturn(1);
    when(deliveryMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> delivery(invocation.getArgument(1)));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "active", "dept-it", "role-buyer-requester"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "inactive", "dept-it", "role-buyer-requester")));

    deliveryApplicationService.create("po-1", new CreateDeliveryRequest("顺丰", "SF123", null, null, null, null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("采购订单已发货"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 已发货，物流：顺丰 SF123。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void supplierCanUpdateDeliveryTrackingBeforeBuyerReceipt() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(deliveryMapper.findBySupplierAndId("supplier-1", "delivery-1"))
        .thenReturn(delivery("delivery-1"));
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已发货"));
    when(deliveryMapper.updateSupplierDelivery(
        "tenant-1",
        "delivery-1",
        "supplier-1",
        "京东物流",
        "JD987654321", null, null, null, null))
        .thenReturn(1);
    when(deliveryMapper.findByTenantAndId("tenant-1", "delivery-1"))
        .thenReturn(new Delivery(
            "delivery-1",
            "tenant-1",
            "po-1",
            "supplier-1",
            "京东物流",
            "JD987654321",
            "已发货",
            OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货"));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "active", "dept-it", "role-buyer-requester")));

    var response = deliveryApplicationService.update(
        "delivery-1",
        new UpdateDeliveryRequest("京东物流", "JD987654321", null, null, null, null));

    org.assertj.core.api.Assertions.assertThat(response.carrier()).isEqualTo("京东物流");
    org.assertj.core.api.Assertions.assertThat(response.trackingNo()).isEqualTo("JD987654321", null, null, null, null);
    verify(deliveryMapper).updateSupplierDelivery(
        "tenant-1",
        "delivery-1",
        "supplier-1",
        "京东物流",
        "JD987654321", null, null, null, null);
    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("采购订单已发货"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 物流信息已更新，物流：京东物流 JD987654321。"));
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

  private Delivery delivery(String id) {
    return new Delivery(
        id,
        "tenant-1",
        "po-1",
        "supplier-1",
        "顺丰",
        "SF123",
        "已发货",
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货");
  }
}
