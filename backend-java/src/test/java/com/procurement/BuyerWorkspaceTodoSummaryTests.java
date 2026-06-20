package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.BuyerWorkspaceResponse;
import com.procurement.buyer.application.BuyerWorkspaceApplicationService;
import com.procurement.buyer.application.BuyerTodoSummaryAssembler;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerWorkspaceTodoSummaryTests {

  private final BuyerSupplierApplicationService buyerSupplierApplicationService =
      org.mockito.Mockito.mock(BuyerSupplierApplicationService.class);
  private final MaterialApplicationService materialApplicationService =
      org.mockito.Mockito.mock(MaterialApplicationService.class);
  private final BuyerUserApplicationService buyerUserApplicationService =
      org.mockito.Mockito.mock(BuyerUserApplicationService.class);
  private final PurchaseDemandApplicationService purchaseDemandApplicationService =
      org.mockito.Mockito.mock(PurchaseDemandApplicationService.class);
  private final RfqApplicationService rfqApplicationService =
      org.mockito.Mockito.mock(RfqApplicationService.class);
  private final PurchaseOrderApplicationService purchaseOrderApplicationService =
      org.mockito.Mockito.mock(PurchaseOrderApplicationService.class);
  private final DeliveryApplicationService deliveryApplicationService =
      org.mockito.Mockito.mock(DeliveryApplicationService.class);
  private final PaymentApplicationService paymentApplicationService =
      org.mockito.Mockito.mock(PaymentApplicationService.class);
  private final ApprovalInboxApplicationService approvalInboxApplicationService =
      org.mockito.Mockito.mock(ApprovalInboxApplicationService.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final BuyerTodoSummaryAssembler buyerTodoSummaryAssembler = new BuyerTodoSummaryAssembler();
  private final BuyerWorkspaceApplicationService buyerWorkspaceApplicationService =
      new BuyerWorkspaceApplicationService(
          buyerSupplierApplicationService,
          materialApplicationService,
          buyerUserApplicationService,
          purchaseDemandApplicationService,
          rfqApplicationService,
          purchaseOrderApplicationService,
          deliveryApplicationService,
          paymentApplicationService,
          approvalInboxApplicationService,
          auditLogApplicationService,
          notificationApplicationService,
          buyerTodoSummaryAssembler);

  @Test
  void buyerWorkspaceSummarizesActionableTodos() {
    when(buyerSupplierApplicationService.listCurrentTenantSuppliers()).thenReturn(List.of());
    when(materialApplicationService.listCurrentTenantMaterials()).thenReturn(List.of());
    when(buyerUserApplicationService.listCurrentTenantUsers()).thenReturn(List.of());
    when(purchaseDemandApplicationService.listCurrentTenantDemands()).thenReturn(List.of());
    when(rfqApplicationService.listCurrentTenantRfqs()).thenReturn(List.of(
        rfq("rfq-award", "报价中"),
        rfq("rfq-done", "已定标")));
    when(purchaseOrderApplicationService.listCurrentTenantOrders()).thenReturn(List.of(
        order("po-receipt", "已发货"),
        order("po-pending-supplier", "待供应商确认")));
    when(deliveryApplicationService.listCurrentTenantDeliveries()).thenReturn(List.of(
        delivery("delivery-1", "po-receipt")));
    when(paymentApplicationService.listCurrentTenantInvoices()).thenReturn(List.of(
        invoice("inv-pending", "待付款"),
        invoice("inv-partial", "部分付款"),
        invoice("inv-paid", "已付款")));
    when(approvalInboxApplicationService.listPending()).thenReturn(List.of(
        approval("approval-demand"),
        approval("approval-award")));
    when(approvalInboxApplicationService.listRecentReviewed()).thenReturn(List.of(reviewedApproval("approval-reviewed")));
    when(auditLogApplicationService.listCurrentTenantAuditLogs(50)).thenReturn(List.of());
    when(notificationApplicationService.listCurrentUserNotifications(50)).thenReturn(List.of(notification("notice-approval")));

    BuyerWorkspaceResponse response = buyerWorkspaceApplicationService.load();

    assertThat(response.todoSummary().pendingApprovalCount()).isEqualTo(2);
    assertThat(response.todoSummary().pendingAwardCount()).isEqualTo(1);
    assertThat(response.todoSummary().pendingReceiptCount()).isEqualTo(1);
    assertThat(response.todoSummary().pendingPaymentCount()).isEqualTo(2);
    assertThat(response.recentApprovals()).extracting(PendingApprovalTaskResponse::id)
        .containsExactly("approval-reviewed");
    assertThat(response.notifications()).extracting(NotificationResponse::title)
        .containsExactly("需求审批已通过");
    assertThat(response.deliveries()).extracting(DeliveryResponse::trackingNo)
        .containsExactly("SF100001");
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private DeliveryResponse delivery(String id, String orderId) {
    return new DeliveryResponse(
        id,
        "tenant-1",
        orderId,
        "supplier-1",
        "顺丰速运",
        "SF100001",
        "已发货",
        OffsetDateTime.parse("2026-06-16T10:00:00+08:00"));
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

  private PendingApprovalTaskResponse reviewedApproval(String id) {
    return new PendingApprovalTaskResponse(
        id,
        "tenant-1",
        "purchase_demand",
        "demand-1",
        null,
        "办公电脑采购",
        "已通过",
        70,
        "requester-1",
        "需求申请人",
        BigDecimal.valueOf(100),
        "supplier-1",
        "晨光科技供应商",
        "buyer-user",
        "已通过",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }

  private NotificationResponse notification(String id) {
    return new NotificationResponse(
        id,
        "tenant-1",
        "buyer-user",
        "需求审批已通过",
        "办公电脑采购审批已通过",
        false,
        null,
        OffsetDateTime.parse("2026-06-15T11:01:00+08:00"));
  }
}
