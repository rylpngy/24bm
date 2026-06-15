package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.supplier.application.SupplierWorkspaceApplicationService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class SupplierWorkspaceNotificationTests {

  private final SupplierProfileApplicationService supplierProfileApplicationService =
      org.mockito.Mockito.mock(SupplierProfileApplicationService.class);
  private final QuoteApplicationService quoteApplicationService =
      org.mockito.Mockito.mock(QuoteApplicationService.class);
  private final PurchaseOrderApplicationService purchaseOrderApplicationService =
      org.mockito.Mockito.mock(PurchaseOrderApplicationService.class);
  private final InvoiceApplicationService invoiceApplicationService =
      org.mockito.Mockito.mock(InvoiceApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final SupplierWorkspaceApplicationService supplierWorkspaceApplicationService =
      new SupplierWorkspaceApplicationService(
          supplierProfileApplicationService,
          quoteApplicationService,
          purchaseOrderApplicationService,
          invoiceApplicationService,
          notificationApplicationService);

  @Test
  void supplierWorkspaceAggregatesCurrentSupplierUserNotifications() {
    when(supplierProfileApplicationService.getCurrentSupplierProfile())
        .thenReturn(profile());
    when(quoteApplicationService.listSupplierRfqs()).thenReturn(List.of());
    when(quoteApplicationService.listSupplierQuotes()).thenReturn(List.of());
    when(purchaseOrderApplicationService.listCurrentSupplierOrders()).thenReturn(List.of());
    when(invoiceApplicationService.listCurrentSupplierInvoices()).thenReturn(List.of());
    when(notificationApplicationService.listCurrentSupplierUserNotifications(20))
        .thenReturn(List.of(notification()));

    SupplierWorkspaceResponse response = supplierWorkspaceApplicationService.load();

    assertThat(response.notifications()).hasSize(1);
    assertThat(response.notifications().get(0).title()).isEqualTo("发票已付款");
  }

  private SupplierProfileResponse profile() {
    return new SupplierProfileResponse(
        "supplier-1",
        "晨光科技供应商",
        "supplier",
        "办公设备",
        true,
        "91310000MA1K2026X1",
        "王小明",
        "approved",
        "published",
        List.of("Acme 采购公司"));
  }

  private NotificationResponse notification() {
    return new NotificationResponse(
        "notice-payment",
        "tenant-1",
        "supplier-user-1",
        "发票已付款",
        "采购方已登记付款。",
        false,
        null,
        OffsetDateTime.parse("2026-06-15T12:00:00+08:00"));
  }
}
