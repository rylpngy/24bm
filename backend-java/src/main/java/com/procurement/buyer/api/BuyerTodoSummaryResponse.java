package com.procurement.buyer.api;

public record BuyerTodoSummaryResponse(
    long pendingApprovalCount,
    long pendingAwardCount,
    long pendingReceiptCount,
    long pendingPaymentCount) {
}
