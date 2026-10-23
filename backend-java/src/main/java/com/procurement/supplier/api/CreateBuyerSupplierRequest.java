package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

// 选填资料仅写入当前采购企业的私域档案，不修改供应商公共主档。
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
