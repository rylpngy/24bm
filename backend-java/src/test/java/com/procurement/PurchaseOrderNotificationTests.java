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
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseOrderNotificationTests {

  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper, supplierUserMapper);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final PurchaseOrderApplicationService purchaseOrderApplicationService = new PurchaseOrderApplicationService(
      awardDecisionMapper,
      rfqMapper,
      purchaseOrderMapper,
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService,
      new PurchaseOrderStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.order.application.OrderLineItemApplicationService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void supplierConfirmationCreatesInAppNotificationsForActiveBuyerUsers() {
    TenantContext.set(null, "supplier-1", "user-supplier");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待供应商确认"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待供应商确认", "待发货"))
        .thenReturn(1);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "active", "dept-it", "role-buyer-requester"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "inactive", "dept-it", "role-buyer-requester")));

    purchaseOrderApplicationService.confirmCurrentSupplierOrder("po-1");

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("采购订单已确认"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 已由供应商确认，进入待发货。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void creatingPurchaseOrderFromAwardNotifiesActiveSupplierUsersToConfirmOrder() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(awardDecisionMapper.findApprovedForOrder("tenant-1", "award-1", "已通过"))
        .thenReturn(award("award-1", "tenant-1", "supplier-1", "已通过"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已定标", "supplier-1"));
    when(purchaseOrderMapper.findByAwardSource("tenant-1", "rfq-1", "supplier-1"))
        .thenReturn(null);
    when(purchaseOrderMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> order(invocation.getArgument(1), "tenant-1", "supplier-1", "待供应商确认"));
    when(supplierUserMapper.listBySupplier("supplier-1")).thenReturn(List.of(
        supplierUser("supplier-user-active", "active"),
        supplierUser("supplier-user-disabled", "inactive")));

    var response = purchaseOrderApplicationService.createFromAward(
        new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20")));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-active"),
        org.mockito.ArgumentMatchers.eq("采购订单待确认"),
        org.mockito.ArgumentMatchers.eq("采购订单 " + response.id() + " 已生成，请及时确认订单。"));
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

  private AwardDecision award(String id, String tenantId, String supplierId, String status) {
    return new AwardDecision(
        id,
        tenantId,
        "rfq-1",
        "quote-1",
        supplierId,
        BigDecimal.valueOf(100),
        "价格最优",
        status,
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
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null, null, null, null);
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
