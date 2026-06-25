package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.UpdateSupplierReceivableRequest;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinanceInvoiceNotificationTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final InvoiceReconciliationMapper invoiceReconciliationMapper =
      org.mockito.Mockito.mock(InvoiceReconciliationMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final InvoiceApplicationService invoiceApplicationService = new InvoiceApplicationService(
      purchaseOrderMapper,
        org.mockito.Mockito.mock(com.procurement.order.infrastructure.ReceiptMapper.class),
      invoiceMapper,
      invoiceReconciliationMapper,
      threeWayMatchMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void supplierInvoiceCreationNotifiesActiveBuyerUsers() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order());
    when(invoiceMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> invoice(invocation.getArgument(1)));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "启用", "dept-it", "role-buyer-requester"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "停用", "dept-it", "role-buyer-requester")));

    invoiceApplicationService.create("po-1", new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001", null, null, null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("供应商已登记发票"),
        org.mockito.ArgumentMatchers.eq("采购订单 po-1 已登记发票 INV-001，金额：100。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void supplierReceivableNoteUpdateNotifiesActiveBuyerUsers() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceMapper.findBySupplierAndId("supplier-1", "invoice-1"))
        .thenReturn(invoice("invoice-1"))
        .thenReturn(invoiceWithNote("invoice-1", "已与采购方确认 6 月底付尾款"));
    when(invoiceMapper.updateSupplierReconciliationNote(
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "已与采购方确认 6 月底付尾款"))
        .thenReturn(1);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order());
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("buyer-1", "tenant-1", "采购员", "13800000001", "buyer@example.com", "启用", "dept-it", "role-buyer-requester")));

    invoiceApplicationService.updateReceivable(
        "invoice-1",
        new UpdateSupplierReceivableRequest("已与采购方确认 6 月底付尾款"));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("供应商已登记发票"),
        org.mockito.ArgumentMatchers.eq("发票 INV-001 的供应商应收对账备注已更新：已与采购方确认 6 月底付尾款。"));
  }

  private PurchaseOrder order() {
    return new PurchaseOrder(
        "po-1",
        "tenant-1",
        "rfq-1",
        "supplier-1",
        BigDecimal.valueOf(100),
        "已收货",
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }

  private Invoice invoice(String id) {
    return new Invoice(
        id,
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        "待付款",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "144031909110", java.time.LocalDate.parse("2026-06-01"), new java.math.BigDecimal("13.00"));
  }

  private Invoice invoiceWithNote(String id, String reconciliationNote) {
    return new Invoice(
        id,
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        "待付款",
        reconciliationNote,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "144031909110", java.time.LocalDate.parse("2026-06-01"), new java.math.BigDecimal("13.00"));
  }
}
