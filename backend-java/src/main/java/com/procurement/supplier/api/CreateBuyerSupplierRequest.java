package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

// 建档主数据字段选填:提供时写入供应商主数据(supplier_enterprises),供详情/付款使用。
public record CreateBuyerSupplierRequest(
    @NotBlank String supplierId,
    @NotBlank String status,
    @NotBlank String level,
    @NotNull List<String> categories,
    String creditCode,
    String legalPerson,
    String contactName,
    String contactPhone,
    String contactEmail,
    String businessScope,
    String bankName,
    String bankAccount) {
}
