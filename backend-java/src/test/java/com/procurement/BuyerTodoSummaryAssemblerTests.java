package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.buyer.api.BuyerTodoSummaryResponse;
import com.procurement.buyer.application.BuyerTodoSummaryAssembler;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.RfqResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerTodoSummaryAssemblerTests {

  private final BuyerTodoSummaryAssembler assembler = new BuyerTodoSummaryAssembler();

  @Test
  void summarizesBuyerActionableTodoCountsAcrossWorkspaceResources() {
    BuyerTodoSummaryResponse summary = assembler.summarize(
        List.of(rfq("rfq-quoting", "报价中"), rfq("rfq-awarded", "已定标")),
        List.of(order("order-shipped", "已发货"), order("order-confirming", "待供应商确认")),
        List.of(
            invoice("invoice-pending", "待付款"),
            invoice("invoice-partial", "部分付款"),
            invoice("invoice-paid", "已付款")),
        List.of(approval("approval-demand"), approval("approval-award")));

    assertThat(summary.pendingApprovalCount()).isEqualTo(2);
    assertThat(summary.pendingAwardCount()).isEqualTo(1);
    assertThat(summary.pendingReceiptCount()).isEqualTo(1);
    assertThat(summary.pendingPaymentCount()).isEqualTo(2);
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private PendingApprovalTaskResponse approval(String id) {
    return new PendingApprovalTaskResponse(
        id,
        "tenant-1",
        "purchase_demand",
        "demand-1",
        null,
        "办公电脑采购",
        "审批中",
        70,
        "requester-1",
        "需求申请人",
        BigDecimal.valueOf(100),
        "supplier-1",
        "晨光科技供应商",
        "buyer-user",
        "待审批",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        null);
  }
}
