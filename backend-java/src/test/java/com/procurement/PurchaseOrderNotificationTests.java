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
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseOrderNotificationTests {

  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final PurchaseOrderApplicationService purchaseOrderApplicationService = new PurchaseOrderApplicationService(
      awardDecisionMapper,
      purchaseOrderMapper,
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService,
      new PurchaseOrderStatusTransition());

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
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "启用", "dept-it", "role-buyer-requester"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "停用", "dept-it", "role-buyer-requester")));

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
