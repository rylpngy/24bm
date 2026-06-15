package com.procurement.buyer.api;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.catalog.api.MaterialResponse;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.supplier.api.BuyerSupplierResponse;
import java.util.List;

public record BuyerWorkspaceResponse(
    List<BuyerSupplierResponse> suppliers,
    List<MaterialResponse> materials,
    List<BuyerUserResponse> users,
    List<PurchaseDemandResponse> demands,
    List<RfqResponse> rfqs,
    List<PurchaseOrderResponse> orders,
    List<InvoiceResponse> invoices,
    List<PendingApprovalTaskResponse> pendingApprovals,
    List<AuditLogResponse> auditLogs) {
}
