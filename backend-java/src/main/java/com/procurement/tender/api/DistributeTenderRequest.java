package com.procurement.tender.api;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

// 邀请招标:定向发放招标文件给已准入供应商。
public record DistributeTenderRequest(@NotEmpty(message = "请选择至少一家受邀供应商") List<@NotBlank String> supplierIds) {
}
