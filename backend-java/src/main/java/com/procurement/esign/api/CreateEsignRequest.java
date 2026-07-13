package com.procurement.esign.api;

import jakarta.validation.constraints.NotBlank;

public record CreateEsignRequest(
    @NotBlank(message = "签署对象类型不能为空") String targetType,
    @NotBlank(message = "签署对象不能为空") String targetId,
    @NotBlank(message = "签名不能为空,请先手写签名") String signatureImage,
    String signerName,
    String remark) {
}
