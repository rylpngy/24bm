package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.supplier.api.SupplierTodoSummaryResponse;
import com.procurement.supplier.application.SupplierTodoSummaryAssembler;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class SupplierTodoSummaryAssemblerTests {

  private final SupplierTodoSummaryAssembler assembler = new SupplierTodoSummaryAssembler();

  @Test
  void summarizesSupplierActionableTodoCountsAcrossWorkspaceResources() {
    SupplierTodoSummaryResponse summary = assembler.summarize(
        List.of(rfq("rfq-open", "报价中"), rfq("rfq-awarded", "已定标")),
        List.of(
            order("order-confirming", "待供应商确认"),
            order("order-shipping", "待发货"),
            order("order-received", "已收货")),
        List.of(
            invoice("invoice-pending", "待付款"),
            invoice("invoice-partial", "部分付款"),
            invoice("invoice-paid", "已付款")));

    assertThat(summary.pendingQuoteCount()).isEqualTo(1);
    assertThat(summary.pendingOrderConfirmationCount()).isEqualTo(1);
    assertThat(summary.pendingShipmentCount()).isEqualTo(1);
    assertThat(summary.pendingReceivableCount()).isEqualTo(2);
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款",
            java.util.List.of(), null);
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "", null, new java.math.BigDecimal("13.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, 500, 495, 99, "存在不合格",
            java.util.List.of());
  }
}
