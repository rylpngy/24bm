package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.supplier.application.SupplierTodoSummaryAssembler;
import com.procurement.supplier.application.SupplierWorkspaceApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
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
  private final DeliveryApplicationService deliveryApplicationService =
      org.mockito.Mockito.mock(DeliveryApplicationService.class);
  private final InvoiceApplicationService invoiceApplicationService =
      org.mockito.Mockito.mock(InvoiceApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final SupplierTodoSummaryAssembler supplierTodoSummaryAssembler = new SupplierTodoSummaryAssembler();
  private final SupplierWorkspaceApplicationService supplierWorkspaceApplicationService =
      new SupplierWorkspaceApplicationService(
          supplierProfileApplicationService,
          quoteApplicationService,
          purchaseOrderApplicationService,
          deliveryApplicationService,
          invoiceApplicationService,
          notificationApplicationService,
          supplierTodoSummaryAssembler);

  @Test
  void supplierWorkspaceAggregatesCurrentSupplierUserNotifications() {
    when(supplierProfileApplicationService.getCurrentSupplierProfile())
        .thenReturn(profile());
    when(quoteApplicationService.listSupplierRfqs()).thenReturn(List.of());
    when(quoteApplicationService.listSupplierQuotes()).thenReturn(List.of());
    when(purchaseOrderApplicationService.listCurrentSupplierOrders()).thenReturn(List.of());
    when(deliveryApplicationService.listCurrentSupplierDeliveries(null, null)).thenReturn(List.of(delivery()));
    when(invoiceApplicationService.listCurrentSupplierInvoices()).thenReturn(List.of());
    when(notificationApplicationService.listCurrentSupplierUserNotifications(20))
        .thenReturn(List.of(notification()));

    SupplierWorkspaceResponse response = supplierWorkspaceApplicationService.load();

    assertThat(response.notifications()).hasSize(1);
    assertThat(response.notifications().get(0).title()).isEqualTo("发票已付款");
    assertThat(response.deliveries()).extracting(DeliveryResponse::trackingNo)
        .containsExactly("SF-SUPPLIER-001");
  }

  @Test
  void supplierWorkspaceSummarizesActionableTodos() {
    when(supplierProfileApplicationService.getCurrentSupplierProfile())
        .thenReturn(profile());
    when(quoteApplicationService.listSupplierRfqs()).thenReturn(List.of(
        rfq("rfq-open", "报价中"),
        rfq("rfq-awarded", "已定标")));
    when(quoteApplicationService.listSupplierQuotes()).thenReturn(List.of());
    when(purchaseOrderApplicationService.listCurrentSupplierOrders()).thenReturn(List.of(
        order("po-confirm", "待供应商确认"),
        order("po-ship", "待发货"),
        order("po-received", "已收货")));
    when(deliveryApplicationService.listCurrentSupplierDeliveries(null, null)).thenReturn(List.of());
    when(invoiceApplicationService.listCurrentSupplierInvoices()).thenReturn(List.of(
        invoice("inv-pending", "待付款"),
        invoice("inv-partial", "部分付款"),
        invoice("inv-paid", "已付款")));
    when(notificationApplicationService.listCurrentSupplierUserNotifications(20))
        .thenReturn(List.of());

    SupplierWorkspaceResponse response = supplierWorkspaceApplicationService.load();

    assertThat(response.todoSummary().pendingQuoteCount()).isEqualTo(1);
    assertThat(response.todoSummary().pendingOrderConfirmationCount()).isEqualTo(1);
    assertThat(response.todoSummary().pendingShipmentCount()).isEqualTo(1);
    assertThat(response.todoSummary().pendingReceivableCount()).isEqualTo(2);
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

  private RfqResponse rfq(String id, String status) {
    return new RfqResponse(
        id,
        "tenant-1",
        "办公电脑采购",
        status,
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        List.of("demand-1"),
        List.of("supplier-1"));
  }

  private PurchaseOrderResponse order(String id, String status) {
    return new PurchaseOrderResponse(
        id,
        "tenant-1",
        "rfq-1",
        "supplier-1",
        BigDecimal.valueOf(100),
        status,
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }

  private DeliveryResponse delivery() {
    return new DeliveryResponse(
        "delivery-1",
        "tenant-1",
        "po-ship",
        "supplier-1",
        "顺丰速运",
        "SF-SUPPLIER-001",
        "已发货",
        OffsetDateTime.parse("2026-06-16T10:00:00+08:00"), 500, java.time.LocalDate.parse("2026-06-18"), java.time.LocalDate.parse("2026-06-22"), "整车直发，预计3日到货");
  }

  private InvoiceResponse invoice(String id, String paymentStatus) {
    return new InvoiceResponse(
        id,
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        paymentStatus,
        null,
        LocalDate.parse("2026-07-15"),
        false,
        0L,
        BigDecimal.valueOf(100),
        BigDecimal.ZERO,
        "已收货",
        "三单一致",
        "REC-" + id,
        "待付款",
        "登记付款",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "", null, new java.math.BigDecimal("13.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, 500, 495, 99, "存在不合格");
  }
}
