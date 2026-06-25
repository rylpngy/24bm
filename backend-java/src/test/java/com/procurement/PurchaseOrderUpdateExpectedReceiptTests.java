package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.api.UpdatePurchaseOrderRequest;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseOrderUpdateExpectedReceiptTests {
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final PurchaseOrderApplicationService purchaseOrderApplicationService =
      new PurchaseOrderApplicationService(
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
  void updatesExpectedReceiptDateBeforeOrderIsReceivedInsideTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    var nextDate = LocalDate.parse("2026-07-12");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "待供应商确认", LocalDate.parse("2026-07-10")))
        .thenReturn(order("po-1", "待供应商确认", nextDate));
    when(purchaseOrderMapper.updateExpectedReceiptDate("tenant-1", "po-1", nextDate))
        .thenReturn(1);

    var response = purchaseOrderApplicationService.update("po-1", new UpdatePurchaseOrderRequest(nextDate, null, null, null, null));

    assertThat(response.expectedReceiptDate()).isEqualTo(nextDate);
    verify(purchaseOrderMapper).updateExpectedReceiptDate("tenant-1", "po-1", nextDate);
  }

  @Test
  void updatingExpectedReceiptDateNotifiesSupplierUsers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    var nextDate = LocalDate.parse("2026-07-12");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "待发货", LocalDate.parse("2026-07-10")))
        .thenReturn(order("po-1", "待发货", nextDate));
    when(purchaseOrderMapper.updateExpectedReceiptDate("tenant-1", "po-1", nextDate))
        .thenReturn(1);

    purchaseOrderApplicationService.update("po-1", new UpdatePurchaseOrderRequest(nextDate, null, null, null, null));

    verify(notificationApplicationService).notifyActiveSupplierUsers(
        "tenant-1",
        "supplier-1",
        NotificationTitle.PURCHASE_ORDER_EXPECTED_RECEIPT_UPDATED,
        "采购订单 po-1 预计到货日期已更新为 2026-07-12，请按最新交期履约。");
  }

  @Test
  void rejectsUpdatingExpectedReceiptDateAfterOrderIsReceived() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "已收货", LocalDate.parse("2026-07-10")));

    assertThatThrownBy(() -> purchaseOrderApplicationService.update(
        "po-1",
        new UpdatePurchaseOrderRequest(LocalDate.parse("2026-07-12"), null, null, null, null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Received purchase order cannot be updated");

    verify(purchaseOrderMapper, never()).updateExpectedReceiptDate(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
  }

  private PurchaseOrder order(String id, String status, LocalDate expectedReceiptDate) {
    return new PurchaseOrder(
        id,
        "tenant-1",
        "rfq-1",
        "supplier-1",
        BigDecimal.valueOf(118000),
        status,
        expectedReceiptDate,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }
}
