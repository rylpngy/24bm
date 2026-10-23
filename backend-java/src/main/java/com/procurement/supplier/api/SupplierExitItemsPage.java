package com.procurement.supplier.api;

import java.util.List;

public record SupplierExitItemsPage(List<SupplierExitItem> items, long total, int page, int pageSize) {}
