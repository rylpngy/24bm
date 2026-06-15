package com.procurement.buyer.application;

import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.BuyerWorkspaceResponse;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import org.springframework.stereotype.Service;

@Service
public class BuyerWorkspaceApplicationService {
  private static final int AUDIT_LOG_LIMIT = 50;

  private final BuyerSupplierApplicationService buyerSupplierApplicationService;
  private final MaterialApplicationService materialApplicationService;
  private final BuyerUserApplicationService buyerUserApplicationService;
  private final PurchaseDemandApplicationService purchaseDemandApplicationService;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final PaymentApplicationService paymentApplicationService;
  private final ApprovalInboxApplicationService approvalInboxApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public BuyerWorkspaceApplicationService(
      BuyerSupplierApplicationService buyerSupplierApplicationService,
      MaterialApplicationService materialApplicationService,
      BuyerUserApplicationService buyerUserApplicationService,
      PurchaseDemandApplicationService purchaseDemandApplicationService,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      PaymentApplicationService paymentApplicationService,
      ApprovalInboxApplicationService approvalInboxApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.buyerSupplierApplicationService = buyerSupplierApplicationService;
    this.materialApplicationService = materialApplicationService;
    this.buyerUserApplicationService = buyerUserApplicationService;
    this.purchaseDemandApplicationService = purchaseDemandApplicationService;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.paymentApplicationService = paymentApplicationService;
    this.approvalInboxApplicationService = approvalInboxApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public BuyerWorkspaceResponse load() {
    return new BuyerWorkspaceResponse(
        buyerSupplierApplicationService.listCurrentTenantSuppliers(),
        materialApplicationService.listCurrentTenantMaterials(),
        buyerUserApplicationService.listCurrentTenantUsers(),
        purchaseDemandApplicationService.listCurrentTenantDemands(),
        rfqApplicationService.listCurrentTenantRfqs(),
        purchaseOrderApplicationService.listCurrentTenantOrders(),
        paymentApplicationService.listCurrentTenantInvoices(),
        approvalInboxApplicationService.listPending(),
        auditLogApplicationService.listCurrentTenantAuditLogs(AUDIT_LOG_LIMIT));
  }
}
