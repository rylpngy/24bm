package com.procurement.supplier.api;

import java.util.List;

public record QualificationLedgerPage(List<QualificationLedgerRow> items, long total, int page, int pageSize) {}
