package com.procurement.buyer.application;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.BuyerTodoSummaryResponse;
import com.procurement.buyer.api.BuyerWorkspaceResponse;
import com.procurement.catalog.api.MaterialResponse;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class BuyerWorkspaceApplicationService {
  private static final int AUDIT_LOG_LIMIT = 50;
  private static final int NOTIFICATION_LIMIT = 50;
  private static final String RFQ_QUOTING_STATUS = "报价中";
  private static final String ORDER_SHIPPED_STATUS = "已发货";
  private static final String INVOICE_PENDING_PAYMENT_STATUS = "待付款";
  private static final String INVOICE_PARTIAL_PAYMENT_STATUS = "部分付款";

  private final BuyerSupplierApplicationService buyerSupplierApplicationService;
  private final MaterialApplicationService materialApplicationService;
  private final BuyerUserApplicationService buyerUserApplicationService;
  private final PurchaseDemandApplicationService purchaseDemandApplicationService;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final PaymentApplicationService paymentApplicationService;
  private final ApprovalInboxApplicationService approvalInboxApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public BuyerWorkspaceApplicationService(
      BuyerSupplierApplicationService buyerSupplierApplicationService,
      MaterialApplicationService materialApplicationService,
      BuyerUserApplicationService buyerUserApplicationService,
      PurchaseDemandApplicationService purchaseDemandApplicationService,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      PaymentApplicationService paymentApplicationService,
      ApprovalInboxApplicationService approvalInboxApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.buyerSupplierApplicationService = buyerSupplierApplicationService;
    this.materialApplicationService = materialApplicationService;
    this.buyerUserApplicationService = buyerUserApplicationService;
    this.purchaseDemandApplicationService = purchaseDemandApplicationService;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.paymentApplicationService = paymentApplicationService;
    this.approvalInboxApplicationService = approvalInboxApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public BuyerWorkspaceResponse load() {
    List<BuyerSupplierResponse> suppliers = buyerSupplierApplicationService.listCurrentTenantSuppliers();
    List<MaterialResponse> materials = materialApplicationService.listCurrentTenantMaterials();
    List<BuyerUserResponse> users = buyerUserApplicationService.listCurrentTenantUsers();
    List<PurchaseDemandResponse> demands = purchaseDemandApplicationService.listCurrentTenantDemands();
    List<RfqResponse> rfqs = rfqApplicationService.listCurrentTenantRfqs();
    List<PurchaseOrderResponse> orders = purchaseOrderApplicationService.listCurrentTenantOrders();
    List<InvoiceResponse> invoices = paymentApplicationService.listCurrentTenantInvoices();
    List<PendingApprovalTaskResponse> pendingApprovals = approvalInboxApplicationService.listPending();
    List<PendingApprovalTaskResponse> recentApprovals = approvalInboxApplicationService.listRecentReviewed();
    List<NotificationResponse> notifications =
        notificationApplicationService.listCurrentUserNotifications(NOTIFICATION_LIMIT);
    List<AuditLogResponse> auditLogs = auditLogApplicationService.listCurrentTenantAuditLogs(AUDIT_LOG_LIMIT);

    return new BuyerWorkspaceResponse(
        summarizeTodos(rfqs, orders, invoices, pendingApprovals),
        suppliers,
        materials,
        users,
        demands,
        rfqs,
        orders,
        invoices,
        pendingApprovals,
        recentApprovals,
        notifications,
        auditLogs);
  }

  private BuyerTodoSummaryResponse summarizeTodos(
      List<RfqResponse> rfqs,
      List<PurchaseOrderResponse> orders,
      List<InvoiceResponse> invoices,
      List<PendingApprovalTaskResponse> pendingApprovals) {
    return new BuyerTodoSummaryResponse(
        pendingApprovals.size(),
        countRfqsByStatus(rfqs, RFQ_QUOTING_STATUS),
        countOrdersByStatus(orders, ORDER_SHIPPED_STATUS),
        invoices.stream()
            .filter(invoice -> INVOICE_PENDING_PAYMENT_STATUS.equals(invoice.paymentStatus())
                || INVOICE_PARTIAL_PAYMENT_STATUS.equals(invoice.paymentStatus()))
            .count());
  }

  private long countRfqsByStatus(List<RfqResponse> rfqs, String status) {
    return rfqs.stream()
        .filter(rfq -> status.equals(rfq.status()))
        .count();
  }

  private long countOrdersByStatus(List<PurchaseOrderResponse> orders, String status) {
    return orders.stream()
        .filter(order -> status.equals(order.status()))
        .count();
  }
}
