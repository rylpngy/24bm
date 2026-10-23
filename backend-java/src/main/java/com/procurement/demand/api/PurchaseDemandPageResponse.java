package com.procurement.demand.api;

import java.util.List;

public record PurchaseDemandPageResponse(
    List<PurchaseDemandResponse> items, long total, int page, int pageSize) {
}
